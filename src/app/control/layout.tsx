import { redirect } from "next/navigation";
import { getSession, isActive } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Layout próprio da sala de controle: sem barra de navegação, sem coluna de
 * 520px, sem rolagem de página. Fica FORA do grupo (app) justamente por isso —
 * o app é um celular na mão do voluntário, isto aqui é um monitor 16:9 preso na
 * parede da régia.
 *
 * A rota não é pública: o middleware exige sessão, e aqui repetimos a checagem
 * de conta ativa que o (app) faz.
 */
export const metadata = { title: "Régia · Sirvo" };

export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/entrar");
  if (!isActive(session.profile)) redirect("/aguardando");
  return <ToastProvider>{children}</ToastProvider>;
}
