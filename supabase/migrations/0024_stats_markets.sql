-- 0024 : corners, cartons, tirs, buteurs, prolongation / tirs au but / qualification, score exact à la mi-temps.
-- Ces paris se règlent sur le détail du match (API-Football) : matches.details, rempli à la fin du match.
--   details = { corners:[dom,ext], jaunes:[..], rouges:[..], tirs:[..], cadres:[..],
--               buteurs:[{n:"K. Mbappé", e:"1"|"2", m:23}], issue:"FT"|"AET"|"PEN", vainqueur:"1"|"2"|null }

alter table betwise.matches add column if not exists details jsonb, add column if not exists details_at timestamptz;

insert into betwise.markets (code, libelle_fr, a_parametre) values
  ('HT_CS', 'Mi-temps : score exact', false),
  ('CORN', 'Corners : total du match', true), ('CORN1', 'Corners de l''équipe à domicile', true), ('CORN2', 'Corners de l''équipe à l''extérieur', true), ('CORN_1X2', 'Équipe avec le plus de corners', false),
  ('CARD', 'Cartons : total du match', true), ('CARD1', 'Cartons de l''équipe à domicile', true), ('CARD2', 'Cartons de l''équipe à l''extérieur', true), ('RED', 'Carton rouge dans le match', false),
  ('SHOT', 'Tirs : total du match', true), ('SOT', 'Tirs cadrés : total du match', true), ('SOT1', 'Tirs cadrés de l''équipe à domicile', true), ('SOT2', 'Tirs cadrés de l''équipe à l''extérieur', true),
  ('BUT', 'Buteur (marque à tout moment)', false), ('BUT1', 'Premier buteur', false),
  ('ET', 'Prolongation', false), ('PEN', 'Tirs au but', false), ('QUALIF', 'Qualification / vainqueur final', false)
on conflict (code) do nothing;

