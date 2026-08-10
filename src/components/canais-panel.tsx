"use client";

import { useState } from "react";
import { ChevronRight, Radio, Smartphone, MessageCircle, Mail, Bell, PhoneOff } from "lucide-react";
import { Modal } from "@/components/modal";
import { cn } from "@/lib/utils";
import type { CanaisPanel } from "@/lib/canais";
import type { DeliveryChannel } from "@/lib/supabase/database.types";

/**
 * "Alcance dos avisos" — o painel de canais (migration 0052).
 *
 * Existe pra responder três perguntas que o app não conseguia responder:
 *   1. quem NÃO recebe aviso nenhum? (a única parte com o que fazer)
 *   2. dizer "vou" e dizer "não vou poder" custam o mesmo?
 *   3. cada canal traz resposta — ou só repete quem já respondia?
 *
 * Sheet e não página: são cinco abas fixas e o sistema abre tudo em bottom
 * sheet. E mora no Perfil porque é ali que "avisos" já vive (push + o que te
 * avisar), então o gestor não precisa aprender um lugar novo.
 *
 * Sobre a cor: musgo/telha aqui falam de RISCO de cobertura — quem não tem
 * canal não vai saber que está escalado. Não é decoração, é o mesmo vocabulário
 * de vaga descoberta. Os canais em si não recebem cor: seriam categoria, e
 * categoria no Sirvo sai da paleta própria, não de cor de estado.
 */

const CANAL_META: Record<DeliveryChannel, { nome: string; Icon: typeof Smartphone }> = {
  push: { nome: "Push", Icon: Smartphone },
  whatsapp: { nome: "WhatsApp", Icon: MessageCircle },
  email: { nome: "E-mail", Icon: Mail },
  in_app: { nome: "Sino", Icon: Bell },
};

/** "8,3 h" / "3,8 dias" — hora crua acima de 48h vira número que ninguém sente. */
function dur(horas: number | null): string {
  if (horas === null) return "—";
  if (horas < 48) return `${horas.toFixed(1).replace(".", ",")} h`;
  return `${(horas / 24).toFixed(1).replace(".", ",")} dias`;
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  );
}

function Tile({
  rotulo,
  valor,
  nota,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  tom?: "neutro" | "bom" | "risco";
}) {
  return (
    <div className="min-w-0 flex-1 rounded-[12px] bg-muted/50 px-3 py-2.5">
      <Rotulo>{rotulo}</Rotulo>
      <p
        className={cn(
          "mt-1 font-display text-[23px] font-extrabold leading-none tabular-nums",
          tom === "bom" && "text-success-ink",
          tom === "risco" && "text-destructive-ink",
        )}
      >
        {valor}
      </p>
      {nota ? <p className="mt-1 text-[12.5px] leading-tight text-muted-foreground">{nota}</p> : null}
    </div>
  );
}

/**
 * Duas portas pro MESMO sheet, de propósito:
 *
 *  · `linha`  — no Perfil, ao lado dos outros ajustes de aviso. É a referência:
 *    está sempre lá, mesmo quando não há problema nenhum.
 *  · `alerta` — na home do gestor, e SÓ quando alguém escalado nos próximos
 *    cultos não recebe aviso nenhum. Some quando resolve.
 *
 * O alerta não fala dos "sem canal" em geral: 18 de 44 ficariam semanas na tela
 * e viraria papel de parede — o mesmo erro que o `cobranca.ts` evita ao subir o
 * tom em degraus em vez de repetir igual todo dia. Ele fala do dano concreto e
 * datado: alguém vai faltar no domingo sem saber que estava escalado.
 */
