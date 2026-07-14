// Formatação de datas em pt-BR no fuso da igreja.
// Single-church no MVP -> fuso fixo. Quando virar multi-igreja, passar o tz do
// registro `churches.timezone` pra estas funções.

export const CHURCH_TZ = "America/Sao_Paulo";

function fmt(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: CHURCH_TZ, ...opts }).format(d);
}

/** "domingo, 19 de julho" */
export function fmtEventDate(iso: string | null | undefined): string {
  return fmt(iso, { weekday: "long", day: "numeric", month: "long" });
}

/** Data (YYYY-MM-DD) do instante no fuso da igreja — casa com colunas DATE. */
export function churchDateISO(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHURCH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** "19/07" a partir de uma data YYYY-MM-DD (sem escorregar de fuso). */
export function fmtRangeDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return d && m ? `${d}/${m}` : dateStr;
}

/** "19 de julho de 2026" */
export function fmtDateFull(iso: string | null | undefined): string {
  return fmt(iso, { day: "numeric", month: "long", year: "numeric" });
}

/** "18:00" */
export function fmtTime(iso: string | null | undefined): string {
  return fmt(iso, { hour: "2-digit", minute: "2-digit" });
}

/** "dom" */
export function fmtWeekdayShort(iso: string | null | undefined): string {
  return fmt(iso, { weekday: "short" }).replace(".", "");
}

/** "19 jul" */
export function fmtDayMonthShort(iso: string | null | undefined): string {
  return fmt(iso, { day: "2-digit", month: "short" }).replace(".", "");
}

/** "domingo, 19 de julho · 18h00" (título de evento) */
export function fmtEventWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = fmtEventDate(iso);
  const time = fmtTime(iso);
  return `${date} · ${time}`;
}

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

/** weekday numérico (0=domingo) -> nome */
export function weekdayName(n: number | null | undefined): string {
  if (n == null || n < 0 || n > 6) return "";
  return WEEKDAYS[n];
}

/** Idade a partir da data de nascimento (YYYY-MM-DD). */
export function fmtBirthday(birthDate: string | null | undefined): string {
  if (!birthDate) return "";
  // birth_date é DATE puro; formata dia/mês sem escorregar de fuso.
  const [, m, d] = birthDate.split("-").map(Number);
  const meses = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  if (!m || !d) return "";
  return `${String(d).padStart(2, "0")} ${meses[m - 1]}`;
}
