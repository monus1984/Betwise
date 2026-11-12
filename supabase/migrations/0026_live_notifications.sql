-- 0026 : direct des matchs — matchs suivis (étoile) et notifications en direct (coup d'envoi, but, mi-temps, fin).
-- Reçoivent le direct d'un match : ceux qui l'ont marqué d'une étoile et ceux qui ont un pari ou un test en cours dessus.

create table if not exists betwise.match_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references betwise.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);
create index if not exists match_follows_match_idx on betwise.match_follows (match_id);
alter table betwise.match_follows enable row level security;
create policy match_follows_all on betwise.match_follows for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on betwise.match_follows to authenticated;

alter table betwise.notification_prefs add column if not exists direct boolean not null default true;
alter table betwise.notifications drop constraint if exists notifications_type_check;
alter table betwise.notifications add constraint notifications_type_check check (type in ('resultat', 'coup_envoi', 'coups_du_jour', 'source', 'test', 'direct'));

create or replace function betwise.notif_wanted(p_user uuid, p_type text) returns boolean language sql stable security definer set search_path to 'betwise', 'public' as $$
  select coalesce((select case p_type when 'resultat' then resultats when 'coup_envoi' then coup_envoi when 'coups_du_jour' then coups_du_jour when 'source' then sources when 'direct' then direct else true end
                   from betwise.notification_prefs where user_id = p_user), true)
     and exists (select 1 from betwise.push_subscriptions s where s.user_id = p_user)
$$;

create or replace function betwise.trg_notify_match_live() returns trigger language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare
  v_h text; v_a text; v_score text; v_min text; v_but text;
  ev record;
begin
  if new.statut not in ('en_cours', 'termine') or new.kickoff_at < now() - interval '5 hours' then return new; end if;
  if not exists (select 1 from betwise.match_follows f where f.match_id = new.id)
     and not exists (select 1 from betwise.bet_selections s join betwise.bets b on b.id = s.bet_id where s.match_id = new.id and b.statut = 'en_cours') then return new; end if;

  select h.nom, a.nom into v_h, v_a from betwise.teams h, betwise.teams a where h.id = new.home_team_id and a.id = new.away_team_id;
  v_score := v_h || ' ' || coalesce(new.score_home, 0) || '–' || coalesce(new.score_away, 0) || ' ' || v_a;
  v_min := case when new.minute is not null then new.minute || '’' else null end;

  for ev in
    select * from (values
      -- coup d'envoi
      (old.statut = 'programme' and new.statut = 'en_cours', 'ko', '🟢 Coup d''envoi', v_h || ' – ' || v_a),
      -- but (ou but annulé si le score recule)
      (old.statut = 'en_cours' and new.statut = 'en_cours' and old.score_home is not null and new.score_home is not null
         and new.score_home + new.score_away > old.score_home + old.score_away,
       'g:' || new.score_home || '-' || new.score_away, '⚽ But ! ' || v_score, null),
      (old.statut = 'en_cours' and new.statut = 'en_cours' and old.score_home is not null and new.score_home is not null
         and new.score_home + new.score_away < old.score_home + old.score_away,
       'x:' || new.score_home || '-' || new.score_away || ':' || coalesce(new.minute, 0), '↩️ But annulé · ' || v_score, v_min),
      -- mi-temps : le score à la pause vient d'arriver
      (new.statut = 'en_cours' and old.ht_home is null and new.ht_home is not null, 'ht', '⏸ Mi-temps · ' || v_h || ' ' || new.ht_home || '–' || new.ht_away || ' ' || v_a, null),
      -- fin du match
      (old.statut <> 'termine' and new.statut = 'termine', 'ft', '🏁 Terminé · ' || v_score, null)
    ) as t(ok, cle, titre, corps) where ok
  loop
    if ev.cle like 'g:%' then
      -- dernier buteur connu, si la feuille d'événements vient d'être mise à jour
      v_but := case when jsonb_typeof(new.details->'buteurs') = 'array' and jsonb_array_length(new.details->'buteurs') > coalesce(jsonb_array_length(case when jsonb_typeof(old.details->'buteurs') = 'array' then old.details->'buteurs' end), 0)
                    then new.details->'buteurs'->-1->>'n' end;
      ev.corps := concat_ws(' · ', v_min, v_but);
    end if;
    insert into betwise.notifications (user_id, type, cle, titre, corps, url)
    select u.user_id, 'direct', 'live:' || new.id || ':' || ev.cle, ev.titre, coalesce(nullif(ev.corps, ''), 'Touche pour ouvrir le match'), '/matchs/' || new.id
    from (select f.user_id from betwise.match_follows f where f.match_id = new.id
          union
          select b.user_id from betwise.bet_selections s join betwise.bets b on b.id = s.bet_id where s.match_id = new.id and b.statut = 'en_cours') u
    where betwise.notif_wanted(u.user_id, 'direct')
    on conflict do nothing;
  end loop;
  return new;
end $function$;
drop trigger if exists trg_matches_live_notify on betwise.matches;
create trigger trg_matches_live_notify after update of statut, score_home, score_away, ht_home on betwise.matches for each row execute function betwise.trg_notify_match_live();
