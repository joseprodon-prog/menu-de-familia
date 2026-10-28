-- Pegat 12: les famílies no sembradores generen 1 llista de la compra per setmana natural (de dilluns a diumenge)
-- 1) compra_genera(): l'app la crida abans de generar la llista; comprova i anota la generació.
-- 2) Disparador: rebutja afegir a la llista productes generats (marcats «gen») si no hi ha un permís vigent de compra_genera().
--    Afegir productes a mà o els ingredients d'una recepta no queda afectat.
create table if not exists public.compra_gen (
  code text primary key,
  setm date not null,
  permis_fins timestamptz not null default now()
);
alter table public.compra_gen enable row level security;
-- sense polítiques: només s'hi accedeix des de les funcions

create or replace function public.fam_premium(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select coalesce(d.data -> 'h' -> left(encode(sha256(convert_to('mf:' || p_code, 'UTF8')), 'hex'), 12) ->> 'estat', 'act') = 'act'
    from public.docs d
    where d.path = 'botiga/premium'
      and d.data -> 'h' ? left(encode(sha256(convert_to('mf:' || p_code, 'UTF8')), 'hex'), 12)
  ), false)
$$;

create or replace function public.compra_genera(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare v_setm date := date_trunc('week', now() at time zone 'Europe/Madrid')::date; v_prev date;
begin
  if not public.fam_member(p_code) then return json_build_object('ok', false, 'motiu', 'familia'); end if;
  if not public.fam_premium(p_code) then
    select setm into v_prev from public.compra_gen where code = p_code;
    if v_prev = v_setm then return json_build_object('ok', false, 'motiu', 'setmana'); end if;
  end if;
  insert into public.compra_gen (code, setm, permis_fins) values (p_code, v_setm, now() + interval '3 minutes')
  on conflict (code) do update set setm = excluded.setm, permis_fins = excluded.permis_fins;
  return json_build_object('ok', true);
end $$;
revoke all on function public.compra_genera(text) from public, anon;
grant execute on function public.compra_genera(text) to authenticated;

create or replace function public.compra_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_code text; v_nous int;
begin
  if NEW.path !~ '^families/[^/]+/dades/compra$' then return NEW; end if;
  v_code := split_part(NEW.path, '/', 2);
  -- doc_merge fa «insert … on conflict»: si el document ja existeix, la comprovació es fa a la fase d'update
  if TG_OP = 'INSERT' and exists (select 1 from public.docs where path = NEW.path) then return NEW; end if;
  select count(*) into v_nous
  from jsonb_each(coalesce(NEW.data -> 'items', '{}'::jsonb)) n
  where jsonb_typeof(n.value) = 'object' and n.value ? 'gen'
    and (TG_OP = 'INSERT' or not coalesce(OLD.data -> 'items', '{}'::jsonb) ? n.key);
  if v_nous = 0 or public.is_hortola() or public.fam_premium(v_code) then return NEW; end if;
  if exists (select 1 from public.compra_gen where code = v_code and permis_fins > now()) then return NEW; end if;
  raise exception 'compra_setmanal';
end $$;
drop trigger if exists compra_guard on public.docs;
create trigger compra_guard before insert or update on public.docs for each row execute function public.compra_guard();
