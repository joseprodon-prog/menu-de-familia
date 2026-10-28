-- Pegat 13: base de preus compartida del veïnat (anònima)
-- Les famílies que participen al veïnat aporten els preus dels seus tiquets (€/kg, €/l o €/u, botiga i data)
-- i en reben la comparativa. No es mostra mai de quina família és cada preu.
-- «zona»: per ara tot el veïnat és «general»; quan hi hagi veïnats locals, cada document veinat/<uid> portarà la seva zona.
create table if not exists public.preus_com (
  zona text not null,
  art text not null,
  u text not null,
  botiga text not null,
  fh text not null,
  d date not null,
  p numeric(10,3) not null,
  at timestamptz not null default now(),
  primary key (zona, art, u, botiga, fh, d)
);
create index if not exists preus_com_art on public.preus_com (zona, art, d desc);
alter table public.preus_com enable row level security;
-- sense polítiques: només s'hi accedeix des de les funcions

create or replace function public.vei_zona()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(data ->> 'zona', ''), 'general') from public.docs where path = 'veinat/' || auth.uid()::text
$$;

create or replace function public.preus_aporta(p_fh text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v_z text := public.vei_zona(); v_n int := 0; r jsonb;
begin
  if v_z is null or jsonb_typeof(p_rows) <> 'array' then return 0; end if;
  for r in select * from jsonb_array_elements(p_rows) limit 200 loop
    begin
      if (r ->> 'u') not in ('kg', 'l', 'u') or (r ->> 'p')::numeric <= 0 or (r ->> 'p')::numeric > 2000
         or (r ->> 'd')::date > current_date + 1 or (r ->> 'd')::date < current_date - 400 then continue; end if;
      insert into public.preus_com (zona, art, u, botiga, fh, d, p)
      values (v_z, left(r ->> 'art', 60), r ->> 'u', left(r ->> 'b', 40), left(p_fh, 16), (r ->> 'd')::date, round((r ->> 'p')::numeric, 3))
      on conflict (zona, art, u, botiga, fh, d) do update set p = excluded.p, at = now();
      v_n := v_n + 1;
    exception when others then null;
    end;
  end loop;
  delete from public.preus_com where d < current_date - 400;
  return v_n;
end $$;

-- Últim preu de cada botiga (últims 120 dies) per als articles demanats; mitjana de les famílies del mateix dia
create or replace function public.preus_consulta(p_arts text[])
returns table (art text, u text, botiga text, p numeric, d date) language sql stable security definer set search_path = public as $$
  with z as (select public.vei_zona() as zona),
  c as (
    select pc.art, pc.u, pc.botiga, pc.d, avg(pc.p) as p,
           row_number() over (partition by pc.art, pc.u, pc.botiga order by pc.d desc) as rn
    from public.preus_com pc, z
    where z.zona is not null and pc.zona = z.zona and pc.d >= current_date - 120
      and exists (select 1 from unnest(p_arts[1:300]) a where pc.art = a or pc.art like a || ' %' or a like pc.art || ' %' or (length(a) >= 4 and pc.art like '%' || a || '%'))
    group by pc.art, pc.u, pc.botiga, pc.d
  )
  select art, u, botiga, round(p, 3), d from c where rn = 1
$$;
revoke all on function public.preus_aporta(text, jsonb) from public, anon;
revoke all on function public.preus_consulta(text[]) from public, anon;
grant execute on function public.preus_aporta(text, jsonb) to authenticated;
grant execute on function public.preus_consulta(text[]) to authenticated;
