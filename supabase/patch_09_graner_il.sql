-- Pegat 9: il·lustracions del Graner (graner/il = {items:{<clau recepta>: <id imatge>}})
-- Tothom amb sessió les veu; només l'Hortolà les escriu.
drop policy if exists graner_select on public.docs;
drop policy if exists graner_insert on public.docs;
drop policy if exists graner_update on public.docs;
create policy graner_select on public.docs for select to authenticated using (path like 'graner/%');
create policy graner_insert on public.docs for insert to authenticated with check (path like 'graner/%' and public.is_hortola());
create policy graner_update on public.docs for update to authenticated using (path like 'graner/%' and public.is_hortola()) with check (path like 'graner/%' and public.is_hortola());
