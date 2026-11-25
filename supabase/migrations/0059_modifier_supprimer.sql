-- 0059 (25/11) : modifier et supprimer ce qu'on a saisi (Mounir : « plusieurs n'ont pas de possibilité de modifier ou
-- supprimer après sélection »). Toutes les fonctions n'agissent que sur les données de l'utilisateur connecté.
-- Ajouts seulement (nouvelles fonctions). Réversible : supprimer ces fonctions.

-- Paris : supprimer à tout moment (la bankroll suit : ses mouvements liés au pari partent avec lui)
create or replace function betwise.delete_bet(p_bet_id uuid) returns void
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid(); b betwise.bets;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;
  delete from betwise.odds_observations o where o.observed_by = uid and o.origine = 'ticket' and o.observed_at = b.placed_at
    and exists (select 1 from betwise.bet_selections s where s.bet_id = b.id and s.match_id = o.match_id and s.market_code = o.market_code and s.selection = o.selection);
  delete from betwise.bankroll_transactions where bet_id = b.id;
  delete from betwise.bets where id = b.id; -- lignes et historique partent en cascade
end $$;

-- Paris : rouvrir un pari réglé pour le corriger ; il sera réglé de nouveau (gains et remboursements annulés, mise gardée)
create or replace function betwise.reopen_bet(p_bet_id uuid) returns void
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid(); b betwise.bets;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;
  if b.statut not in ('gagne', 'perdu', 'rembourse') then raise exception 'pari pas encore réglé'; end if;
  delete from betwise.bankroll_transactions where bet_id = b.id and type <> 'mise';
  insert into betwise.bet_versions (bet_id, changes, changed_by) values (b.id, jsonb_build_object('statut', jsonb_build_object('avant', b.statut, 'apres', 'en_cours', 'motif', 'rouvert pour correction')), uid);
  update betwise.bets set statut = 'en_cours', gain_net = null, settled_at = null, resultat_propose = null, gain_propose = null, propose_at = null, cashout = null where id = b.id;
  update betwise.bet_selections set resultat = 'en_attente', settled_at = null where bet_id = b.id;
end $$;

-- Paris : retirer une ligne d'un combiné en cours ; la cote totale est recalculée
create or replace function betwise.remove_bet_selection(p_selection_id uuid) returns void
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid(); s betwise.bet_selections; b betwise.bets; n int; v_cote numeric;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into s from betwise.bet_selections where id = p_selection_id;
  select * into b from betwise.bets where id = s.bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;
  if b.statut <> 'en_cours' then raise exception 'pari réglé : rouvre-le pour le corriger'; end if;
  select count(*) into n from betwise.bet_selections where bet_id = b.id;
  if n <= 1 then raise exception 'dernière ligne : supprime plutôt le pari'; end if;
  insert into betwise.bet_versions (bet_id, changes, changed_by) values (b.id, jsonb_build_object('ligne_retiree', jsonb_build_object('match', coalesce(s.match_id::text, s.match_libre), 'marche', s.market_code || ' ' || coalesce(s.market_param::text, '') || ' ' || s.selection, 'cote', s.cote)), uid);
  delete from betwise.bet_selections where id = s.id;
  select coalesce(exp(sum(ln(cote))), 1), count(*) into v_cote, n from betwise.bet_selections where bet_id = b.id;
  update betwise.bets set cote_totale = round(v_cote, 3), nb_selections = n, type = case when n = 1 then 'simple'::betwise.bet_type else type end where id = b.id;
end $$;

