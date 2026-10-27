-- Pegat 8: recomanacions entre famílies
-- referits/<uid que recomana>/families/<uid nou>: el nou usuari només pot escriure el seu propi registre;
-- qui recomana només veu els seus; l'Hortolà ho veu tot.
drop policy if exists ref_select on public.docs;
drop policy if exists ref_insert on public.docs;
drop policy if exists ref_update on public.docs;
create policy ref_select on public.docs for select to authenticated using (
  path like 'referits/' || auth.uid()::text || '/%' or (path like 'referits/%' and public.is_hortola())
);
create policy ref_insert on public.docs for insert to authenticated with check (
  path ~ '^referits/[^/]+/families/[^/]+$' and split_part(path, '/', 4) = auth.uid()::text and split_part(path, '/', 2) <> auth.uid()::text
);
create policy ref_update on public.docs for update to authenticated using (
  path ~ '^referits/[^/]+/families/[^/]+$' and split_part(path, '/', 4) = auth.uid()::text
) with check (
  path ~ '^referits/[^/]+/families/[^/]+$' and split_part(path, '/', 4) = auth.uid()::text
);
