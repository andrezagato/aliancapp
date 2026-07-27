import "server-only";

import { Resend } from "resend";

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
    await resend.emails.send({
      from: fromDefault,
      to: recipients,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    });
  } catch (err) {
    console.error("[email] falha ao enviar:", err);
    /* silencioso de propósito — best-effort */
  }
}

// =============================================================================
// URL pública + templates
// =============================================================================

/** URL pública do app, pra links absolutos em e-mails. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  // Na Vercel esta env vem automática (sem protocolo).
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Demo interativa "Primeiros passos" (estática em `public/`, aberta sem login). */
export function demoUrl(): string {
  return `${siteUrl()}/primeiros-passos.html`;
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

function layout(opts: {
  title: string;
  intro: string;
  cta?: { label: string; href: string };
  /** Link discreto abaixo do CTA — hoje usado pela demo "Primeiros passos". */
  secondary?: { label: string; href: string; note?: string };
  footer?: string;
}): string {
  const { title, intro, cta, secondary, footer } = opts;
  return `
  <div style="margin:0;padding:24px 0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef1;">
      <div style="padding:20px 28px;border-bottom:1px solid #f0f1f3;">
        <span style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.01em;">${BRAND}</span>
      </div>
      <div style="padding:28px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">${title}</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">${intro}</p>
        ${
          cta
            ? `<a href="${cta.href}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">${esc(cta.label)}</a>`
            : ""
        }
        ${
          secondary
            ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">
                 <a href="${secondary.href}" style="color:#111827;font-weight:600;text-decoration:underline;">${esc(secondary.label)}</a>${
                   secondary.note ? ` — ${esc(secondary.note)}` : ""
                 }
               </p>`
            : ""
        }
      </div>
      <div style="padding:16px 28px;border-top:1px solid #f0f1f3;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${
          footer ?? `Você recebeu este e-mail porque faz parte de uma equipe no ${BRAND}.`
        }</p>
      </div>
    </div>
  </div>`;
}

/** Convite pra entrar (resolve o "convite não avisa ninguém"). */
export function conviteEmail(opts: {
  nome: string;
  href: string;
}): { subject: string; html: string } {
  const nome = opts.nome?.trim() ? esc(opts.nome.trim()) : "Olá";
  return {
    subject: `${BRAND} — você foi convidado para servir`,
    html: layout({
      title: `${nome}, você foi convidado! 🙌`,
      intro: `Você foi convidado para servir com a gente no <strong>${BRAND}</strong>. Entre com a sua conta Google (usando este mesmo e-mail) para ver suas escalas e confirmar presença.`,
      cta: { label: "Entrar no Sirvo", href: opts.href },
      secondary: {
        label: "Primeira vez? Veja como funciona",
        href: demoUrl(),
        note: "1 minuto: entrar, confirmar sua escala e acompanhar o culto",
      },
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
