-- 0025 : notifications (push web). File d'attente en base, envoi par /api/cron/notify.
--   - résultat d'un pari ou d'un test réglé automatiquement
--   - coup d'envoi dans ~30 min d'un match de tes paris en cours
--   - coups du jour disponibles
--   - nouveaux pronos d'une source suivie
-- Aucun montant dans les textes : une notification s'affiche sur l'écran verrouillé.

create table if not exists betwise.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null,
  user_agent text, created_at timestamptz not null default now(), last_ok_at timestamptz
);
create index if not exists push_subscriptions_user_idx on betwise.push_subscriptions (user_id);
alter table betwise.push_subscriptions enable row level security;
create policy push_sub_select on betwise.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_sub_insert on betwise.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_sub_delete on betwise.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on betwise.push_subscriptions to authenticated;

create table if not exists betwise.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resultats boolean not null default true, coup_envoi boolean not null default true,
  coups_du_jour boolean not null default true, sources boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table betwise.notification_prefs enable row level security;
create policy notif_prefs_all on betwise.notification_prefs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on betwise.notification_prefs to authenticated;

create table if not exists betwise.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('resultat', 'coup_envoi', 'coups_du_jour', 'source', 'test')),
  cle text not null, titre text not null, corps text not null, url text not null default '/',
  created_at timestamptz not null default now(), sent_at timestamptz, lu_at timestamptz,
  unique (user_id, cle)
);
create index if not exists notifications_pending_idx on betwise.notifications (created_at) where sent_at is null;
create index if not exists notifications_user_idx on betwise.notifications (user_id, created_at desc);
alter table betwise.notifications enable row level security;
create policy notifications_select on betwise.notifications for select to authenticated using (user_id = (select auth.uid()));
grant select on betwise.notifications to authenticated;

-- Secrets générés par l'application (clés VAPID du push) : aucun accès hors service_role
create table if not exists betwise.app_secrets (name text primary key, value jsonb not null, created_at timestamptz not null default now());
alter table betwise.app_secrets enable row level security;
revoke all on betwise.app_secrets from anon, authenticated;

create or replace function betwise.notif_wanted(p_user uuid, p_type text) returns boolean language sql stable security definer set search_path to 'betwise', 'public' as $$
  select coalesce((select case p_type when 'resultat' then resultats when 'coup_envoi' then coup_envoi when 'coups_du_jour' then coups_du_jour when 'source' then sources else true end
                   from betwise.notification_prefs where user_id = p_user), true)
     and exists (select 1 from betwise.push_subscriptions s where s.user_id = p_user)
$$;

revoke execute on function betwise.notif_wanted(uuid, text) from public, anon, authenticated;