-- Pronos d'une source : modifier (match, pari, cote) ; le prono sera réglé de nouveau
create or replace function betwise.update_prediction(p_id uuid, p_match_id uuid, p_market_code text, p_market_param numeric, p_selection text, p_cote numeric) returns void
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid(); p betwise.predictions; k timestamptz; v_key text;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into p from betwise.predictions where id = p_id and submitted_by = uid for update;
  if p.id is null then raise exception 'prono introuvable ou chargé par quelqu''un d''autre'; end if;
  if p_market_code is null or not exists (select 1 from betwise.markets where code = p_market_code) then raise exception 'marché inconnu'; end if;
  if coalesce(trim(p_selection), '') = '' then raise exception 'choisis la sélection'; end if;
  if p_cote is not null and p_cote <= 1 then raise exception 'cote invalide'; end if;
  if p_match_id is not null then
    select kickoff_at into k from betwise.matches where id = p_match_id;
    if k is null then raise exception 'match inconnu'; end if;
  end if;
  v_key := p.source_id::text || '|' || coalesce(p_match_id::text, lower(coalesce(p.match_libre, ''))) || '|' || p_market_code || '|' || coalesce(p_market_param::text, '') || '|' || lower(p_selection) || '|' ||
    to_char(coalesce(p.published_at, p.logged_at) at time zone 'UTC', 'YYYY-MM-DD');
  if exists (select 1 from betwise.predictions x where x.dedupe_key = v_key and x.id <> p.id) then raise exception 'ce prono existe déjà pour cette source'; end if;
  insert into betwise.prediction_versions (prediction_id, changes, changed_by) values (p.id, jsonb_build_object(
    'avant', jsonb_build_object('match', p.match_id, 'marche', p.market_code, 'param', p.market_param, 'selection', p.selection, 'cote', p.cote_annoncee),
    'apres', jsonb_build_object('match', p_match_id, 'marche', p_market_code, 'param', p_market_param, 'selection', p_selection, 'cote', p_cote)), uid);
  update betwise.predictions set match_id = coalesce(p_match_id, match_id), match_libre = case when p_match_id is not null then null else match_libre end,
    market_code = p_market_code, market_param = p_market_param, selection = p_selection, cote_annoncee = p_cote,
    risque_calcule = betwise.risk_from_odds(p_cote), dedupe_key = v_key, resultat = 'en_attente', settled_at = null,
    statut = case when statut = 'annule' then statut when k is not null and logged_at < k then 'verifie'::betwise.prediction_status else statut end
  where id = p.id;
end $$;

-- Pronos d'une source : supprimer un prono chargé par erreur
create or replace function betwise.delete_prediction(p_id uuid) returns void
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid(); p betwise.predictions;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into p from betwise.predictions where id = p_id and submitted_by = uid;
  if p.id is null then raise exception 'prono introuvable ou chargé par quelqu''un d''autre'; end if;
  update betwise.bet_selections set prediction_id = null where prediction_id = p.id;
  update betwise.model_estimates set prediction_id = null where prediction_id = p.id;
  delete from betwise.predictions where id = p.id;
end $$;

-- Sources : renommer, changer le type et la visibilité d'une source qu'on a créée
create or replace function betwise.update_source(p_id uuid, p_nom text, p_type betwise.source_type, p_visibilite text) returns void
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid(); s betwise.sources;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into s from betwise.sources where id = p_id and created_by = uid for update;
  if s.id is null then raise exception 'source introuvable ou créée par quelqu''un d''autre'; end if;
  if s.type in ('perso', 'modele_betwise') or p_type in ('perso', 'modele_betwise') then raise exception 'cette source ne se modifie pas'; end if;
  if length(trim(coalesce(p_nom, ''))) < 2 then raise exception 'nom trop court'; end if;
  if p_visibilite not in ('privee', 'partagee') then raise exception 'visibilité invalide'; end if;
  if p_visibilite = 'privee' and s.visibilite = 'partagee' and exists (select 1 from betwise.source_follows f where f.source_id = s.id and f.user_id <> uid) then
    raise exception 'd''autres utilisateurs la suivent : elle reste partagée';
  end if;
  update betwise.sources set nom = trim(p_nom), type = p_type, visibilite = p_visibilite::betwise.source_visibility where id = s.id;
end $$;

