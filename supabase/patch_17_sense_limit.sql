-- Pegat 17: comptes sense límit de consultes al Capità (llegeix i dibuixa)
-- En Josep (joseprodon@gmail.com) pot fer totes les consultes que vulgui. L'Hortolà continua sense límit.
create table if not exists public.ia_lliures (uid uuid primary key);
alter table public.ia_lliures enable row level security;
-- sense polítiques: ningú hi accedeix directament, només a través de la funció

insert into public.ia_lliures (uid)
select id from auth.users where lower(email) = 'joseprodon@gmail.com'
on conflict do nothing;

create or replace function public.ia_compta(p_fn text, p_lim int)
returns json language plpgsql security definer set search_path = public as $$
declare v_n int; v_ini timestamptz; v_h boolean; v_l boolean;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'n', 0, 'h', false); end if;
  v_h := public.is_hortola();
  v_l := v_h or exists (select 1 from public.ia_lliures where uid = auth.uid());
  insert into public.ia_cap (uid, fn, ini, n) values (auth.uid(), left(p_fn, 20), now(), 1)
  on conflict (uid, fn) do update set
    n   = case when public.ia_cap.ini < now() - interval '5 hours' then 1 else public.ia_cap.n + 1 end,
    ini = case when public.ia_cap.ini < now() - interval '5 hours' then now() else public.ia_cap.ini end
  returning n, ini into v_n, v_ini;
  return json_build_object('ok', v_l or v_n <= p_lim, 'n', v_n, 'h', v_h,
    'fins', to_char((v_ini + interval '5 hours') at time zone 'Europe/Madrid', 'HH24:MI'));
end $$;
revoke all on function public.ia_compta(text, int) from public, anon;
grant execute on function public.ia_compta(text, int) to authenticated;
