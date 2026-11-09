-- 0006 : règles de règlement par marché, règlement automatique à la réception d'un score,
--        import d'un prono avec dédoublonnage/statut, tendance par source.
-- Copie exacte de la migration appliquée le 2026-11-09 (md5 du corps : 582f2b5134f502f7bb45be8e888849f2).

-- ---------------------------------------------------------------
-- Règle de règlement d'une sélection : pure, testable.
-- Retourne gagne / perdu / rembourse ; 'rembourse' partiel (quarts asiatiques) est approximé en rembourse
-- si la mi-mise est remboursée et l'autre gagnée, perdu si l'autre est perdue (V1 : pas de demi-gain).
-- ---------------------------------------------------------------
create or replace function betwise.settle_selection(
  p_market text, p_param numeric, p_selection text, p_home int, p_away int
) returns betwise.settle_result
language plpgsql immutable set search_path = betwise, public as $$
declare
  total int := p_home + p_away;
  diff int := p_home - p_away;      -- positif si domicile gagne
  sel text := upper(trim(p_selection));
  adj numeric;
begin
  if p_home is null or p_away is null then return 'en_attente'; end if;

  if p_market = '1X2' then
    if sel = '1' then return case when diff > 0 then 'gagne' else 'perdu' end; end if;
    if sel in ('N','X') then return case when diff = 0 then 'gagne' else 'perdu' end; end if;
    if sel = '2' then return case when diff < 0 then 'gagne' else 'perdu' end; end if;

  elsif p_market = 'DC' then
    if sel in ('1N','1X') then return case when diff >= 0 then 'gagne' else 'perdu' end; end if;
    if sel = '12' then return case when diff <> 0 then 'gagne' else 'perdu' end; end if;
    if sel in ('N2','X2') then return case when diff <= 0 then 'gagne' else 'perdu' end; end if;

  elsif p_market = 'DNB' then
    if diff = 0 then return 'rembourse'; end if;
    if sel = '1' then return case when diff > 0 then 'gagne' else 'perdu' end; end if;
    if sel = '2' then return case when diff < 0 then 'gagne' else 'perdu' end; end if;

  elsif p_market = 'OU' then
    if p_param is null then return 'en_attente'; end if;
    if total = p_param then return 'rembourse'; end if;   -- ligne entière touchée
    if sel in ('PLUS','OVER','+') then return case when total > p_param then 'gagne' else 'perdu' end; end if;
    if sel in ('MOINS','UNDER','-') then return case when total < p_param then 'gagne' else 'perdu' end; end if;

  elsif p_market = 'BTTS' then
    if sel in ('OUI','YES') then return case when p_home >= 1 and p_away >= 1 then 'gagne' else 'perdu' end; end if;
    if sel in ('NON','NO') then return case when p_home = 0 or p_away = 0 then 'gagne' else 'perdu' end; end if;

  elsif p_market = 'AH' then
    -- handicap appliqué à l'équipe choisie ; p_param signé du point de vue de cette équipe
    if p_param is null then return 'en_attente'; end if;
    adj := case when sel = '1' then diff + p_param when sel = '2' then -diff + p_param else null end;
    if adj is null then return 'en_attente'; end if;
    if adj > 0 then return 'gagne'; end if;
    if adj < 0 then return 'perdu'; end if;
    return 'rembourse';

  elsif p_market = 'CS' then
    return case when regexp_replace(sel, '\s', '', 'g') = p_home || '-' || p_away then 'gagne' else 'perdu' end;
  end if;

  return 'en_attente';
end $$;

-- ---------------------------------------------------------------
-- Règlement d'un pari dont toutes les sélections sont réglées (appelé en interne)
-- ---------------------------------------------------------------
create or replace function betwise.finalize_bet(p_bet_id uuid)
returns void language plpgsql security definer set search_path = betwise, public as $$
declare
  b betwise.bets;
  n_pending int; n_lost int; v_cote numeric; v_gain numeric; v_result betwise.bet_status;
begin
  select * into b from betwise.bets where id = p_bet_id for update;
  if b.statut <> 'en_cours' then return; end if;

  select count(*) filter (where resultat = 'en_attente'),
         count(*) filter (where resultat = 'perdu'),
         coalesce(exp(sum(ln(cote)) filter (where resultat = 'gagne')), 1)
    into n_pending, n_lost, v_cote
  from betwise.bet_selections where bet_id = b.id;

  if n_lost > 0 then
    v_result := 'perdu'; v_gain := -b.mise;
  elsif n_pending > 0 then
    return;   -- on attend les autres sélections
  else
    -- toutes gagnées ou remboursées ; les remboursées sortent de la cote (facteur 1)
    if v_cote = 1 then v_result := 'rembourse'; v_gain := 0;
    else v_result := 'gagne'; v_gain := round(b.mise * v_cote, 2) - b.mise; end if;
  end if;

  update betwise.bets set statut = v_result, gain_net = v_gain, settled_at = now(), cote_totale = case when v_result='gagne' then round(v_cote,3) else cote_totale end
  where id = b.id;

  if v_result = 'gagne' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'gain', b.mise + v_gain, b.id, 'Gain (auto)');
  elsif v_result = 'rembourse' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'ajustement', b.mise, b.id, 'Remboursement (auto)');
  end if;
