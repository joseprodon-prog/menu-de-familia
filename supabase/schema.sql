-- Menú de Família · esquema de Supabase
-- Executa-ho una sola vegada a: Supabase → SQL Editor → New query → Run

-- 1. Taula única de documents (mateix model que el prototip: camí + JSON)
create table if not exists public.docs (
  path text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.docs enable row level security;
alter table public.docs replica identity full;

-- 2. Fusió profunda de JSON (com el "update" del prototip)
create or replace function public.jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb language sql immutable as $$
  select case
    when jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
      coalesce((
        select jsonb_object_agg(k,
          case when a ? k and b ? k then public.jsonb_deep_merge(a -> k, b -> k)
               when b ? k then b -> k
               else a -> k end)
        from (select jsonb_object_keys(a) k union select jsonb_object_keys(b)) s
      ), '{}'::jsonb)
    else b end
$$;

-- 3. És membre de la família?
create or replace function public.fam_member(code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.docs
    where path = 'families/' || code
      and (data -> 'membres' ->> auth.uid()::text) = 'true'
  )
$$;

-- 4. Permisos (RLS)
drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select to authenticated using (
  path like 'receptes/%' or path like 'valoracions/%'
  or path like 'data/users/' || auth.uid()::text || '/%'
  or (path like 'families/%' and public.fam_member(split_part(path, '/', 2)))
);

drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (
  path = 'receptes/' || auth.uid()::text
  or path = 'valoracions/' || auth.uid()::text
  or path like 'data/users/' || auth.uid()::text || '/%'
  or (path ~ '^families/[^/]+$' and (data -> 'membres' ->> auth.uid()::text) = 'true')
  or (path ~ '^families/[^/]+/.+' and public.fam_member(split_part(path, '/', 2)))
);

drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated using (
  path = 'receptes/' || auth.uid()::text
  or path = 'valoracions/' || auth.uid()::text
  or path like 'data/users/' || auth.uid()::text || '/%'
  or (path like 'families/%' and public.fam_member(split_part(path, '/', 2)))
) with check (true);

drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated using (
  path = 'receptes/' || auth.uid()::text
  or path like 'data/users/' || auth.uid()::text || '/%'
);

-- 5. Escriptura amb fusió (respecta els permisos de dalt)
create or replace function public.doc_merge(p_path text, p_patch jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into public.docs(path, data) values (p_path, public.jsonb_deep_merge('{}'::jsonb, p_patch))
  on conflict (path) do update
    set data = public.jsonb_deep_merge(public.docs.data, excluded.data),
        updated_at = now(), updated_by = auth.uid();
end $$;

-- 6. Unir-se a una família amb el codi
create or replace function public.join_family(code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  update public.docs
     set data = jsonb_set(data, '{membres}', coalesce(data -> 'membres', '{}'::jsonb) || jsonb_build_object(auth.uid()::text, true)),
         updated_at = now()
   where path = 'families/' || code;
  return found;
end $$;
grant execute on function public.doc_merge(text, jsonb) to authenticated;
grant execute on function public.join_family(text) to authenticated;

-- 7. Temps real
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 8. Fitxers (fotos de receptes i documents)
insert into storage.buckets (id, name, public) values ('assets', 'assets', true)
on conflict (id) do nothing;
drop policy if exists assets_insert on storage.objects;
create policy assets_insert on storage.objects for insert to authenticated with check (bucket_id = 'assets');
drop policy if exists assets_delete on storage.objects;
create policy assets_delete on storage.objects for delete to authenticated using (bucket_id = 'assets' and owner = auth.uid());
