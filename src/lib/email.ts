import "server-only";

import { Resend } from "resend";

import { registrarFalha } from "@/lib/failure-log";

type SendEmailInput = {
  to: string | (string | null | undefined)[];
  subject: string;
  html: string;
  text?: string;
};

const apiKey = process.env.RESEND_API_KEY;
const fromDefault = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

// Instancia só quando há chave. Sem chave (ex.: dev local), sendEmail vira no-op —
// o app roda normal e o sino in-app continua sendo o canal principal.
const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Envia um e-mail via Resend. Best-effort: uma falha NÃO derruba a ação principal
 * (mesma filosofia do `notify` do sino). Se não houver RESEND_API_KEY, é no-op.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).filter(
    (e): e is string => typeof e === "string" && e.includes("@"),
  );
  if (recipients.length === 0) return;

  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[email] RESEND_API_KEY ausente — e-mail não enviado: "${input.subject}"`,
      );
    }
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: fromDefault,
      to: recipients,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    });
    // O SDK do Resend NÃO lança quando a API recusa — ele devolve `{ data, error }`.
    // Este `if` não existia, e por isso domínio não verificado, rate limit e
    // endereço malformado eram exatamente iguais a "enviado": o catch abaixo só
    // pega erro de rede. Era o buraco mais fundo do best-effort — a falha nem
    // chegava ao console.
    if (error) {
      console.error("[email] o Resend recusou:", error.message);
      void registrarFalha({
        kind: "email",
        detail: `${error.name ?? "erro"}: ${error.message}`,
        subject: recipients[0],
        origem: input.subject,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] falha ao enviar:", err);
    // Best-effort continua: não relança, não derruba a ação. Mas best-effort
    // deixa de ser best-FORGET — a partir daqui a falha vai pro digest.
    void registrarFalha({ kind: "email", detail: msg, subject: recipients[0], origem: input.subject });
  }
}

// =============================================================================
// URL pública + templates
// =============================================================================

/** URL pública do app, pra links absolutos em e-mails. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  // Em deploy de PREVIEW, VERCEL_PROJECT_PRODUCTION_URL aponta pra PRODUÇÃO — o
  // e-mail sairia com link pro app antigo, e o que se está testando é justamente
  // a rota nova. VERCEL_ENV distingue os dois.
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Demo interativa "Primeiros passos" (estática em `public/`, aberta sem login). */
export function demoUrl(): string {
  return `${siteUrl()}/primeiros-passos.html`;
}

/**
 * Quanto vale o link que ENTRA, mandado no e-mail de acesso liberado.
 *
 * 7 dias porque o culto é semanal: quem foi aprovado numa quinta-feira à noite
 * precisa conseguir entrar no domingo de manhã. Este prazo é NOSSO
 * (`invites.expires_at`), não o do magic link do Supabase — que é de 1 hora e
 * morreria antes da pessoa abrir a caixa de entrada.
 */
export const DIAS_LINK_ENTRADA = 7;

/**
 * O link que ENTRA: um toque abre a sessão, sem digitar e-mail e sem esperar um
 * segundo e-mail. `token` é `invites.token` — 32 hex com índice único, que
 * existia na tabela desde a migration 0001 e nunca tinha sido usado por nada.
 * Quem valida é `src/app/auth/entrar/[token]/route.ts`.
 */
export function linkDeEntrada(token: string): string {
  return `${siteUrl()}/auth/entrar/${token}`;
}

const BRAND = "Sirvo";

/** Escapa texto vindo do banco antes de injetar no HTML do e-mail. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// E-mail não lê CSS var: a casa vira hexadecimal aqui. Mesmos tons do
// frontmatter do DESIGN.md — creme de parede, creme de carta, linha quente,
// grafite quente, pedra, vinho. O template antigo era cinza-azulado de
// biblioteca: o convite é o PRIMEIRO contato com o app e não parecia com ele.
const C = {
  creme: "#FAF6EA",
  cremeCarta: "#FDFCF7",
  cremeClaro: "#FCF4E8",
  linha: "#E8DEC9",
  grafite: "#372725",
  pedra: "#736459",
  vinho: "#701425",
} as const;

function layout(opts: {
  title: string;
  intro: string;
  /** HTML solto entre a intro e o CTA. Só o digest usa — os outros templates
   *  são um parágrafo e um botão, e não devem virar reféns dele. */
  body?: string;
  cta?: { label: string; href: string };
  /** Link discreto abaixo do CTA — hoje usado pela demo "Primeiros passos". */
  secondary?: { label: string; href: string; note?: string };
  /** Letra miúda no fim do corpo — o plano B de quando o botão não funcionar.
   *  Aceita HTML, igual a `intro`: escape você mesmo o que vier do banco. */
  note?: string;
  footer?: string;
}): string {
  const { title, intro, body, cta, secondary, note, footer } = opts;
  return `
  <div style="margin:0;padding:24px 0;background:${C.creme};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:${C.cremeCarta};border-radius:16px;overflow:hidden;border:1px solid ${C.linha};">
      <div style="padding:20px 28px;border-bottom:1px solid ${C.linha};">
        <span style="font-size:18px;font-weight:700;color:${C.vinho};letter-spacing:-0.01em;">${BRAND}</span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${C.grafite};font-family:Alegreya,Georgia,serif;">${title}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${C.grafite};">${intro}</p>
        ${body ?? ""}
        ${
          cta
            ? `<a href="${cta.href}" style="display:inline-block;background:${C.vinho};color:${C.cremeClaro};text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">${esc(cta.label)}</a>`
            : ""
        }
        ${
          secondary
            ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:${C.pedra};">
                 <a href="${secondary.href}" style="color:${C.vinho};font-weight:600;text-decoration:underline;">${esc(secondary.label)}</a>${
                   secondary.note ? ` — ${esc(secondary.note)}` : ""
                 }
               </p>`
            : ""
        }
        ${
          note
            ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${C.pedra};">${note}</p>`
            : ""
        }
      </div>
      <div style="padding:16px 28px;border-top:1px solid ${C.linha};">
        <p style="margin:0;font-size:12px;line-height:1.5;color:${C.pedra};">${
          footer ?? `Você recebeu este e-mail porque faz parte de uma equipe no ${BRAND}.`
        }</p>
      </div>
    </div>
  </div>`;
}

/**
 * "Seu acesso está liberado" — o ÚNICO e-mail entre a aprovação e a pessoa dentro.
 *
 * `href` não é mais a tela de login: é o link que ENTRA (`linkDeEntrada`). Antes
 * daqui o botão levava a `/entrar`, e a pessoa tinha que digitar o e-mail de novo
 * e esperar um SEGUNDO e-mail pra conseguir passar. A Rayane foi aprovada em
 * 11/ago às 21:19 e abriu OUTRO pedido de entrada às 22:03 — 44 minutos depois de
 * já estar aprovada — porque nada no e-mail dizia que ela já podia entrar.
 * Um e-mail, um toque.
 *
 * O texto não cita Google de propósito: quem chega por aqui é justamente quem
 * não tem Gmail. E não pede senha porque não existe senha pra pedir.
 */
export function conviteEmail(opts: {
  nome: string;
  /** Link que ENTRA (`linkDeEntrada(invite.token)`), nunca `${siteUrl()}/entrar`. */
  href: string;
  /** true = convite direto do admin; false/omitido = aprovação de um pedido. */
  convidado?: boolean;
  /** true = o href leva à tela de login, não é link que entra (convite de admin). */
  semLinkDireto?: boolean;
}): { subject: string; html: string } {
  const nome = opts.nome?.trim() ? esc(opts.nome.trim()) : "Olá";
  const abertura = opts.convidado
    ? `A liderança te convidou pra servir com a gente no <strong>${BRAND}</strong>.`
    : `A liderança aprovou seu pedido e liberou seu acesso ao <strong>${BRAND}</strong>.`;
  const entrar = siteUrl().replace(/^https?:\/\//, "");
  return {
    subject: `${BRAND} — seu acesso está liberado`,
    html: layout({
      title: `${nome}, seu acesso está liberado`,
      intro: opts.semLinkDireto
        ? `${abertura} Abra o Sirvo e informe este mesmo e-mail pra receber seu link de acesso.`
        : `${abertura} Toque no botão abaixo e você já entra — sem criar senha e sem digitar nada.`,
      cta: { label: opts.semLinkDireto ? "Abrir o Sirvo" : "Entrar no Sirvo", href: opts.href },
      secondary: {
        label: "Primeira vez? Veja como funciona",
        href: demoUrl(),
        note: "1 minuto: entrar, confirmar sua escala e acompanhar o culto",
      },
      note: opts.semLinkDireto
        ? undefined
        : `Este link é só seu e vale por ${DIAS_LINK_ENTRADA} dias. Se ele expirar, abra ` +
          `<a href="${siteUrl()}/entrar" style="color:${C.vinho};font-weight:600;">${entrar}/entrar</a> ` +
          `e informe este mesmo e-mail — seu acesso continua liberado.`,
    }),
  };
}

/** Aviso de escalação (canal garantido no iPhone, complementa o sino). */
export function escaladoEmail(opts: {
  evento: string;
  quando: string;
  href: string;
}): { subject: string; html: string } {
  const evento = esc(opts.evento);
  return {
    subject: `${BRAND} — você foi escalado: ${opts.evento}`,
    html: layout({
      title: "Você foi escalado 📅",
      intro: `Você foi escalado para <strong>${evento}</strong>${
        opts.quando ? ` — ${esc(opts.quando)}` : ""
      }. Toque abaixo para confirmar sua presença.`,
      cta: { label: "Ver e confirmar", href: opts.href },
      secondary: {
        label: "Primeira vez? Veja como funciona",
        href: demoUrl(),
        note: "o passo a passo em 1 minuto",
      },
    }),
  };
}

/**
 * O DIGEST DIÁRIO — o único e-mail do Sirvo que é bom quando NÃO chega.
 *
 * Ele existe porque nenhum dos incidentes deste mês precisou ser DETECTADO:
 * todos já eram sabidos pelo sistema no instante em que aconteceram, e foram
 * descartados. O digest é o destino desse conhecimento.
 *
 * A REGRA QUE O MANTÉM ÚTIL: silêncio significa saudável. Se ele chegar todo dia
 * com ruído, em três semanas ninguém abre — e aí é PIOR que não existir, porque
 * cria a sensação de estar coberto. Por isso o cron só manda quando há o que
 * dizer... com uma exceção deliberada, o domingo (ver a rota do cron).
 *
 * Sem CTA de propósito. Cada linha já diz o nome de quem travou e o motivo cru;
 * um botão "ver no app" só somaria um toque entre ler e agir.
 */
export function digestEmail(opts: {
  /** Blocos já prontos. Bloco vazio não deve chegar aqui — filtre antes. */
  blocos: { titulo: string; linhas: string[] }[];
  /** Domingo manda mesmo sem novidade, e aí o e-mail precisa explicar por quê. */
  heartbeat: boolean;
}): { subject: string; html: string } {
  const { blocos, heartbeat } = opts;
  const tudoCerto = blocos.length === 0;

  const body = blocos
    .map(
      (b) =>
        `<p style="margin:18px 0 6px;font-size:14px;font-weight:700;color:${C.grafite};">${esc(b.titulo)}</p>` +
        `<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.65;color:${C.grafite};">` +
        b.linhas.map((l) => `<li style="margin:2px 0;">${esc(l)}</li>`).join("") +
        `</ul>`,
    )
    .join("");

  return {
    subject: tudoCerto
      ? `${BRAND} — tudo certo por aqui`
      : `${BRAND} — ${blocos.length === 1 ? "1 coisa" : `${blocos.length} coisas`} pra olhar`,
    html: layout({
      title: tudoCerto ? "Tudo certo ✅" : "Resumo do dia 🔎",
      intro: tudoCerto
        ? "Nada travado, nenhuma falha registrada nas últimas 24h."
        : "O que o app registrou e que ninguém teria visto de outro jeito:",
      body,
      note: heartbeat
        ? "Este resumo chega <strong>todo domingo</strong> mesmo sem novidade. Se um domingo ele não chegar, quem parou foi o próprio digest — e aí é isso que precisa de olhar."
        : undefined,
      footer: "Você recebe este resumo porque administra o Sirvo.",
    }),
  };
}

/** Lembrete pra quem ainda não confirmou (disparado pelo líder). */
export function lembreteEmail(opts: {
  evento: string;
  quando: string;
  href: string;
}): { subject: string; html: string } {
  const evento = esc(opts.evento);
  return {
    subject: `${BRAND} — confirme sua presença: ${opts.evento}`,
    html: layout({
      title: "Falta você confirmar 🙏",
      intro: `Você ainda não confirmou presença em <strong>${evento}</strong>${
        opts.quando ? ` — ${esc(opts.quando)}` : ""
      }. O líder está contando com você — toque abaixo para confirmar ou avisar que não vai poder.`,
      cta: { label: "Confirmar agora", href: opts.href },
    }),
  };
}
