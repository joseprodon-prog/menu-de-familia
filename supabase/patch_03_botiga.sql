-- Botiga d'El Sortidor: catàleg (tothom llegeix, només l'Hortolà escriu) i comandes (cada usuari les seves; l'Hortolà totes)
drop policy if exists bt_select on public.docs;
drop policy if exists bt_insert on public.docs;
drop policy if exists bt_update on public.docs;
create policy bt_select on public.docs for select to authenticated
  using (path like 'botiga/%' or path = 'comandes/' || auth.uid()::text or (path like 'comandes/%' and public.is_hortola()));
create policy bt_insert on public.docs for insert to authenticated
  with check ((path like 'botiga/%' and public.is_hortola()) or path = 'comandes/' || auth.uid()::text or (path like 'comandes/%' and public.is_hortola()));
create policy bt_update on public.docs for update to authenticated
  using ((path like 'botiga/%' and public.is_hortola()) or path = 'comandes/' || auth.uid()::text or (path like 'comandes/%' and public.is_hortola()))
  with check ((path like 'botiga/%' and public.is_hortola()) or path = 'comandes/' || auth.uid()::text or (path like 'comandes/%' and public.is_hortola()));
