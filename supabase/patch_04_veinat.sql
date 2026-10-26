-- Veïnat (rànquing de famílies que hi participen): tothom llegeix, cadascú escriu el seu
drop policy if exists vn_select on public.docs;
drop policy if exists vn_insert on public.docs;
drop policy if exists vn_update on public.docs;
create policy vn_select on public.docs for select to authenticated using (path like 'veinat/%');
create policy vn_insert on public.docs for insert to authenticated with check (path = 'veinat/' || auth.uid()::text);
create policy vn_update on public.docs for update to authenticated using (path = 'veinat/' || auth.uid()::text) with check (path = 'veinat/' || auth.uid()::text);
