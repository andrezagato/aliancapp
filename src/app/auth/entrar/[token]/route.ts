import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarFalha } from "@/lib/failure-log";

/**
 * O LINK QUE ENTRA. Um toque no botão do e-mail de acesso liberado e a pessoa
 * está dentro — sem digitar o e-mail de novo e sem esperar um segundo e-mail.
 *
 * Como funciona:
 *   1) acha o convite pelo `token` (32 hex de `invites.token`, coluna que existia
 *      desde a 0001 e nunca tinha sido usada). Precisa de service-role: a RLS de
 *      `invites` só responde pra admin e líder, e aqui não há ninguém logado;
 *   2) gera um token de login AGORA, na hora do clique;
 *   3) consome esse token NO SERVIDOR com `verifyOtp`, e o @supabase/ssr grava a
 *      sessão nos cookies da resposta — mesmo mecanismo do /auth/callback, que já
 *      roda em produção com `exchangeCodeForSession`.
 *
 * POR QUE GERAR NO CLIQUE E NÃO NA APROVAÇÃO — as três razões, em ordem de dor:
 *   • validade: gerado na aprovação, o link herdaria a validade do magic link do
 *     Supabase (1 hora hoje) e morreria antes da pessoa abrir a caixa de entrada.
 *     Gerado aqui, quem manda no prazo é `invites.expires_at`, que é nosso;
 *   • antivírus e o pré-visualizador de link do Outlook abrem o link ANTES da
 *     pessoa. Um magic link comum seria queimado por eles e ela encontraria um
 *     link morto. O token do convite não se gasta: cada abertura gera um token de
 *     login novo;
 *   • sem `redirectTo`, a allow-list de Redirect URLs do dashboard deixa de ser
 *     um jeito silencioso de quebrar isso.
 *
 * POR QUE `magiclink` E NUNCA `invite`: `magiclink` é o único tipo que serve nos
 * dois casos. Se o e-mail já tem conta em auth.users, o GoTrue gera um magic
 * link; se não tem, ele troca sozinho para `signup` e cria a conta. Já `invite`
 * devolve 422 ("User with email already exists") em quem tem conta confirmada —
 * e a maior parte da igreja tem, porque entrou pelo Google. Por isso o tipo do
 * verifyOtp vem de `verification_type`, que é o que o GoTrue REALMENTE usou, e
 * nunca de um literal fixo: token de magiclink mora em `recovery_token`, token
 * de signup em `confirmation_token`, e trocar os dois derruba o login.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { origin, searchParams } = new URL(request.url);
  const trocar = searchParams.get("trocar") === "1";
  const { token } = await params;
  // Nenhuma recusa é beco sem saída: todas caem no campo de e-mail de /entrar,
  // que é o plano B escrito na letra miúda do próprio e-mail. E nenhuma é muda:
  // o convite do Tiago foi recusado em silêncio por 5 dias, e o app sabia
  // exatamente por quê ("cancelado", "sem prazo") — essa resposta morria aqui,
  // dentro do redirect. `porque` é o que sobrevive; `motivo` é só o que a
  // pessoa lê na tela.
  const recusa = async (motivo: string, porque: string, quem?: string | null) => {
    // AGUARDADO, não `void`. Numa função da Vercel a instância pode ser congelada
    // assim que a resposta sai — e sob tráfego baixo (uma igreja de 51 pessoas,
    // 19h de um sábado) a promise pendurada simplesmente some. O gravador
    // perderia preferencialmente o PRIMEIRO evento de cada incidente, que é
    // justamente o que se quer registrar. O banco responde em 25-70ms, num
    // caminho que acabou de fazer round-trip no GoTrue: o custo é ruído.
    await registrarFalha({
      kind: "convite_link",
      detail: `${motivo}: ${porque}`,
      subject: quem ?? null,
      origem: "/auth/entrar/[token]",
    });
    return NextResponse.redirect(`${origin}/entrar?link=${motivo}`);
  };

  const admin = createAdminClient();
  // Aqui a falta de service-role FECHA a porta — ao contrário de
  // `verificarEmailParaLink`, que libera. Esta é a única rota que abre sessão sem
  // senha: sem conferir o convite, ela aceitaria qualquer token chutado.
  if (!admin) {
    console.error("[entrada] SUPABASE_SERVICE_ROLE_KEY ausente — link de entrada desligado.");
    return recusa("indisponivel", "SUPABASE_SERVICE_ROLE_KEY ausente");
  }

  const { data: convite } = await admin
    .from("invites").select("email, status, expires_at, system_role").eq("token", token).maybeSingle();

  if (!convite) return recusa("invalido", "nenhum convite com este token");
  if (convite.status === "cancelado" || convite.status === "expirado") {
    return recusa("invalido", `convite ${convite.status}`, convite.email);
  }

  // `expires_at` só começou a ser preenchido NESTA mudança. Os 38 convites que já
  // estão no banco têm prazo NULL e um token válido — e um `&&` otimista faria
  // NULL virar "não expira nunca": 26 logins sem senha, eternos, um deles de um
  // admin. Sem prazo, o convite não é deste desenho; e o que não é deste desenho
  // não abre porta.
  if (!convite.expires_at) return recusa("invalido", "convite sem prazo (anterior a 16/08)", convite.email);
  if (new Date(convite.expires_at).getTime() < Date.now()) {
    return recusa("expirado", `venceu em ${convite.expires_at}`, convite.email);
  }
  // ESCALADA DE PRIVILÉGIO — a trava que faltava.
  //
  // A regra "só primeiro acesso" (mais abaixo) impede reusar este link contra
  // conta EXISTENTE. Ela não cobre o convite de ADMIN pra um e-mail que ainda
  // NÃO tem conta: ali o GoTrue devolve 'signup', a trava deixa passar, e o
  // `handle_new_user` provisiona o perfil com o `system_role` do convite.
  //
  // Some a isso a policy `invites_read_leader`, que é SELECT pra qualquer líder,
  // sem escopo de igreja e sem esconder a coluna `token`: qualquer um dos 13
  // líderes lê o token de um convite de admin pendente com a chave anônima,
  // abre esta rota com `?trocar=1` (que desloga a sessão dele) e sai admin.
  // A janela abria por 7 dias a cada admin convidado.
  //
  // Aqui é o lugar certo de fechar, porque é AQUI que o resgate acontece —
  // fechar só na leitura dependeria de estreitar uma policy que outras telas
  // usam. Admin entra pelo caminho que exige a caixa de entrada dele.
  if (convite.system_role === "admin") {
    return recusa("ja_tem_conta", "convite de admin não abre sessão por link", convite.email);
  }

  // Status 'aceito' continua valendo de propósito: o link pode ter sido aberto
  // por um antivírus (que já casou o convite) antes da pessoa tocar nele. Quem
  // limita é o prazo, não o status — senão a pessoa acha um link morto.

  // Já logado? Trocar de conta calado é o pior desfecho: quem abre o e-mail só
  // pra conferir se o botão funciona perderia a própria sessão sem ver nada na
  // tela. E mandar pra /entrar não resolve — o middleware expulsa de lá quem
  // está logado, então o recado nunca seria lido.
  const supabase = await createClient();
  const { data: { user: atual } } = await supabase.auth.getUser();
  if (atual?.email && atual.email.toLowerCase() !== convite.email.toLowerCase()) {
    if (!trocar) return NextResponse.redirect(`${origin}/auth/entrar/${token}/confirmar`);
    await supabase.auth.signOut();
  }
  // Mesma pessoa que já está logada: não há nada a fazer além de seguir.
  if (atual?.email && atual.email.toLowerCase() === convite.email.toLowerCase()) {
    return NextResponse.redirect(`${origin}/inicio`);
  }

  const { data: gerado, error: erroLink } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: convite.email,
  });
  if (erroLink || !gerado?.properties) {
    console.error("[entrada] generateLink falhou:", erroLink?.message);
    return recusa("falhou", `generateLink: ${erroLink?.message ?? "sem detalhe"}`, convite.email);
  }

  // O GoTrue troca 'magiclink' por 'signup' quando o e-mail ainda não tem conta.
  // Estreitar aqui, em vez de dar `as EmailOtpType`, é o que garante que um tipo
  // inesperado vire uma recusa educada e não um erro cru na cara da pessoa.
  const tipo = gerado.properties.verification_type;

  // SÓ PRIMEIRO ACESSO — este link nunca abre sessão de conta que já existe.
  //
  // `invites` é gravável E legível por QUALQUER líder direto no PostgREST
  // (policies `invites_insert_leader` / `invites_read_leader` — a de leitura nem
  // é escopada por igreja e não esconde a coluna `token`). O gate "só admin
  // convida" mora no `criarConvite`, não no banco. Então, se `invites.token`
  // virasse credencial de uma conta EXISTENTE, um líder criaria um convite com o
  // e-mail do admin, leria o token e entraria como ele — 13 pessoas com esse
  // poder, hoje.
  //
  // Enquanto o link só serve pra conta que ainda NÃO existe, forjar convite não
  // dá acesso a ninguém: cria uma conta vazia, que é exatamente o que o convite
  // já faz. Quem já tem conta segue pelo caminho normal (Google, ou o link de 1h
  // do /entrar), que exige a caixa de entrada dela.
  //
  // 'signup' é o que o GoTrue devolve quando o e-mail ainda não tem conta; se
  // ele devolver 'magiclink', a conta existe.
  if (tipo !== "signup") {
    if (tipo !== "magiclink") console.error("[entrada] verification_type inesperado:", tipo);
    return recusa("ja_tem_conta", `verification_type=${tipo}`, convite.email);
  }

  const { error: erroVerify } = await supabase.auth.verifyOtp({
    type: tipo,
    token_hash: gerado.properties.hashed_token,
  });
  if (erroVerify) {
    console.error("[entrada] verifyOtp falhou:", erroVerify.message);
    return recusa("falhou", `verifyOtp: ${erroVerify.message}`, convite.email);
  }

  // /inicio: o layout de (app) decide entre a home e /aguardando conforme o
  // status do perfil, que é onde essa decisão já mora.
  return NextResponse.redirect(`${origin}/inicio`);
}
