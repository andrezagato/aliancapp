// Um template.tsx remonta a cada navegação → replay grátis da animação de
// entrada ao trocar de aba (Início/Escalas/Cronograma/Equipes/Perfil).
// `page-in` termina em `transform: none` pra não criar containing-block pro
// header reativo; o Modal já usa portal no <body>. A rota `notificacoes` mantém
// seu template.tsx próprio (animate-push), que aninha por baixo deste.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
