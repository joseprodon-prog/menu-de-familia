-- Pegat 16: funcions activades per família (interruptor de l'Hortolà)
-- botiga/funcions = {h:{<hash família>:{<funció>:true}}}  (només l'Hortolà hi escriu: política botiga/% del pegat 3)
-- fam_funcio(p_fn): true si alguna família de l'usuari té la funció activada. La crida la funció «llegeix».
create or replace function public.fam_funcio(p_fn text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select bool_or(coalesce((c.data -> 'h' -> left(encode(sha256(convert_to('mf:' || split_part(f.path, '/', 2), 'UTF8')), 'hex'), 12) ->> p_fn)::boolean, false))
    from public.docs f
    join public.docs c on c.path = 'botiga/funcions'
    where f.path ~ '^families/[^/]+$'
      and auth.uid() is not null
      and coalesce((f.data -> 'membres' ->> auth.uid()::text)::boolean, false)
  ), false)
$$;
revoke all on function public.fam_funcio(text) from public, anon;
grant execute on function public.fam_funcio(text) to authenticated;
