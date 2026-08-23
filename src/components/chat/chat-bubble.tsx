"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { marcarCanalLido } from "@/lib/actions";
import { ChatModal } from "@/components/chat/chat-modal";
import { useAlertaDeMensagens } from "@/components/chat/chat-alerta";
import { useToast } from "@/components/ui/toast";
import { useSomDeAlerta, VOL_CELULAR } from "@/lib/alerta";
import type { CanalChat } from "@/lib/chat";

type Role = "admin" | "leader" | "volunteer";

/**
 * Deep link do push de mensagem: `/inicio?chat=<tipo>&ref=<uuid>` — e só
 * `?chat=avisos`, sem ref, porque o ref do mural é o id da IGREJA e o canal se
 * acha pelo tipo; não há motivo pra jogar isso na barra de endereço.
 *
 * Duas chaves planas em vez de um `chat=equipe:<uuid>` composto porque é assim
 * que o resto do app escreve query — `?ev=`, `?m=`, `?team=`, `?via=`, `?data=`:
 * chave curta, valor opaco, sem sintaxe dentro. O par `<tipo>:<ref>` continua
 * sendo a chave INTERNA do canal (tag do push, canal do Realtime, key de
 * remount); ele só não vira URL.
 *
 * TRÊS estados, e não um `CanalChat | null`, porque "não achei" tem dois
 * significados diferentes e só um deles merece resposta:
 *
 * · `sem-link` — não veio `?chat=`, ou veio escrito errado. Ninguém digitou
 *   aquilo à mão; não há o que explicar, então silêncio.
 * · `sumiu` — o link estava correto e o canal é que não está na lista DESTA
 *   pessoa. Acontece de verdade: o `chat_push_recipients` (0037) é mais largo
 *   que o `listarCanais` — quem recusou a escala, evento com mais de 7 dias,
 *   equipe arquivada —, e o push ainda pode ser tocado dias depois de enviado,
 *   já fora da janela. Aqui a pessoa TOCOU numa notificação: pela Regra do
 *   Retorno Visível, a ação não pode acabar em nada.
 *
 * O que este arquivo NÃO faz mais é abrir o chat assim mesmo. Abrir sem alvo
 * caía em "Avisos gerais" e, logo depois, na posição salva do aparelho — e o
 * efeito que reporta o canal ativo marcava lido os DOIS, apagando badge de
 * conversa que a pessoa nunca escolheu abrir, em silêncio e sem volta.
 *
 * A `search` entra por parâmetro em vez de sair de `window.location`: o mesmo
 * caminho serve ao mount (query da barra) e ao plano B do sw.js (query que veio
 * na mensagem, quando a aba ficou parada na URL antiga).
 */
type AlvoDoLink =
  | { estado: "sem-link" }
  | { estado: "achou"; canal: CanalChat }
  | { estado: "sumiu" };

function alvoDoDeepLink(canais: CanalChat[], search: string): AlvoDoLink {
  const p = new URLSearchParams(search);
  const tipo = p.get("chat");
  const ref = p.get("ref");
  let canal: CanalChat | undefined;
  if (tipo === "avisos") canal = canais.find((c) => c.type === "avisos");
  else if ((tipo === "equipe" || tipo === "evento") && ref)
    canal = canais.find((c) => c.type === tipo && c.ref === ref);
  else return { estado: "sem-link" };
  return canal ? { estado: "achou", canal } : { estado: "sumiu" };
}

/**
 * Balão flutuante do chat interno (canto inferior direito, acima da bottom-nav).
 * Recebe os canais iniciais do servidor e vive de Realtime pra manter o badge de
 * não-lidas vivo — ignora as mensagens da própria pessoa e o canal aberto.
 *
 * A vigilância do Realtime mudou de casa: agora é `useAlertaDeMensagens`, o mesmo
 * hook da régia. Aqui ele também toca (baixinho) e trema o aparelho — a diferença
 * é que o celular respeita o canal ABERTO na tela: apitar enquanto a pessoa lê a
 * conversa seria avisar de algo que ela está vendo. Na régia não, e de propósito
 * (ver a nota lá).
 *
 * App fechado continua com o push (VAPID) que já existia. Este alerta é pra
 * quando o app está na mão — o caso em que o push some no meio das notificações
 * do sistema e ninguém vê.
 */