export function AlcanceAvisos({
  dados,
  variant = "linha",
  meId,
}: {
  dados: CanaisPanel;
  variant?: "linha" | "alerta";
  /** Quem está olhando — só pro alerta não falar da própria pessoa. */
  meId?: string;
}) {
  const [open, setOpen] = useState(false);
  const { resumo, canais, pessoas, dias } = dados;

  const semCanal = pessoas.filter((p) => !p.temPush && !p.temTelefone);
  // O alerta de gestor é sobre QUEM VOCÊ GERENCIA. Sem tirar você da conta, um
  // líder sem telefone via dois cards empilhados dizendo a mesma coisa sobre ele
  // mesmo — o pessoal ("Ninguém consegue te avisar") e o de gestor. A lista
  // dentro do sheet continua completa: lá é relatório, não cobrança.
  const emRisco = semCanal.filter((p) => p.escaladoEmBreve && p.profileId !== meId);
  const alcancaveis = pessoas.length - semCanal.length;
  const soZap = pessoas.filter((p) => p.temTelefone && !p.temPush).length;
  const umCanalSo = pessoas.filter((p) => p.temPush !== p.temTelefone).length;
  const comTelefone = pessoas.filter((p) => p.temTelefone).length;
  const liberaram = pessoas.filter((p) => p.zapLiberado).length;
  const taxa = resumo && resumo.escalados > 0
    ? Math.round((resumo.respondidos / resumo.escalados) * 100)
    : null;

  // Alerta sem ninguém em risco não tem o que dizer — e um alerta que aparece
  // sempre deixa de ser alerta.
  if (variant === "alerta" && emRisco.length === 0) return null;

  return (
    <>
      {variant === "alerta" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press-sm flex w-full items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3.5 text-left"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning-ink">
            <PhoneOff className="size-5" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-medium">
            {/* "está na escala" e não "está escalado": o app não sabe o gênero
                de ninguém, e nome não diz — a forma neutra acerta sempre. */}
            {emRisco.length === 1
              ? `${emRisco[0].nome} está na escala e não recebe aviso nenhum`
              : `${emRisco.length} pessoas na escala não recebem aviso nenhum`}{" "}
            — toque pra ver quem
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press-sm -mx-1 flex w-full items-center gap-2 rounded-[12px] px-1 py-1 text-left"
        >
          <Radio className="size-4 shrink-0 text-muted-foreground/70" />
          <span className="min-w-0 flex-1 text-sm font-semibold">Alcance dos avisos</span>
          <span
            className={cn(
              "shrink-0 text-[13px]",
              semCanal.length > 0 ? "font-bold text-destructive-ink" : "text-muted-foreground",
            )}
          >
            {semCanal.length > 0 ? `${semCanal.length} sem canal` : "todos alcançáveis"}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} sheet title="Alcance dos avisos">
        <div className="mt-1 space-y-5 pb-1">
          {/* ---- 1. Quem dá pra alcançar ---------------------------------- */}
          <section>
            <div className="flex gap-2">
              <Tile
                rotulo="Alcançáveis"
                valor={`${alcancaveis}/${pessoas.length}`}
                nota="têm push ou telefone"
                tom={semCanal.length === 0 ? "bom" : "neutro"}
              />
              <Tile
                rotulo="Sem canal"
                valor={String(semCanal.length)}
                nota="não recebem nada"
                tom={semCanal.length > 0 ? "risco" : "bom"}
              />
            </div>
            <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
              {soZap > 0 ? (
                <>
                  <strong className="font-bold text-foreground">{soZap}</strong> pessoa
                  {soZap > 1 ? "s" : ""} só o WhatsApp alcançaria — é o tamanho real do ganho
                  desse canal, não o total da igreja.
                </>
              ) : comTelefone === 0 ? (
                // Sem este caso o texto dizia "todo mundo com telefone também tem push"
                // quando NINGUÉM tem telefone — verdade vazia que soa como tranquilidade.
                "Ninguém aqui tem telefone cadastrado: hoje o WhatsApp não teria a quem falar."
              ) : (
                "Todo mundo que tem telefone também tem push: hoje o WhatsApp não alcançaria ninguém novo."
              )}{" "}
              {comTelefone > 0
                ? `${liberaram} de ${comTelefone} com telefone liberaram o WhatsApp.`
                : null}
            </p>
          </section>

          {/* ---- 2. O custo de cada resposta ------------------------------ */}
          {resumo ? (
            <section>
              <Rotulo>Resposta · {dias} dias</Rotulo>
              <div className="mt-1.5 flex gap-2">
                <Tile
                  rotulo="Responderam"
                  valor={taxa === null ? "—" : `${taxa}%`}
                  nota={`${resumo.respondidos} de ${resumo.escalados} · ${resumo.pendentes} em aberto`}
                />
                <Tile rotulo="Pra dizer sim" valor={dur(resumo.horasAteConfirmar)} />
                <Tile
                  rotulo="Pra dizer não"
                  valor={dur(resumo.horasAteRecusar)}
                  tom={
                    resumo.horasAteConfirmar &&
                    resumo.horasAteRecusar &&
                    resumo.horasAteRecusar > resumo.horasAteConfirmar * 3
                      ? "risco"
                      : "neutro"
                  }
                />
              </div>
              {resumo.horasAteConfirmar &&
              resumo.horasAteRecusar &&
              resumo.horasAteRecusar > resumo.horasAteConfirmar * 3 ? (
                <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
                  Recusar está levando{" "}
                  <strong className="font-bold text-destructive-ink">
                    {Math.round(resumo.horasAteRecusar / resumo.horasAteConfirmar)}× mais
                  </strong>{" "}
                  que confirmar. Não é hesitação: confirmar é um toque e recusar pede motivo,
                  chip e substituto — e a vaga fica presa esse tempo todo.
                </p>
              ) : null}
            </section>
          ) : null}

          {/* ---- 3. Canal por canal -------------------------------------- */}
          <section>
            <Rotulo>Por canal</Rotulo>
            <ul className="mt-1.5 divide-y divide-border/70">
              {canais.map((c) => {
                const { nome, Icon } = CANAL_META[c.canal];
                const total = c.enviados + c.falhou + c.semDestino + c.desligado;
                const vazio = total === 0 && c.respostas === 0;
                return (
                  <li
                    key={c.canal}
                    className={cn("flex items-center gap-3 py-2.5", vazio && "opacity-45")}
                  >
                    <Icon className="size-[18px] shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{nome}</p>
                      <p className="text-[12.5px] leading-tight text-muted-foreground">
                        {vazio
                          ? "sem dado ainda"
                          : [
                              `${c.enviados} enviados`,
                              c.falhou > 0 ? `${c.falhou} falharam` : null,
                              c.semDestino > 0 ? `${c.semDestino} sem destino` : null,
                              c.desligado > 0 ? `${c.desligado} desligados` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums">{c.respostas}</p>
                      <p className="text-[12.5px] leading-tight text-muted-foreground tabular-nums">
                        {dur(c.horasMediana)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {resumo && resumo.semAtribuicao > 0 ? (
              <p className="mt-2 rounded-[12px] bg-warning/12 px-3 py-2 text-[12.5px] leading-snug text-warning-ink">
                <strong className="font-bold">{resumo.semAtribuicao}</strong> resposta
                {resumo.semAtribuicao > 1 ? "s" : ""} sem canal identificado
                {resumo.atribuidos === 0 ? " (tudo daqui pra trás) " : " "}
                — enquanto esse número for alto, comparar canais é chute.
              </p>
            ) : null}
          </section>

          {/* ---- 4. A lista com o que fazer ------------------------------ */}
          {semCanal.length > 0 ? (
            <section>
              <Rotulo>Ninguém alcança ({semCanal.length})</Rotulo>
              <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
                Escalar estas pessoas hoje é escalar no escuro: nenhum aviso chega. Pedir o
                telefone resolve — e é o único caminho que não depende de app instalado.
              </p>
              <ul className="mt-2 divide-y divide-border/70">
                {semCanal.map((p) => (
                  <li key={p.profileId} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.nome}</span>
                    {/* quem já está escalado é o caso urgente: dá pra ligar hoje */}
                    {p.escaladoEmBreve ? (
                      <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-[12px] font-bold text-warning-ink">
                        na escala
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {umCanalSo > 0 ? (
                <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
                  Outras <strong className="font-bold text-foreground">{umCanalSo}</strong>{" "}
                  dependem de um único canal — alcançáveis, mas sem plano B.
                </p>
              ) : null}
            </section>
          ) : null}

          <button
            onClick={() => setOpen(false)}
            className="press-sm h-10 w-full text-[14.5px] font-bold text-muted-foreground"
          >
            Fechar
          </button>
        </div>
      </Modal>
    </>
  );
}
