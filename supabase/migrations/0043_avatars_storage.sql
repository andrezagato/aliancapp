-- 0043 — bucket de avatares (foto de perfil enviada pela própria pessoa).
--
-- Por que: hoje `profiles.avatar_url` só chega automático pelo metadata do
-- Google. Quem entra por magic link / e-mail não-Gmail nunca tem foto — e a foto
-- é o que faz a equipe reconhecer quem vai servir junto.
--
-- Caminho do arquivo: avatars/<user_id>/<timestamp>.jpg
-- A PRIMEIRA pasta é o id da pessoa: é isso que a policy usa pra garantir que
-- ninguém escreve na foto de outro. O app comprime no navegador antes de subir
-- (~20-50KB), então o free tier cobre a igreja inteira com folga.
--
-- Leitura é PÚBLICA de propósito: o avatar aparece na escala, no chat e no
-- balanço pra igreja toda; URL pública evita signed URL em toda listagem.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Bucket público ainda precisa de policy de SELECT: "public" libera o endpoint
-- /object/public, não a RLS de storage.objects.
drop policy if exists "avatars_read_all" on storage.objects;
create policy "avatars_read_all"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Apagar a própria: o app troca a foto e remove a antiga pra não acumular lixo.
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
