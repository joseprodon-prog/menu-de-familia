-- Pegat 10: límit diari d'ús del Capità (Claude i Gemini) per usuari
-- Les funcions «llegeix» i «dibuixa» criden ia_compta() abans de cada petició. L'Hortolà no té límit.
create table if not exists public.ia_us (
  uid uuid not null,
  dia date not null default current_date,
  fn text not null,
  n int not null default 0,
  primary key (uid, dia, fn)
);
alter table public.ia_us enable row level security;
-- sense polítiques: ningú hi accedeix directament, només a través de la funció

create or replace function public.ia_compta(p_fn text, p_lim int)
returns json language plpgsql security definer set search_path = public as $$
declare v_n int; v_h boolean;
begin
  if auth.uid() is null then return json_build_object('ok', false, 'n', 0, 'h', false); end if;
  v_h := public.is_hortola();
  insert into public.ia_us (uid, dia, fn, n) values (auth.uid(), current_date, left(p_fn, 20), 1)
  on conflict (uid, dia, fn) do update set n = public.ia_us.n + 1
  returning n into v_n;
  delete from public.ia_us where dia < current_date - 60;
  return json_build_object('ok', v_h or v_n <= p_lim, 'n', v_n, 'h', v_h);
end $$;
revoke all on function public.ia_compta(text, int) from public, anon;
grant execute on function public.ia_compta(text, int) to authenticated;
