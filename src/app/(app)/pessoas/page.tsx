import { redirect } from "next/navigation";

// "Pessoas" virou parte do hub "Equipes". Mantém a rota antiga redirecionando.
export default function PessoasPage() {
  redirect("/equipes");
}
