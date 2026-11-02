-- Registre d'ús i talent (mateix patró que Tasques: 16_registre_us.sql)
-- Res es registra fins que la persona accepta l'avís (mf_consentiment). Ningú llegeix mf_events des de l'app: només el servei i l'informe.

create table if not exists public.mf_consentiment (
  usuari uuid primary key references auth.users(id) on delete cascade,
  avis_versio int not null,
  acceptat_at timestamptz not null default now()
);
alter table public.mf_consentiment enable row level security;
drop policy if exists mf_cons_sel on public.mf_consentiment;
create policy mf_cons_sel on public.mf_consentiment for select using (usuari = auth.uid());

create or replace function public.mf_accepta_avis(versio int) returns void
language sql security definer set search_path = public as $$
  insert into public.mf_consentiment(usuari, avis_versio, acceptat_at)
  values (auth.uid(), versio, now())
  on conflict (usuari) do update set avis_versio = excluded.avis_versio, acceptat_at = now();
$$;
revoke all on function public.mf_accepta_avis(int) from public;
grant execute on function public.mf_accepta_avis(int) to authenticated;

create table if not exists public.mf_events (
  id bigserial primary key,
  usuari uuid not null references auth.users(id) on delete cascade,
  app text not null default 'menu',
  tipus text not null,
  dur_ms int,
  passos int,
  meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists mf_events_usuari_at on public.mf_events(usuari, at);
create index if not exists mf_events_tipus_at on public.mf_events(tipus, at);
alter table public.mf_events enable row level security;
drop policy if exists mf_ev_ins on public.mf_events;
create policy mf_ev_ins on public.mf_events for insert with check (
  usuari = auth.uid()
  and exists (select 1 from public.mf_consentiment c where c.usuari = auth.uid())
);
-- sense política de select/update/delete: ningú la pot llegir ni tocar des de l'app

-- Es guarda 12 mesos (ho diu l'avís): esborrat diari del que és més antic
create extension if not exists pg_cron;
select cron.unschedule('mf-events-12m') where exists (select 1 from cron.job where jobname = 'mf-events-12m');
select cron.schedule('mf-events-12m', '30 3 * * *', $$ delete from public.mf_events where at < now() - interval '12 months'; $$);
