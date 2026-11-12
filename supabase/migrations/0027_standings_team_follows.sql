-- 0027 : classements (cache API-Football) et équipes suivies (leurs matchs envoient le direct).

create table betwise.standings (
  comp_code text not null, groupe text not null default '', af_team_id integer not null,
  saison integer not null, rang integer not null, team_nom text not null, team_id uuid references betwise.teams(id) on delete set null,
  joues integer not null default 0, gagnes integer not null default 0, nuls integer not null default 0, perdus integer not null default 0,
  bp integer not null default 0, bc integer not null default 0, diff integer not null default 0, points integer not null default 0,
  forme text, zone text, updated_at timestamptz not null default now(),
  primary key (comp_code, groupe, af_team_id)
);
alter table betwise.standings enable row level security;
create policy standings_read on betwise.standings for select to authenticated using (true);
grant select on betwise.standings to authenticated;

create table betwise.team_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references betwise.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index team_follows_team_idx on betwise.team_follows (team_id);
alter table betwise.team_follows enable row level security;
create policy team_follows_all on betwise.team_follows for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on betwise.team_follows to authenticated;

-- Le direct d'un match va aussi à ceux qui suivent l'une des deux équipes
create or replace function betwise.trg_notify_match_live() returns trigger language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare
  v_h text; v_a text; v_score text; v_min text; v_but text;
  ev record;
begin
  if new.statut not in ('en_cours', 'termine') or new.kickoff_at < now() - interval '5 hours' then return new; end if;
  if not exists (select 1 from betwise.match_follows f where f.match_id = new.id)
     and not exists (select 1 from betwise.team_follows t where t.team_id in (new.home_team_id, new.away_team_id))
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
    select u.user_id, 'coup_envoi', 'live:' || new.id || ':' || ev.cle, ev.titre, coalesce(nullif(ev.corps, ''), 'Touche pour ouvrir le match'), '/matchs/' || new.id
    from (select f.user_id from betwise.match_follows f where f.match_id = new.id
          union
          select t.user_id from betwise.team_follows t where t.team_id in (new.home_team_id, new.away_team_id)
          union
          select b.user_id from betwise.bet_selections s join betwise.bets b on b.id = s.bet_id where s.match_id = new.id and b.statut = 'en_cours') u
    where betwise.notif_wanted(u.user_id, 'direct')
    on conflict do nothing;
  end loop;
  return new;
end $function$;
