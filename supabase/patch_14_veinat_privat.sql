-- Pegat 14: el veïnat deixa de ser un rànquing públic
-- · veinat/<uid>: cada usuari veu només el seu document; l'Hortolà els veu tots (rànquing d'activitat per repartir regals)
-- · regals/<codi família>: l'Hortolà hi anota espigues de regal; els membres de la família les veuen
-- · vei_info(): dades agregades i anònimes del veïnat per a les famílies que hi participen
drop policy if exists vn_select on public.docs;
drop policy if exists vn_delete on public.docs;
create policy vn_select on public.docs for select to authenticated
  using (path = 'veinat/' || auth.uid()::text or (path like 'veinat/%' and public.is_hortola()));
create policy vn_delete on public.docs for delete to authenticated using (path = 'veinat/' || auth.uid()::text);

drop policy if exists rg_select on public.docs;
drop policy if exists rg_insert on public.docs;
drop policy if exists rg_update on public.docs;
create policy rg_select on public.docs for select to authenticated
  using (path like 'regals/%' and (public.is_hortola() or public.fam_member(split_part(path, '/', 2))));
create policy rg_insert on public.docs for insert to authenticated with check (path like 'regals/%' and public.is_hortola());
create policy rg_update on public.docs for update to authenticated
  using (path like 'regals/%' and public.is_hortola()) with check (path like 'regals/%' and public.is_hortola());

create or replace function public.vei_info()
returns json language sql stable security definer set search_path = public as $$
  with z as (select public.vei_zona() as zona),
  ult as (
    select pc.art, pc.u, pc.botiga, avg(pc.p) as p,
           row_number() over (partition by pc.art, pc.u, pc.botiga order by pc.d desc) as rn
    from public.preus_com pc, z where z.zona is not null and pc.zona = z.zona and pc.d >= current_date - 120
    group by pc.art, pc.u, pc.botiga, pc.d
  ),
  l as (select * from ult where rn = 1),
  guanya as (
    select botiga from (
      select art, u, botiga, rank() over (partition by art, u order by p) as rk,
             count(*) over (partition by art, u) as nb
      from l) x where rk = 1 and nb > 1
  )
  select case when (select zona from z) is null then null else json_build_object(
    'zona', (select zona from z),
    'families', (select count(distinct coalesce(nullif(d.data ->> 'fh', ''), d.path)) from public.docs d
                 where d.path like 'veinat/%' and coalesce(nullif(d.data ->> 'zona', ''), 'general') = (select zona from z)),
    'preus30', (select count(*) from public.preus_com pc, z where pc.zona = z.zona and pc.d >= current_date - 30),
    'articles', (select count(distinct art) from l),
    'botigues', (select coalesce(json_agg(json_build_object('b', botiga, 'n', n) order by n desc), '[]'::json)
                 from (select botiga, count(*) n from l group by botiga order by n desc limit 6) b),
    'barates', (select coalesce(json_agg(json_build_object('b', botiga, 'n', n) order by n desc), '[]'::json)
                from (select botiga, count(*) n from guanya group by botiga order by n desc limit 4) g)
  ) end
$$;
revoke all on function public.vei_info() from public, anon;
grant execute on function public.vei_info() to authenticated;
