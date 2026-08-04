import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ControlRoom } from "@/components/control/control-room";
import { RundownColumns } from "@/components/rundown-columns";
import { ControlChat } from "@/components/control/control-chat";
import { getSession } from "@/lib/auth";
import {
  listUpcomingEvents,
  listLiveRundownEvents,
  getEventRundown,
  listRundownKinds,
  getRundownState,
  getStageMessage,
  listStageShortcuts,
} from "@/lib/data";
import { listarCanais } from "@/lib/chat";

/**
 * /control — a régia. Endereço digitado à mão, de propósito fora do menu.
 *
 * Escolhe o culto igual à aba Roteiro: ao vivo primeiro, senão o próximo com
 * roteiro aberto; `?ev=<id>` força um específico. O roteiro aqui é o MESMO
 * componente do celular (com o realtime da 0047), então marcar um bloco na régia
 * aparece na mão de todo mundo e vice-versa.
 */
export default async function ControlPage({ searchParams }: { searchParams: Promise<{ ev?: string }> }) {
  const session = await getSession();
  if (!session) return null;
  const { ev: evParam } = await searchParams;

  const [live, futuros] = await Promise.all([listLiveRundownEvents(session), listUpcomingEvents(session, 8)]);
  const seen = new Set<string>();
  const candidatos = [...live, ...futuros].filter((e) => (seen.has(e.id) ? false : seen.add(e.id)));
  const states = await Promise.all(candidatos.map((e) => getRundownState(e.id)));
  const primeiroAberto = candidatos.findIndex((_, i) => !states[i].endedAt);
  const escolhido = evParam ? candidatos.findIndex((e) => e.id === evParam) : -1;
  const idx = escolhido >= 0 ? escolhido : primeiroAberto;
  const ev = idx >= 0 ? candidatos[idx] : null;
  const state = idx >= 0 ? states[idx] : null;

  if (!ev || !state) {
    return (
      <main className="grid h-dvh place-items-center p-8 text-center">
        <div className="max-w-sm">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <CalendarDays className="size-7" />
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold">Nenhum culto com roteiro aberto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A régia abre sozinha quando houver um culto com roteiro. Enquanto isso, monte a ordem pelo app.
          </p>
          <Link href="/cronograma" className="press mt-4 inline-flex h-11 items-center rounded-[14px] bg-primary px-4 text-[15px] font-bold text-primary-foreground">
            Ir para o Roteiro
          </Link>
        </div>
      </main>
    );
  }

  // Sem modelos nem "estou escalado": a régia CONDUZ (inicia, avança, encerra) e
  // não edita estrutura, então essas duas consultas saíram do caminho.
  const [rundown, kinds, canais, stageMsg, stageAtalhos] = await Promise.all([
    getEventRundown(ev.id),
    listRundownKinds(),
    listarCanais(session),
    getStageMessage(session.profile.church_id),
    listStageShortcuts(session.profile.church_id),
  ]);
  const canEdit = session.role === "admin" || session.profile.teams.some((t) => t.manages_rundown);

  // Todos os canais que a pessoa enxerga vão pra régia: o operador pula de
  // "Produção" pro culto e pro "Avisos" sem sair da tela. Quem escolhe o inicial
  // é o ControlChat (o do culto, que é a conversa da operação).

  return (
    <ControlRoom
      rundownSlot={
        <RundownColumns
          eventId={ev.id}
          titulo={ev.title}
          meId={session.userId}
          startsAt={ev.starts_at}
          startedAt={state.startedAt}
          endedAt={state.endedAt}
          items={rundown}
          kinds={kinds}
          canEdit={canEdit}
          stageMsg={stageMsg}
          stageAtalhos={stageAtalhos}
        />
      }
      chatSlot={
        canais.length > 0 ? (
          <ControlChat canais={canais} eventoId={ev.id} meId={session.userId} role={session.role} />
        ) : (
          <p className="grid flex-1 place-items-center px-6 text-center text-sm text-muted-foreground">
            Nenhum canal de chat disponível pra este culto.
          </p>
        )
      }
    />
  );
}
