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
 *     pessoa. Um magic link comum seria QUEIMADO por eles e ela encontraria um
 *     link morto. O token do convite não se gasta: cada abertura gera um token
 *     de login novo.
 *
 *     RESSALVA MEDIDA EM 23/08, porque este parágrafo prometia demais: o token
 *     de fato não se gasta, mas a PRIMEIRA abertura cria a conta em
 *     `auth.users`, e a regra "só primeiro acesso" (mais abaixo) recusa todas as
 *     seguintes com `ja_tem_conta`. Ou seja, se um scanner abrir antes, a pessoa
 *     é mandada pro campo de e-mail em vez de entrar direto.
 *
 *     Não é beco — o campo de e-mail resolve, e o segundo clique NO MESMO
 *     navegador cai na checagem de sessão logo abaixo e vai pro /inicio. E a
 *     regra não pode ser afrouxada: qualquer líder lê `invites.token` no banco
 *     (`invites_read_leader`), então token que abre conta EXISTENTE é escalada.
 *     O conserto de verdade é estreitar aquela policy, não esta rota;
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
    .from("invites").select("email, status, expires_at, system_role, church_id").eq("token", token).maybeSingle();

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
  // ESCALADA DE PRIVILÉGIO — e a primeira versão desta trava conferia a LINHA
  // ERRADA, o que é pior que não ter trava, porque parecia resolvido.
  //
  // Ela olhava `convite.system_role` do convite casado pelo TOKEN. Só que quem
  // escreve `profiles.system_role` é o trigger `handle_new_user`, e ele casa
  // por E-MAIL, pegando o mais ANTIGO pendente:
  //
  //     where lower(email) = lower(new.email) and status = 'pendente'
  //     order by created_at limit 1
  //
  // São duas linhas diferentes, e nada impede duas pendentes pro mesmo e-mail —
  // não há índice único em `invites.email`. Então: você convida alguém como
  // admin; um líder insere o convite DELE pro mesmo e-mail como `member`
  // (`invites_insert_leader` aceita), lê o próprio token (`invites_read_leader`
  // é SELECT pra qualquer líder e não esconde a coluna) e abre esta rota. A
  // trava olhava o convite `member` dele e deixava passar; o trigger casava por
  // e-mail, pegava o de ADMIN, e provisionava o perfil como admin.
  //
  // A trava certa pergunta o que o TRIGGER vai encontrar, não o que o token
  // aponta: existe QUALQUER convite de admin pendente pra este e-mail? Se
  // existe, esta rota não abre sessão pra ele de jeito nenhum. Admin entra pelo
  // caminho que exige a caixa de entrada dele.
  // Busca TODOS os convites de admin pendentes (são pouquíssimos — no limite,
  // um por admin que você esteja convidando) e compara em JS.
  //
  // Sem `.ilike` de propósito: ele trata `_` e `%` como CURINGA, e `_` é
  // caractere legal em e-mail. `joao_silva@gmail.com` casaria com
  // `joaoXsilva@...` e a rota recusaria alguém legítimo — bug que ninguém
  // diagnostica ("meu link não abre e o do meu irmão abre"). O `actions.ts` tem
  // um `comoTexto` que escapa isso; aqui a lista é pequena o bastante pra não
  // precisar de curinga nenhum, que é melhor que escapar direito.
  const { data: adminsPendentes, error: erroAdmins } = await admin
    .from("invites")
    .select("email")
    // Mesma igreja do convite que está sendo resgatado. O cliente aqui é
    // SERVICE-ROLE, então sem isto ele enxerga convite de admin de qualquer
    // igreja — e os dois guardas gêmeos escritos nesta branch (`actions.ts`) já
    // são escopados. Falha fechado de qualquer jeito, mas com uma segunda
    // igreja isto bloquearia gente legítima. Latente hoje, bomba amanhã.
    .eq("church_id", convite.church_id)
    .eq("status", "pendente")
    .eq("system_role", "admin");

  // FALHA FECHADO. Sem este `if`, `data` nulo por erro de query virava `?? []`,
  // o `.some()` dava falso, e a rota seguia pro `generateLink` — ou seja, um
  // timeout de 8s do `authenticator`, um 5xx do PostgREST ou uma service-role
  // key inválida DESLIGAVAM a única trava de escalada desta rota, em silêncio.
  //
  // E é a única mesmo: `generateLink` já cria a linha em `auth.users`, então o
  // `handle_new_user` dispara ANTES do `verifyOtp`. Não há segunda chance depois.
  //
  // Mesma doutrina do `if (!admin)` lá em cima: esta é a rota que abre sessão
  // sem senha, e aqui não saber é motivo pra não abrir.
  if (erroAdmins) {
    console.error("[entrada] não consegui conferir convites de admin:", erroAdmins.message);
    return recusa("falhou", `checagem de convite admin falhou: ${erroAdmins.message}`, convite.email);
  }

  // `invites.email` é canônico por constraint desde a 0058 (minúsculo, sem
  // espaço, ASCII), então esta comparação e a do `handle_new_user` são a mesma
  // sobre os mesmos bytes. O `trim().toLowerCase()` fica como cinto: ele só
  // aperta, nunca afrouxa.
  const alvo = convite.email.trim().toLowerCase();
  if ((adminsPendentes ?? []).some((a) => (a.email ?? "").trim().toLowerCase() === alvo)) {
    return recusa("ja_tem_conta", "há convite de admin pendente para este e-mail", convite.email);
  }

  // DÍVIDA CONSCIENTE, registrada porque some da vista: mesmo com a trava acima,
  // o trigger continua consumindo o convite MAIS ANTIGO por e-mail, que pode não
  // ser o do token usado. Entre dois convites `member` isso não muda privilégio
  // — muda só quais equipes entram no `invite_teams` aplicado. Tornar a seleção
  // do trigger determinística é conserto de outro dia; mexer num trigger de
  // `auth.users` no fim de uma sessão longa é como se quebra login pra todo mundo.

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
