import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/supabase/server";

export default async function RootPage() {
  const user = await getOptionalUser();
  redirect(user ? "/inicio" : "/entrar");
}
