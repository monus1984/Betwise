-- 0016 : scores en direct. pg_cron appelle chaque minute /api/cron/live, seulement quand un match suivi est en cours.
-- Le secret partagé est dans Supabase Vault (betwise_live_secret) et dans Vercel (LIVE_SECRET) : il n'apparaît pas ici.
alter table betwise.matches add column if not exists af_fixture_id integer;
alter table betwise.matches add column if not exists minute smallint;
alter table betwise.matches add column if not exists live_at timestamptz;
create unique index if not exists matches_af_fixture_idx on betwise.matches (af_fixture_id) where af_fixture_id is not null;

create extension if not exists pg_net;

create or replace function betwise.tick_live() returns void
language plpgsql security definer set search_path = betwise, public as $$
declare v_secret text;
begin
  if not exists (
    select 1 from betwise.matches m
    where m.af_fixture_id is not null and m.statut in ('programme', 'en_cours')
      and m.kickoff_at between now() - interval '170 minutes' and now() + interval '1 minute'
  ) then return; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'betwise_live_secret' limit 1;
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://betwise-iota.vercel.app/api/cron/live',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 25000);
end $$;
revoke all on function betwise.tick_live() from public, anon, authenticated;

select cron.schedule('betwise-live', '* * * * *', $$select betwise.tick_live();$$);
