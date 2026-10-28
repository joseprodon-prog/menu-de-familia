-- Pegat 11: el Capità Enciam es renova cada 5 hores (substitueix el límit diari del pegat 10)
-- Cada usuari té una finestra de 5 h per a cada ús, que comença amb la primera consulta. L'Hortolà no té límit.
drop table if exists public.ia_us;
create table if not exists public.ia_cap (
  uid uuid not null,
  fn text not null,
  ini timestamptz not null default now(),
  n int not null default 0,
  primary key (uid, fn)
);
alter table public.ia_cap enable row level security;
-- sense polítiques: ningú hi accedeix directament, només a través de la funció

create or replace function public.ia_compta(p_fn text, p_lim int)
returns json language plpgsql security definer set search_path = public as $$
declare v_n int; v_ini timestamptz; v_h boolean;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'n', 0, 'h', false); end if;
  v_h := public.is_hortola();
  insert into public.ia_cap (uid, fn, ini, n) values (auth.uid(), left(p_fn, 20), now(), 1)
  on conflict (uid, fn) do update set
    n   = case when public.ia_cap.ini < now() - interval '5 hours' then 1 else public.ia_cap.n + 1 end,
    ini = case when public.ia_cap.ini < now() - interval '5 hours' then now() else public.ia_cap.ini end
  returning n, ini into v_n, v_ini;
  return json_build_object('ok', v_h or v_n <= p_lim, 'n', v_n, 'h', v_h,
    'fins', to_char((v_ini + interval '5 hours') at time zone 'Europe/Madrid', 'HH24:MI'));
end $$;
revoke all on function public.ia_compta(text, int) from public, anon;
grant execute on function public.ia_compta(text, int) to authenticated;
