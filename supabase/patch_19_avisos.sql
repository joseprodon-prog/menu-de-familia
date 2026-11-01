-- Avisos del rebost al mòbil: crida diària (9:00 hora de Catalunya ≈ 8:00 UTC a l'hivern) a la funció «avisos»
-- Cal tenir activades les extensions pg_cron i pg_net (Database → Extensions).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('avisos-rebost') where exists (select 1 from cron.job where jobname = 'avisos-rebost');
select cron.schedule('avisos-rebost', '0 8 * * *', $$
  select net.http_post(
    url := 'https://whdcdxbfxwfriqoeloql.supabase.co/functions/v1/avisos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-avisos-key', 'POSA_AQUI_LA_AVISOS_KEY'),
    body := '{}'::jsonb
  );
$$);