-- Sources : supprimer une source qu'on a créée, avec ses pronos, si personne d'autre ne s'en sert
create or replace function betwise.delete_source(p_id uuid) returns int
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid(); s betwise.sources; n int;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into s from betwise.sources where id = p_id and created_by = uid for update;
  if s.id is null then raise exception 'source introuvable ou créée par quelqu''un d''autre'; end if;
  if s.type in ('perso', 'modele_betwise') then raise exception 'cette source ne se supprime pas'; end if;
  if exists (select 1 from betwise.source_follows f where f.source_id = s.id and f.user_id <> uid)
     or exists (select 1 from betwise.predictions p where p.source_id = s.id and p.submitted_by is distinct from uid) then
    raise exception 'd''autres utilisateurs la suivent ou y ont chargé des pronos : elle ne peut pas être supprimée';
  end if;
  update betwise.bet_selections set origin_source_id = null where origin_source_id = s.id;
  update betwise.bet_selections set prediction_id = null where prediction_id in (select id from betwise.predictions where source_id = s.id);
  update betwise.model_estimates set prediction_id = null where prediction_id in (select id from betwise.predictions where source_id = s.id);
  delete from betwise.predictions where source_id = s.id;
  get diagnostics n = row_count;
  delete from betwise.sources where id = s.id;
  return n;
end $$;

-- Bankroll : modifier ou supprimer un dépôt ou un retrait saisi à la main (jamais un mouvement lié à un pari)
create or replace function betwise.update_bankroll_tx(p_id uuid, p_montant numeric, p_note text) returns void
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid(); t betwise.bankroll_transactions;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select x.* into t from betwise.bankroll_transactions x join betwise.bankrolls b on b.id = x.bankroll_id where x.id = p_id and b.user_id = uid for update of x;
  if t.id is null then raise exception 'mouvement introuvable'; end if;
  if t.bet_id is not null or t.type not in ('depot', 'retrait') then raise exception 'seuls les dépôts et retraits se modifient'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'montant invalide'; end if;
  update betwise.bankroll_transactions set montant = case when t.type = 'retrait' then -p_montant else p_montant end, note = nullif(trim(coalesce(p_note, '')), '') where id = t.id;
end $$;

create or replace function betwise.delete_bankroll_tx(p_id uuid) returns void
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid(); t betwise.bankroll_transactions;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select x.* into t from betwise.bankroll_transactions x join betwise.bankrolls b on b.id = x.bankroll_id where x.id = p_id and b.user_id = uid;
  if t.id is null then raise exception 'mouvement introuvable'; end if;
  if t.bet_id is not null or t.type not in ('depot', 'retrait') then raise exception 'seuls les dépôts et retraits se suppriment'; end if;
  delete from betwise.bankroll_transactions where id = t.id;
end $$;

-- Montantes : détacher un pari rattaché par erreur (il reste dans Mes paris)
create or replace function betwise.montante_detacher(p_bet_id uuid) returns void
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid(); b betwise.bets;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null or b.montante_id is null then raise exception 'pari introuvable ou pas dans une montante'; end if;
  if exists (select 1 from betwise.bets x where x.montante_id = b.montante_id and x.palier > b.palier) then raise exception 'détache d''abord les paliers suivants'; end if;
  update betwise.bets set montante_id = null, palier = null where id = b.id;
  update betwise.montantes set statut = 'en_cours', termine_at = null, updated_at = now() where id = b.montante_id and statut in ('atteinte', 'cassee');
end $$;

-- Montantes : reprendre une montante arrêtée
create or replace function betwise.montante_reprendre(p_montante_id uuid) returns void
language plpgsql security definer set search_path to 'betwise', 'public' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'non authentifié'; end if;
  update betwise.montantes set statut = 'en_cours', termine_at = null, updated_at = now() where id = p_montante_id and user_id = uid and statut = 'arretee';
  if not found then raise exception 'montante introuvable ou pas arrêtée'; end if;
end $$;

do $$ declare f text; begin
  foreach f in array array['delete_bet(uuid)', 'reopen_bet(uuid)', 'remove_bet_selection(uuid)', 'update_prediction(uuid, uuid, text, numeric, text, numeric)', 'delete_prediction(uuid)',
    'update_source(uuid, text, betwise.source_type, text)', 'delete_source(uuid)', 'update_bankroll_tx(uuid, numeric, text)', 'delete_bankroll_tx(uuid)', 'montante_detacher(uuid)', 'montante_reprendre(uuid)'] loop
    execute format('revoke execute on function betwise.%s from public, anon', f);
    execute format('grant execute on function betwise.%s to authenticated', f);
  end loop;
end $$;
