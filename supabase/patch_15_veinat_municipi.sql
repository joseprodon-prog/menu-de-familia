-- Pegat 15: veïnats per municipi
-- · La zona del veïnat és el municipi de la família (codi INE), desat a veinat/<uid>.zona
-- · Zones addicionals (sembradors): la família les demana i l'Hortolà les aprova a zones/<codi família> = {ext:{<codi INE>:{n,motiu,at}}}
-- · Sense municipi triat, la família no aporta ni rep preus
drop policy if exists zn_select on public.docs;
drop policy if exists zn_insert on public.docs;
drop policy if exists zn_update on public.docs;
create policy zn_select on public.docs for select to authenticated
  using (path like 'zones/%' and (public.is_hortola() or public.fam_member(split_part(path, '/', 2))));
create policy zn_insert on public.docs for insert to authenticated with check (path like 'zones/%' and public.is_hortola());
create policy zn_update on public.docs for update to authenticated
  using (path like 'zones/%' and public.is_hortola()) with check (path like 'zones/%' and public.is_hortola());

-- zona principal (municipi de la família)
create or replace function public.vei_zona()
returns text language sql stable security definer set search_path = public as $$
  select nullif(data ->> 'zona', '') from public.docs where path = 'veinat/' || auth.uid()::text
$$;

-- totes les zones que pot consultar: la principal + les addicionals aprovades
create or replace function public.vei_zones()
returns text[] language sql stable security definer set search_path = public as $$
  with v as (select data from public.docs where path = 'veinat/' || auth.uid()::text)
  select case when (select nullif(data ->> 'zona', '') from v) is null then null else
    array(select (select data ->> 'zona' from v)
          union
          select jsonb_object_keys(coalesce(z.data -> 'ext', '{}'::jsonb))
          from public.docs z where z.path = 'zones/' || (select data ->> 'code' from v))
  end
$$;

create or replace function public.preus_consulta(p_arts text[])
returns table (art text, u text, botiga text, p numeric, d date) language sql stable security definer set search_path = public as $$
  with z as (select public.vei_zones() as zs),
  c as (
    select pc.art, pc.u, pc.botiga, pc.d, avg(pc.p) as p,
           row_number() over (partition by pc.art, pc.u, pc.botiga order by pc.d desc) as rn
    from public.preus_com pc, z
    where z.zs is not null and pc.zona = any(z.zs) and pc.d >= current_date - 120
      and exists (select 1 from unnest(p_arts[1:300]) a where pc.art = a or pc.art like a || ' %' or a like pc.art || ' %' or (length(a) >= 4 and pc.art like '%' || a || '%'))
    group by pc.art, pc.u, pc.botiga, pc.d
  )
  select art, u, botiga, round(p, 3), d from c where rn = 1
$$;

create or replace function public.vei_info()
returns json language sql stable security definer set search_path = public as $$
  with z as (select public.vei_zones() as zs, public.vei_zona() as zona),
  ult as (
    select pc.art, pc.u, pc.botiga, avg(pc.p) as p,
           row_number() over (partition by pc.art, pc.u, pc.botiga order by pc.d desc) as rn
    from public.preus_com pc, z where z.zs is not null and pc.zona = any(z.zs) and pc.d >= current_date - 120
    group by pc.art, pc.u, pc.botiga, pc.d
  ),
  l as (select * from ult where rn = 1),
  guanya as (
    select botiga from (
      select art, u, botiga, rank() over (partition by art, u order by p) as rk, count(*) over (partition by art, u) as nb
      from l) x where rk = 1 and nb > 1
  )
  select case when (select zona from z) is null then null else json_build_object(
    'zona', (select zona from z),
    'zones', (select zs from z),
    'families', (select count(distinct coalesce(nullif(d.data ->> 'code', ''), d.path)) from public.docs d
                 where d.path like 'veinat/%' and d.data ->> 'zona' = (select zona from z)),
    'preus30', (select count(*) from public.preus_com pc, z where pc.zona = any(z.zs) and pc.d >= current_date - 30),
    'articles', (select count(distinct art) from l),
    'botigues', (select coalesce(json_agg(json_build_object('b', botiga, 'n', n) order by n desc), '[]'::json)
                 from (select botiga, count(*) n from l group by botiga order by n desc limit 6) b),
    'barates', (select coalesce(json_agg(json_build_object('b', botiga, 'n', n) order by n desc), '[]'::json)
                from (select botiga, count(*) n from guanya group by botiga order by n desc limit 4) g)
  ) end
$$;
revoke all on function public.vei_zones() from public, anon;
grant execute on function public.vei_zones() to authenticated;
