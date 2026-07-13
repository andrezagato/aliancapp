import { redirect } from "next/navigation";
import { getSession, isActive } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/entrar");
  redirect(isActive(session.profile) ? "/inicio" : "/aguardando");
}
