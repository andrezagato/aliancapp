/**
 * Notificações entram como "push da direita" (acionadas pelo sino). Ver o
 * template do detalhe do evento para a mesma técnica.
 */
export default function NotificacoesTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-push">{children}</div>;
}
