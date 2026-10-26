-- Pegat 5: web d'administració de l'Hortolà
-- L'Hortolà pot llegir totes les famílies i, de cada usuari, només a quina família pertany, els apartats i si ha fet els primers passos (no les converses privades).
drop policy if exists adm_select on public.docs;
create policy adm_select on public.docs for select to authenticated using (
  public.is_hortola() and (
    path like 'families/%'
    or path ~ '^data/users/[^/]+/(meu|apartats|onb)$'
  )
);
-- Llista d'usuaris (correu, alta i darrera entrada), només per a l'Hortolà
create or replace function public.admin_users()
returns table(id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at
  from auth.users u
  where public.is_hortola()
  order by u.created_at
$$;
revoke all on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;
