-- Estris nous: peticions d'icona i catàleg públic d'icones
-- estris/pet/<uid>_<nom>: la petició d'un usuari (la llegeix i l'escriu ell; l'Hortolà les veu i les respon totes)
-- estris/cataleg: icones triades pels usuaris, d'ús públic (tothom la llegeix; només s'hi escriu amb estri_tria o l'Hortolà)
drop policy if exists est_select on public.docs;
drop policy if exists est_insert on public.docs;
drop policy if exists est_update on public.docs;
drop policy if exists est_delete on public.docs;
create policy est_select on public.docs for select to authenticated using (
  path = 'estris/cataleg'
  or (path like 'estris/pet/%' and ((data ->> 'uid') = auth.uid()::text or public.is_hortola()))
);
create policy est_insert on public.docs for insert to authenticated with check (
  (path like 'estris/pet/%' and ((data ->> 'uid') = auth.uid()::text or public.is_hortola()))
  or (path = 'estris/cataleg' and public.is_hortola())
);
create policy est_update on public.docs for update to authenticated using (
  (path like 'estris/pet/%' and ((data ->> 'uid') = auth.uid()::text or public.is_hortola()))
  or (path = 'estris/cataleg' and public.is_hortola())
) with check (
  (path like 'estris/pet/%' and ((data ->> 'uid') = auth.uid()::text or public.is_hortola()))
  or (path = 'estris/cataleg' and public.is_hortola())
);
create policy est_delete on public.docs for delete to authenticated using (
  path like 'estris/pet/%' and public.is_hortola()
);

-- L'usuari tria una de les 3 icones: passa al catàleg públic
create or replace function public.estri_tria(p_path text, p_idx int)
returns boolean language plpgsql security definer set search_path = public as $$
declare d jsonb; img text; nom text; k text;
begin
  select data into d from public.docs where path = p_path and path like 'estris/pet/%';
  if d is null or (d ->> 'uid') <> auth.uid()::text or (d ->> 'estat') <> 'proposat' then return false; end if;
  img := d -> 'opcions' ->> p_idx;
  nom := d ->> 'nom';
  if img is null or nom is null then return false; end if;
  if not (img like 'https://whdcdxbfxwfriqoeloql.supabase.co/storage/v1/object/public/assets/%' or img like 'https://menu-de-familia.pages.dev/nova/img/%') then return false; end if;
  k := d ->> 'k';
  insert into public.docs(path, data) values ('estris/cataleg', jsonb_build_object('items', jsonb_build_object(k, jsonb_build_object('nom', nom, 'img', img, 'at', now()))))
  on conflict (path) do update set data = public.jsonb_deep_merge(public.docs.data, excluded.data), updated_at = now();
  update public.docs set data = data || jsonb_build_object('estat', 'triat', 'triada', p_idx, 'triadaAt', now()), updated_at = now() where path = p_path;
  return true;
end $$;
grant execute on function public.estri_tria(text, int) to authenticated;
