-- Pegat 20: el teu veïnat · compres conjuntes i xat
-- Camins (docs):
--   vz/<zona>/c/<id>            compra conjunta {t, lloc, dia, qui, items:[{n,p,u}], uid, fc, fam, at, tancada}
--   vz/<zona>/c/<id>/f/<codi>   comanda d'una família {q:{<i>:quantitat}, pk:{n,a,h}, fam, col, uid}
--   vz/<zona>/x/<id>            missatge del xat {t, c?, fam, col, uid, at}
-- Només hi accedeixen les famílies del mateix veïnat (zona de veinat/<uid>).
-- Executa-ho a: Supabase → SQL Editor → New query → Run

create or replace function public.vz_meu(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select split_part(p, '/', 1) = 'vz' and public.vei_zona() is not null and split_part(p, '/', 2) = public.vei_zona()
$$;
revoke all on function public.vz_meu(text) from public, anon;
grant execute on function public.vz_meu(text) to authenticated;

drop policy if exists vz_select on public.docs;
drop policy if exists vz_insert on public.docs;
drop policy if exists vz_update on public.docs;
drop policy if exists vz_delete on public.docs;

create policy vz_select on public.docs for select to authenticated
  using (path like 'vz/%' and public.vz_meu(path));

create policy vz_insert on public.docs for insert to authenticated with check (
  path like 'vz/%' and public.vz_meu(path) and (data ->> 'uid') = auth.uid()::text
  and (split_part(path, '/', 5) <> 'f' or public.fam_member(split_part(path, '/', 6)))
);

create policy vz_update on public.docs for update to authenticated using (
  path like 'vz/%' and public.vz_meu(path) and (
    (split_part(path, '/', 5) = 'f' and public.fam_member(split_part(path, '/', 6)))
    or (split_part(path, '/', 5) = '' and (data ->> 'uid') = auth.uid()::text)
  )
) with check (path like 'vz/%' and public.vz_meu(path));

create policy vz_delete on public.docs for delete to authenticated using (
  path like 'vz/%' and public.vz_meu(path) and (
    (data ->> 'uid') = auth.uid()::text
    or (split_part(path, '/', 5) = 'f' and public.fam_member(split_part(path, '/', 6)))
  )
);