end $$;

-- ---------------------------------------------------------------
-- Règlement automatique de tout ce qui pointe vers un match terminé
-- ---------------------------------------------------------------
create or replace function betwise.settle_by_match(p_match_id uuid)
returns table (selections_reglees int, pronos_regles int, paris_finalises int)
language plpgsql security definer set search_path = betwise, public as $$
declare
  m betwise.matches; r record; n_sel int := 0; n_pred int := 0; n_bets int := 0;
begin
  select * into m from betwise.matches where id = p_match_id;
  if m.id is null or m.statut <> 'termine' or m.score_home is null or m.score_away is null then
    return query select 0, 0, 0; return;
  end if;

  -- Sélections
  for r in
    update betwise.bet_selections s
       set resultat = betwise.settle_selection(s.market_code, s.market_param, s.selection, m.score_home, m.score_away),
           settled_at = now()
     where s.match_id = m.id and s.resultat = 'en_attente'
       and betwise.settle_selection(s.market_code, s.market_param, s.selection, m.score_home, m.score_away) <> 'en_attente'
     returning s.bet_id
  loop
    n_sel := n_sel + 1;
    perform betwise.finalize_bet(r.bet_id);
  end loop;

  select count(*) into n_bets from betwise.bets b where b.settled_at >= now() - interval '2 seconds' and exists (select 1 from betwise.bet_selections s where s.bet_id = b.id and s.match_id = m.id);

  -- Pronos
  update betwise.predictions p
     set resultat = betwise.settle_selection(p.market_code, p.market_param, p.selection, m.score_home, m.score_away),
         settled_at = now()
   where p.match_id = m.id and p.resultat = 'en_attente' and p.statut <> 'annule'
     and betwise.settle_selection(p.market_code, p.market_param, p.selection, m.score_home, m.score_away) <> 'en_attente';
  get diagnostics n_pred = row_count;

  return query select n_sel, n_pred, n_bets;
end $$;