export function ChatBubble({
  canais: inicial,
  meId,
  role,
}: {
  canais: CanalChat[];
  meId: string;
  role: Role;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [canais, setCanais] = useState<CanalChat[]>(inicial);
  const [active, setActive] = useState<CanalChat | null>(null);
  const [alvo, setAlvo] = useState<CanalChat | null>(null);

  const total = canais.reduce((s, c) => s + c.unread, 0);

  const som = useSomDeAlerta(VOL_CELULAR);
  const { novas, reconhecer } = useAlertaDeMensagens({
    canais,
    meId,
    volume: VOL_CELULAR,
    somLigado: som.ligado,
    comVibracao: true,
    lendoAgora: (tipo, ref) => open && active?.type === tipo && active?.ref === ref,
    aoChegar: (m) =>
      setCanais((prev) =>
        prev.map((c) =>
          c.type === m.tipo && c.ref === m.ref
            ? { ...c, lastAt: m.criadaEm, unread: c.unread + 1 }
            : c,
        ),
      ),
  });

  // Lista sempre fresca sem re-assinar o listener do service worker: `canais`
  // muda a cada mensagem que chega pelo Realtime (o `aoChegar` acima), e refazer
  // o listener a cada mensagem é churn à toa numa porta que só toca quando
  // alguém encosta na notificação.
  const canaisRef = useRef(canais);
  canaisRef.current = canais;

  // Toque na notificação de mensagem: abre o balão JÁ no canal certo, em vez de
  // largar a pessoa na Home com o chat fechado.
  //
  // O canal NÃO se escolhe aqui: o `active` acima é espelho de leitura (só serve
  // pra calar o apito do canal que está na tela) e quem seleciona de verdade é o
  // ChatModal. Por isso o alvo desce como prop.
  //
  // Nada de efeito colateral antes de o alvo resolver: abrir, apontar o alvo e
  // reconhecer andam JUNTOS dentro do mesmo `if`. Abrir sem alvo marcava lido
  // canal alheio (ver a nota do `alvoDoDeepLink`), e reconhecer sem abrir calaria
  // o anel de uma mensagem que ninguém chegou a ver.
  //
  // A cópia (`{ ...r.canal }`) não é enfeite: identidade nova é o único jeito de
  // o modal JÁ ABERTO distinguir "é o mesmo alvo de antes" de "tocaram de novo na
  // notificação daquele canal".
  const abrirPeloDeepLink = useCallback(
    (search: string) => {
      const r = alvoDoDeepLink(canaisRef.current, search);
      if (r.estado === "achou") {
        setAlvo({ ...r.canal });
        setOpen(true);
        reconhecer();
      } else if (r.estado === "sumiu") {
        showToast("Essa conversa não está mais na sua lista.");
      }
    },
    [reconhecer, showToast],
  );

  // Lido do `window.location` num efeito, não por `useSearchParams`: o hook
  // obrigaria o balão a nascer dentro de um <Suspense>, e ele mora no layout de
  // (app) inteiro — o mesmo cálculo já feito em (auth)/entrar/page.tsx.
  const leuLink = useRef(false);
  useEffect(() => {
    if (leuLink.current) return;
    leuLink.current = true;
    const p = new URLSearchParams(window.location.search);
    if (!p.has("chat")) return;
    abrirPeloDeepLink(window.location.search);
    // A limpeza vale pros DOIS desfechos, inclusive quando nada abriu: o
    // parâmetro já foi consumido, e deixá-lo na barra faz o próximo F5 tentar
    // tudo de novo — e o toast repetir uma notícia velha.
    //
    // Limpa SÓ o que é nosso e preserva o resto da query (um `?via=` que venha
    // junto, por exemplo). O hardcode `router.replace("/escalas")` do EscalasView
    // é justamente o que já apagou o `?via=` calado na 0052 — aqui não se repete.
    // Pelo router e não por history.replaceState pra não dessincronizar o
    // histórico do Next (mesmo motivo escrito lá).
    const url = new URL(window.location.href);
    url.searchParams.delete("chat");
    url.searchParams.delete("ref");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PLANO B DO sw.js. `client.navigate()` devolve Promise e, com o app em segundo
  // plano — o caso NORMAL no celular —, ela rejeita: o worker foca a aba e ela
  // volta na URL ANTIGA, então o toque na notificação vira nada, de forma
  // intermitente. Quando isso acontece o worker manda o destino por mensagem, e
  // quem já está montado na página abre o canal sem trocar de URL.
  //
  // O balão é o lugar certo pra ouvir: é ele que tem `canais`, `setOpen`,
  // `setAlvo` e `reconhecer`, e mora no layout de (app) — então o plano B também
  // funciona com a pessoa parada em /escalas, /cronograma, onde for. A URL da aba
  // NÃO é reescrita aqui, de propósito: ela nunca mudou, não há o que limpar.
  //
  // Cleanup obrigatório por três motivos independentes: `navigator.serviceWorker`
  // é do documento e sobrevive à árvore do React; o StrictMode monta os efeitos
  // duas vezes em dev (dois listeners = dois `setOpen` e dois toasts por
  // mensagem); e o layout de (app) remonta ao sair e entrar de conta.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { tipo?: unknown; url?: unknown } | null;
      if (!d || d.tipo !== "abrir-chat" || typeof d.url !== "string") return;
      let search: string;
      try {
        // O sw.js manda caminho relativo ("/inicio?chat=…"); sem base o URL
        // lança. A origem não é conferida de propósito: daqui só se lê `chat` e
        // `ref`, e quem decide é a lista de canais DA PESSOA — ref desconhecido
        // cai em "sumiu" e não abre porta nenhuma.
        search = new URL(d.url, window.location.origin).search;
      } catch {
        return;
      }
      abrirPeloDeepLink(search);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [abrirPeloDeepLink]);

  const openChannel = (c: CanalChat) => {
    setActive(c);
    // Zera o badge do canal localmente e marca lido no servidor (best-effort).
    setCanais((prev) => prev.map((x) => (x.type === c.type && x.ref === c.ref ? { ...x, unread: 0 } : x)));
    void marcarCanalLido(c.type, c.ref);
  };

  const onMuteChange = (type: string, ref: string, muted: boolean) => {
    setCanais((prev) => prev.map((c) => (c.type === type && c.ref === ref ? { ...c, muted } : c)));
    setActive((a) => (a && a.type === type && a.ref === ref ? { ...a, muted } : a));
  };

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          reconhecer();
        }}
        aria-label={total > 0 ? `Chat (${total} não lidas)` : "Chat"}
        className="press fixed right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)" }}
      >
        {/* Anel batendo enquanto há mensagem não reconhecida. É o par visual do
            apito: som sozinho falha no silencioso, no bolso e no barulho. */}
        {novas.length > 0 && !open ? (
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
        ) : null}
        <MessagesSquare className="size-6" />
        {total > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[20px] place-items-center rounded-full border-2 border-background bg-destructive px-1 text-[10px] font-extrabold text-white">
            {total > 9 ? "9+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <ChatModal
          canais={canais}
          meId={meId}
          role={role}
          som={som}
          alvo={alvo}
          onOpenChannel={openChannel}
          onClose={() => {
            setOpen(false);
            setActive(null);
            // O alvo era do TOQUE na notificação, não do aparelho: quem fechar e
            // reabrir o balão pela mão volta a cair onde parou, como sempre.
            setAlvo(null);
          }}
          onMuteChange={onMuteChange}
        />
      ) : null}
    </>
  );
}