-- Résultat d'un pari ou d'un test : seulement quand le règlement est automatique (pas quand l'utilisateur le règle lui-même)
create or replace function betwise.trg_notify_bet_settled() returns trigger language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare v_quoi text; v_titre text;
begin
  if old.statut = 'en_cours' and new.statut in ('gagne', 'perdu', 'rembourse') and auth.uid() is null and betwise.notif_wanted(new.user_id, 'resultat') then
    v_quoi := case when new.virtuel then 'Test' else 'Pari' end;
    v_titre := case new.statut when 'gagne' then '✅ ' || v_quoi || ' gagné' when 'perdu' then '❌ ' || v_quoi || ' perdu' else '↩️ ' || v_quoi || ' remboursé' end;
    insert into betwise.notifications (user_id, type, cle, titre, corps, url)
    values (new.user_id, 'resultat', 'bet:' || new.id, v_titre,
            case when coalesce(new.nb_selections, 1) > 1 then 'Combiné de ' || new.nb_selections || ' sélections' else 'Simple' end || ' · cote ' || replace(round(new.cote_totale, 2)::text, '.', ','),
            '/paris/' || new.id)
    on conflict do nothing;
  end if;
  return new;
end $function$;
drop trigger if exists trg_bets_notify on betwise.bets;
create trigger trg_bets_notify after update of statut on betwise.bets for each row execute function betwise.trg_notify_bet_settled();

-- Nouveaux pronos d'une source suivie : une notification par source et par heure au plus, jamais pour celui qui les a saisis
create or replace function betwise.trg_notify_prediction() returns trigger language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare v_nom text; v_sys boolean;
begin
  select nom, created_by is null into v_nom, v_sys from betwise.sources where id = new.source_id;
  if v_sys or v_nom is null then return new; end if;
  insert into betwise.notifications (user_id, type, cle, titre, corps, url)
  select f.user_id, 'source', 'src:' || new.source_id || ':' || to_char(now(), 'YYYYMMDDHH24'), '📣 ' || v_nom, 'Nouveaux pronos à voir, avec l''avis de BETWISE', '/sources/' || new.source_id
  from betwise.source_follows f
  where f.source_id = new.source_id and f.user_id is distinct from new.submitted_by and betwise.notif_wanted(f.user_id, 'source')
  on conflict do nothing;
  return new;
end $function$;
drop trigger if exists trg_predictions_notify on betwise.predictions;
create trigger trg_predictions_notify after insert on betwise.predictions for each row execute function betwise.trg_notify_prediction();

-- Notifications à l'heure : coup d'envoi proche et coups du jour
create or replace function betwise.enqueue_timed_notifications() returns void language plpgsql security definer set search_path to 'betwise', 'public' as $function$
begin
  insert into betwise.notifications (user_id, type, cle, titre, corps, url)
  select b.user_id, 'coup_envoi', 'ko:' || to_char(m.kickoff_at, 'YYYYMMDDHH24MI'), '⏱ Coup d''envoi dans 30 min',
         case when count(distinct m.id) = 1 then max(h.nom) || ' – ' || max(a.nom) else count(distinct m.id) || ' matchs de tes paris commencent à ' || to_char(m.kickoff_at at time zone 'Africa/Abidjan', 'HH24:MI') end,
         case when count(distinct m.id) = 1 then '/matchs/' || (array_agg(m.id))[1]::text else '/paris' end
  from betwise.bets b
  join betwise.bet_selections s on s.bet_id = b.id and s.resultat = 'en_attente'
  join betwise.matches m on m.id = s.match_id and m.statut = 'programme' and m.kickoff_at between now() + interval '20 minutes' and now() + interval '35 minutes'
  join betwise.teams h on h.id = m.home_team_id join betwise.teams a on a.id = m.away_team_id
  where b.statut = 'en_cours' and betwise.notif_wanted(b.user_id, 'coup_envoi')
  group by b.user_id, m.kickoff_at
  on conflict do nothing;

  if extract(hour from now() at time zone 'Africa/Abidjan') between 7 and 12 then
    insert into betwise.notifications (user_id, type, cle, titre, corps, url)
    select distinct s.user_id, 'coups_du_jour', 'coups:' || p.jour, '⚡ Les coups du jour sont prêts', p.n || ' sélections classées Sûr, Audacieux et Risqué', '/coach'
    from (select jour, count(*) n from betwise.daily_picks where jour = (now() at time zone 'Africa/Abidjan')::date group by jour) p
    cross join (select distinct user_id from betwise.push_subscriptions) s
    where betwise.notif_wanted(s.user_id, 'coups_du_jour')
    on conflict do nothing;
  end if;
end $function$;

-- Chaque minute : prépare les notifications à l'heure, puis réveille l'envoi s'il y en a en attente
create or replace function betwise.tick_notify() returns void language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare v_secret text;
begin
  perform betwise.enqueue_timed_notifications();
  update betwise.notifications set sent_at = now() where sent_at is null and created_at < now() - interval '3 hours'; -- trop vieilles pour être utiles
  if not exists (select 1 from betwise.notifications where sent_at is null) then return; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'betwise_live_secret' limit 1;
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://betwise-iota.vercel.app/api/cron/notify',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 25000);
end $function$;
revoke execute on function betwise.tick_notify(), betwise.enqueue_timed_notifications() from public, anon, authenticated;

select cron.schedule('betwise-notify', '* * * * *', $$select betwise.tick_notify();$$);
