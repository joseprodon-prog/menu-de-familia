-- Pegat 7: l'Hortolà passa a ser el compte hortola@grupfilomena.com
-- (cal haver creat abans el compte entrant a /admin amb «Crea el compte»)
do $$
declare u uuid;
begin
  select id into u from auth.users where lower(email) = 'hortola@grupfilomena.com';
  if u is null then
    raise exception 'Primer crea el compte hortola@grupfilomena.com a menu-de-familia.pages.dev/admin';
  end if;
  execute format(
    'create or replace function public.is_hortola() returns boolean language sql stable as %L',
    format('select auth.uid() = %L::uuid', u)
  );
end $$;
grant execute on function public.is_hortola() to authenticated;

-- Llista de convidats: l'Hortolà amb el correu nou i en Josep com a usuari normal de Rodon Aymar
update public.docs
set data = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(data, '{items,hortola,correu}', '"hortola@grupfilomena.com"'),
      '{items,hortola,familia}', '""'),
    '{items,hortola,notes}', '"Compte d''administrador (web /admin)."'),
  '{items,joseprodon}',
  '{"nom":"Josep Rodon","correu":"joseprodon@gmail.com","telefon":"","canal":"Correu","relacio":"Família","familia":"Rodon Aymar","estat":"En ús","notes":"Usuari de la família Rodon Aymar.","log":[]}'::jsonb)
where path = 'admin/convidats';