-- Règle tout ce qui est en attente sur des matchs terminés (appel par le job après l'import des scores)
create or replace function betwise.settle_pending()
returns table (matchs int, selections_reglees int, pronos_regles int, paris_finalises int)
language plpgsql security definer set search_path = betwise, public as $$
declare mid uuid; t record; a int := 0; b int := 0; c int := 0; d int := 0;
begin
  for mid in
    select distinct x.match_id from (
      select match_id from betwise.bet_selections where resultat = 'en_attente' and match_id is not null
      union
      select match_id from betwise.predictions where resultat = 'en_attente' and statut <> 'annule' and match_id is not null
    ) x join betwise.matches mm on mm.id = x.match_id
    where mm.statut = 'termine' and mm.score_home is not null
  loop
    select * into t from betwise.settle_by_match(mid);
    a := a + 1; b := b + t.selections_reglees; c := c + t.pronos_regles; d := d + t.paris_finalises;
  end loop;
  return query select a, b, c, d;
end $$;

-- ---------------------------------------------------------------
-- Import d'un prono : dédoublonnage par clé, statut posé par le trigger, retourne l'id (existant si doublon)
-- ---------------------------------------------------------------
create or replace function betwise.log_prediction(
  p_source_id uuid,
  p_market_code text,
  p_selection text,
  p_match_id uuid default null,
  p_match_libre text default null,
  p_market_param numeric default null,
  p_cote_annoncee numeric default null,
  p_risque_annonce betwise.risk_category default null,
  p_published_at timestamptz default null,
  p_upload_id uuid default null
) returns table (prediction_id uuid, created boolean, statut betwise.prediction_status)
language plpgsql security definer set search_path = betwise, public as $$
declare uid uuid := auth.uid(); v_id uuid; v_statut betwise.prediction_status; v_key text;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  if p_match_id is null and coalesce(trim(p_match_libre),'') = '' then raise exception 'match requis'; end if;
  if not exists (select 1 from betwise.sources s where s.id = p_source_id and (s.visibilite='partagee' or s.created_by = uid)) then
    raise exception 'source inconnue';
  end if;

  v_key := p_source_id::text || '|' || coalesce(p_match_id::text, lower(coalesce(p_match_libre,''))) || '|' ||
    p_market_code || '|' || coalesce(p_market_param::text,'') || '|' || lower(p_selection) || '|' ||
    to_char(coalesce(p_published_at, now()) at time zone 'UTC','YYYY-MM-DD');

  select id, predictions.statut into v_id, v_statut from betwise.predictions where dedupe_key = v_key;
  if v_id is not null then
    return query select v_id, false, v_statut; return;
  end if;

  insert into betwise.predictions (source_id, match_id, match_libre, market_code, market_param, selection, cote_annoncee, risque_annonce, published_at, submitted_by, upload_id)
  values (p_source_id, p_match_id, nullif(trim(p_match_libre),''), p_market_code, p_market_param, trim(p_selection), p_cote_annoncee, p_risque_annonce, p_published_at, uid, p_upload_id)
  returning id, predictions.statut into v_id, v_statut;
  return query select v_id, true, v_statut;
end $$;

-- Annulation visible d'un prono (jamais de suppression)
create or replace function betwise.cancel_prediction(p_id uuid, p_motif text)
returns void language plpgsql security definer set search_path = betwise, public as $$
declare uid uuid := auth.uid();
begin
  if coalesce(trim(p_motif),'') = '' then raise exception 'motif requis'; end if;
  update betwise.predictions set statut = 'annule', motif_annulation = p_motif
   where id = p_id and submitted_by = uid and statut <> 'annule';
  if not found then raise exception 'prono introuvable ou déjà annulé'; end if;
  insert into betwise.prediction_versions (prediction_id, changes, changed_by) values (p_id, jsonb_build_object('statut','annule','motif',p_motif), uid);
end $$;

-- ---------------------------------------------------------------
-- Tendance d'une source : déclarés / gagnés, global et par catégorie de risque (vue légère, temps réel)
-- ---------------------------------------------------------------
create or replace view betwise.source_trend with (security_invoker = true) as
select s.id as source_id,
       count(p.id) filter (where p.statut <> 'annule') as nb_declares,
       count(p.id) filter (where p.statut = 'verifie') as nb_verifies,
       count(p.id) filter (where p.statut <> 'annule' and p.resultat <> 'en_attente') as nb_regles,
       count(p.id) filter (where p.statut <> 'annule' and p.resultat = 'gagne') as nb_gagnes,
       count(p.id) filter (where p.statut <> 'annule' and p.resultat = 'perdu') as nb_perdus,
       round(coalesce(sum(case when p.statut <> 'annule' and p.resultat = 'gagne' and p.cote_annoncee is not null then p.cote_annoncee - 1
                                when p.statut <> 'annule' and p.resultat = 'perdu' and p.cote_annoncee is not null then -1 end), 0), 2) as unites_nettes,
       count(p.id) filter (where p.statut <> 'annule' and p.resultat in ('gagne','perdu') and p.cote_annoncee is not null) as nb_avec_cote,
       count(p.id) filter (where p.statut <> 'annule' and coalesce(p.risque_annonce, p.risque_calcule) = 'prudent' and p.resultat <> 'en_attente') as prudent_regles,
       count(p.id) filter (where p.statut <> 'annule' and coalesce(p.risque_annonce, p.risque_calcule) = 'prudent' and p.resultat = 'gagne') as prudent_gagnes,
       count(p.id) filter (where p.statut <> 'annule' and coalesce(p.risque_annonce, p.risque_calcule) = 'moyen' and p.resultat <> 'en_attente') as moyen_regles,
       count(p.id) filter (where p.statut <> 'annule' and coalesce(p.risque_annonce, p.risque_calcule) = 'moyen' and p.resultat = 'gagne') as moyen_gagnes,
       count(p.id) filter (where p.statut <> 'annule' and coalesce(p.risque_annonce, p.risque_calcule) = 'risque' and p.resultat <> 'en_attente') as risque_regles,
       count(p.id) filter (where p.statut <> 'annule' and coalesce(p.risque_annonce, p.risque_calcule) = 'risque' and p.resultat = 'gagne') as risque_gagnes,
       max(p.logged_at) as dernier_prono
from betwise.sources s
left join betwise.predictions p on p.source_id = s.id
group by s.id;

grant select on betwise.source_trend to authenticated;
grant execute on function betwise.settle_selection(text, numeric, text, int, int) to authenticated, service_role;
grant execute on function betwise.settle_by_match(uuid) to service_role;
grant execute on function betwise.settle_pending() to service_role;
grant execute on function betwise.log_prediction(uuid, text, text, uuid, text, numeric, numeric, betwise.risk_category, timestamptz, uuid) to authenticated;
grant execute on function betwise.cancel_prediction(uuid, text) to authenticated;
revoke execute on function betwise.finalize_bet(uuid) from public, authenticated;
