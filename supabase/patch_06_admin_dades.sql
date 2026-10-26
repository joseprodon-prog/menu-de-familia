-- Pegat 6: dades pròpies de la web de l'Hortolà (convidats i notes)
drop policy if exists adm_docs_select on public.docs;
drop policy if exists adm_docs_insert on public.docs;
drop policy if exists adm_docs_update on public.docs;
drop policy if exists adm_docs_delete on public.docs;
create policy adm_docs_select on public.docs for select to authenticated using (path like 'admin/%' and public.is_hortola());
create policy adm_docs_insert on public.docs for insert to authenticated with check (path like 'admin/%' and public.is_hortola());
create policy adm_docs_update on public.docs for update to authenticated using (path like 'admin/%' and public.is_hortola()) with check (path like 'admin/%' and public.is_hortola());
create policy adm_docs_delete on public.docs for delete to authenticated using (path like 'admin/%' and public.is_hortola());
