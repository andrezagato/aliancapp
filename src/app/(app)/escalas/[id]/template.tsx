/**
 * O detalhe do evento entra como "push da direita" (translateX 100%→0). Um
 * template re-monta a cada navegação para o segmento, então a animação toca
 * toda vez que se abre uma escala. Modais usam portal no <body>, então o
 * transform temporário deste wrapper não os afeta.
 */
export default function EventoTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-push">{children}</div>;
}
