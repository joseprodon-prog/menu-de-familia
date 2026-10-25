-- Pegat 1: permet llegir la fila d'una família nova en crear-la (necessari per a l'upsert)
drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select to authenticated using (
  path like 'receptes/%' or path like 'valoracions/%'
  or path like 'data/users/' || auth.uid()::text || '/%'
  or (path ~ '^families/[^/]+$' and (data -> 'membres' ->> auth.uid()::text) = 'true')
  or (path like 'families/%' and public.fam_member(split_part(path, '/', 2)))
);