/** Nom de joueur simplifié pour comparer « Mbappé », « K. Mbappe » et « Kylian Mbappé ». */
create or replace function betwise.norm_name(p text) returns text language sql immutable set search_path to 'betwise', 'public' as $$
  select trim(regexp_replace(lower(translate(coalesce(p, ''), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ', 'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY')), '[^a-z]+', ' ', 'g'))
$$;
create or replace function betwise.same_player(a text, b text) returns boolean language sql immutable set search_path to 'betwise', 'public' as $$
  select betwise.norm_name(a) <> '' and (
    betwise.norm_name(a) = betwise.norm_name(b)
    or (length(split_part(reverse(betwise.norm_name(a)), ' ', 1)) >= 3
        and split_part(reverse(betwise.norm_name(a)), ' ', 1) = split_part(reverse(betwise.norm_name(b)), ' ', 1)))
$$;

/** Règlement d'une sélection à partir de la fiche complète du match (score, mi-temps, détail). */
create or replace function betwise.settle_sel(p_market text, p_param numeric, p_selection text, m betwise.matches)
 returns betwise.settle_result language plpgsql stable set search_path to 'betwise', 'public' as $function$
declare
  d jsonb := m.details; sel text := upper(trim(p_selection)); k text; h int; a int; v numeric; first_n text;
begin
  if m.score_home is null or m.score_away is null then return 'en_attente'; end if;

  if p_market in ('CORN','CORN1','CORN2','CORN_1X2','CARD','CARD1','CARD2','RED','SHOT','SOT','SOT1','SOT2') then
    k := case when p_market like 'CORN%' then 'corners' when p_market = 'SHOT' then 'tirs' when p_market like 'SOT%' then 'cadres' else null end;
    if p_market in ('CARD','CARD1','CARD2','RED') then
      if d is null or d->'jaunes' is null or d->'rouges' is null or jsonb_typeof(d->'jaunes') <> 'array' then return 'en_attente'; end if;
      if p_market = 'RED' then
        v := (d->'rouges'->>0)::int + (d->'rouges'->>1)::int;
        if sel in ('OUI','YES') then return case when v > 0 then 'gagne' else 'perdu' end; end if;
        if sel in ('NON','NO') then return case when v = 0 then 'gagne' else 'perdu' end; end if;
        return 'en_attente';
      end if;
      h := (d->'jaunes'->>0)::int + (d->'rouges'->>0)::int; a := (d->'jaunes'->>1)::int + (d->'rouges'->>1)::int;
    else
      if d is null or d->k is null or jsonb_typeof(d->k) <> 'array' or d->k->>0 is null or d->k->>1 is null then return 'en_attente'; end if;
      h := (d->k->>0)::int; a := (d->k->>1)::int;
    end if;
    if p_market = 'CORN_1X2' then
      if sel = '1' then return case when h > a then 'gagne' else 'perdu' end; end if;
      if sel in ('N','X') then return case when h = a then 'gagne' else 'perdu' end; end if;
      if sel = '2' then return case when h < a then 'gagne' else 'perdu' end; end if;
      return 'en_attente';
    end if;
    if p_param is null then return 'en_attente'; end if;
    v := case when right(p_market, 1) = '1' then h when right(p_market, 1) = '2' then a else h + a end;
    if v = p_param then return 'rembourse'; end if;
    if sel in ('PLUS','OVER','+') then return case when v > p_param then 'gagne' else 'perdu' end; end if;
    if sel in ('MOINS','UNDER','-') then return case when v < p_param then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;

  if p_market in ('BUT', 'BUT1') then
    if d is null or d->'buteurs' is null or jsonb_typeof(d->'buteurs') <> 'array' then return 'en_attente'; end if;
    if p_market = 'BUT' then
      return case when exists (select 1 from jsonb_array_elements(d->'buteurs') b where betwise.same_player(p_selection, b->>'n')) then 'gagne' else 'perdu' end;
    end if;
    select b->>'n' into first_n from jsonb_array_elements(d->'buteurs') b order by (b->>'m')::int, (b->>'x')::int nulls first limit 1;
    if first_n is null then return case when sel in ('AUCUN','AUCUN BUTEUR','PAS DE BUT') then 'gagne' else 'perdu' end; end if;
    return case when betwise.same_player(p_selection, first_n) then 'gagne' else 'perdu' end;
  end if;

  if p_market in ('ET', 'PEN', 'QUALIF') then
    if d is null or d->>'issue' is null then return 'en_attente'; end if;
    if p_market = 'QUALIF' then
      k := coalesce(d->>'vainqueur', case when m.score_home > m.score_away then '1' when m.score_home < m.score_away then '2' end);
      if k is null then return 'rembourse'; end if;   -- match nul sans vainqueur désigné (aller d'une double confrontation, championnat)
      if sel in ('1','2') then return case when sel = k then 'gagne' else 'perdu' end; end if;
      return 'en_attente';
    end if;
    v := case when p_market = 'ET' then (d->>'issue' in ('AET','PEN'))::int else (d->>'issue' = 'PEN')::int end;
    if sel in ('OUI','YES') then return case when v = 1 then 'gagne' else 'perdu' end; end if;
    if sel in ('NON','NO') then return case when v = 0 then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;

  return betwise.settle_selection(p_market, p_param, p_selection, m.score_home, m.score_away, m.ht_home, m.ht_away);
end $function$;

create or replace function betwise.settle_by_match(p_match_id uuid)
 returns table(selections_reglees integer, pronos_regles integer, paris_finalises integer) language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare
  m betwise.matches; r record; n_sel int := 0; n_pred int := 0; n_bets int := 0;
begin
  select * into m from betwise.matches where id = p_match_id;
  if m.id is null or m.statut <> 'termine' or m.score_home is null or m.score_away is null then
    return query select 0, 0, 0; return;
  end if;

  for r in
    update betwise.bet_selections s
       set resultat = betwise.settle_sel(s.market_code, s.market_param, s.selection, m), settled_at = now()
     where s.match_id = m.id and s.resultat = 'en_attente'
       and betwise.settle_sel(s.market_code, s.market_param, s.selection, m) <> 'en_attente'
     returning s.bet_id
  loop
    n_sel := n_sel + 1;
    perform betwise.finalize_bet(r.bet_id);
  end loop;

  select count(*) into n_bets from betwise.bets b where b.settled_at >= now() - interval '2 seconds' and exists (select 1 from betwise.bet_selections s where s.bet_id = b.id and s.match_id = m.id);

  update betwise.predictions p
     set resultat = betwise.settle_sel(p.market_code, p.market_param, p.selection, m), settled_at = now()
   where p.match_id = m.id and p.resultat = 'en_attente' and p.statut <> 'annule'
     and betwise.settle_sel(p.market_code, p.market_param, p.selection, m) <> 'en_attente';
  get diagnostics n_pred = row_count;

  return query select n_sel, n_pred, n_bets;
end $function$;

-- Le direct se réveille aussi pour compléter le détail d'un match tout juste terminé (statistiques publiées avec quelques minutes de retard)
create or replace function betwise.tick_live() returns void language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare v_secret text;
begin
  if not exists (
    select 1 from betwise.matches m
    where m.af_fixture_id is not null and (
      (m.statut in ('programme', 'en_cours') and m.kickoff_at between now() - interval '170 minutes' and now() + interval '1 minute')
      or (m.statut = 'termine' and m.details_at is null and m.result_at > now() - interval '30 minutes'))
  ) then return; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'betwise_live_secret' limit 1;
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://betwise-iota.vercel.app/api/cron/live',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 25000);
end $function$;
