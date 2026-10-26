-- Bústia de suggeriments (usuaris beta → l'Hortolà)
-- feedback/<uid>: cada usuari llegeix i escriu el seu; l'Hortolà (administrador) els llegeix i respon tots.
create or replace function public.is_hortola() returns boolean language sql stable as $$
  select auth.uid() = '3db65f50-ce4a-4430-a790-4788dc699b3f'::uuid
$$;
drop policy if exists fb_select on public.docs;
drop policy if exists fb_insert on public.docs;
drop policy if exists fb_update on public.docs;
create policy fb_select on public.docs for select to authenticated
  using (path = 'feedback/' || auth.uid()::text or (path like 'feedback/%' and public.is_hortola()));
create policy fb_insert on public.docs for insert to authenticated
  with check (path = 'feedback/' || auth.uid()::text or (path like 'feedback/%' and public.is_hortola()));
create policy fb_update on public.docs for update to authenticated
  using (path = 'feedback/' || auth.uid()::text or (path like 'feedback/%' and public.is_hortola()))
  with check (path = 'feedback/' || auth.uid()::text or (path like 'feedback/%' and public.is_hortola()));
