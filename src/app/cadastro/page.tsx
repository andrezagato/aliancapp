import { PedidoEntradaForm } from "@/components/pedido-entrada-form";

/**
 * A página continua existindo — é rota pública antiga (`middleware.ts`) e pode
 * estar em link ou favorito de alguém; um 404 no meio de um onboarding é o pior
 * desfecho possível. Mas ela deixou de ser um DESTINO: quem chega em /entrar e
 * ainda não tem acesso resolve tudo por lá, sem trocar de página. Aqui só mora a
 * moldura; o formulário é o mesmo componente das duas telas.
 */
export default function CadastroPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 py-10">
      <PedidoEntradaForm />
    </main>
  );
}
