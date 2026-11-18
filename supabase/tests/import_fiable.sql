-- Test rejouable de la migration 0045 : pari gardé tel quel (« LIBRE »), règlement d'une ligne à la main,
-- nouveaux marchés (mi-temps, penalty, doublé), registre des libellés non compris.
-- Tout se passe dans un seul bloc qui se termine par une exception : RIEN n'est conservé en base.
-- Le compte rendu est le texte de l'erreur finale (« RAPPORT … »). Une ligne « ECHEC » = un contrôle raté.
-- À lancer avec un rôle d'administration (éditeur SQL Supabase). A = compte principal, B = un autre compte.
do $$
declare
  a uuid := 'a20c0945-ce54-4902-a842-bb50cfea6450'; b uuid := 'b36c02a5-eae8-4782-a481-584190c95c07';
  src_a uuid := 'd55780c0-049e-452c-9732-ac6dd16e81ec'; m uuid := '52c49d37-516f-4db6-a392-1e790bc7b5f5'; -- France–Turquie, terminé 2-1
  mp uuid; admin text := current_user; r text := ''; n int; n2 int; st text; pr text; g numeric; s0 numeric; s1 numeric;
  v_test uuid; v_reel uuid; v_avenir uuid; sel_libre uuid; sel_1x2 uuid; sel_reel uuid; sel_avenir uuid; t0 timestamptz := clock_timestamp();
begin
  select id into mp from betwise.matches where statut = 'programme' and kickoff_at > now() + interval '2 hours' order by kickoff_at limit 1;
  select solde into s0 from betwise.my_bankroll_summary where user_id = a;

  -- ===== Règlement sur le score : nouveaux marchés =====
  r := r || case when betwise.settle_selection('WEH', null, '2', 2, 3, 1, 1) = 'gagne' and betwise.settle_selection('WEH', null, '1', 2, 3, 1, 1) = 'perdu' then 'ok   ' else 'ECHEC' end || ' gagne au moins une mi-temps (2-3, mi-temps 1-1)' || E'\n';
  r := r || case when betwise.settle_selection('BH', null, 'Oui', 1, 0, 1, 0) = 'perdu' and betwise.settle_selection('BH', null, 'Oui', 1, 1, 1, 0) = 'gagne' then 'ok   ' else 'ECHEC' end || ' but dans les deux mi-temps' || E'\n';
  r := r || case when betwise.settle_selection('H2_BTTS', null, 'Oui', 2, 2, 1, 0) = 'gagne' and betwise.settle_selection('HT_TT1', 0.5, 'Plus', 2, 0, 0, 0) = 'perdu' then 'ok   ' else 'ECHEC' end || ' marchés par mi-temps (les deux marquent en 2e, buts d''une équipe en 1re)' || E'\n';
  r := r || case when betwise.settle_selection('WEH', null, '1', 1, 0, null, null) = 'en_attente' then 'ok   ' else 'ECHEC' end || ' sans score à la mi-temps : pas de règlement' || E'\n';
  r := r || case when betwise.settle_selection('LIBRE', null, 'Joueur fictif décisif', 2, 1, 1, 0) = 'en_attente' then 'ok   ' else 'ECHEC' end || ' un pari gardé tel quel ne se règle jamais seul' || E'\n';
  select count(*) filter (where betwise.settle_sel('PKB', null, 'Oui', x) = case when exists (select 1 from jsonb_array_elements(x.details->'evts') e where e->>'t' = 'pen') then 'gagne'::betwise.settle_result else 'perdu'::betwise.settle_result end), count(*)
    into n, n2 from betwise.matches x where x.statut = 'termine' and x.details_at is not null and x.details->'buteurs' is not null and jsonb_typeof(x.details->'evts') = 'array';
  r := r || case when n = n2 and n2 > 0 then 'ok   ' else 'ECHEC' end || ' but sur penalty : ' || n || ' matchs sur ' || n2 || ' réglés comme la feuille de match' || E'\n';
  select count(*) into n from betwise.matches x where x.statut = 'termine' and x.details_at is null and betwise.settle_sel('PK', null, 'Oui', x) <> 'en_attente';
  r := r || case when n = 0 then 'ok   ' else 'ECHEC' end || ' penalty : aucun règlement tant que le détail du match n''est pas définitif (' || n || ')' || E'\n';

  -- ===== En tant que A : un test avec une ligne gardée telle quelle =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_test := betwise.place_bet(p_mise => 1000, p_source_import => 'texte', p_placed_at => now() - interval '6 days', p_summary => '{"bookmaker":"Essai"}'::jsonb, p_virtuel => true,
    p_selections => jsonb_build_array(
      jsonb_build_object('match_id', m, 'market_code', 'LIBRE', 'selection', 'Joueur ou son remplaçant décisif : Joueur fictif', 'cote', 1.6, 'origin_source_id', src_a),
      jsonb_build_object('match_id', m, 'market_code', '1X2', 'selection', '1', 'cote', 1.5, 'origin_source_id', src_a)));
  perform betwise.bet_recheck(v_test);
  perform set_config('role', admin, true);
  select id into sel_libre from betwise.bet_selections where bet_id = v_test and market_code = 'LIBRE';
  select id into sel_1x2 from betwise.bet_selections where bet_id = v_test and market_code = '1X2';
  select count(*) into n from betwise.odds_observations where market_code = 'LIBRE';
  select count(*) into n2 from betwise.predictions where market_code = 'LIBRE';
  r := r || case when n = 0 and n2 = 0 then 'ok   ' else 'ECHEC' end || ' la ligne gardée telle quelle ne nourrit ni les cotes observées (' || n || ') ni les pronos d''une source (' || n2 || ')' || E'\n';
  select statut::text into st from betwise.bets where id = v_test;
  select string_agg(market_code || '=' || resultat, ', ' order by market_code) into pr from betwise.bet_selections where bet_id = v_test;
  r := r || case when st = 'en_cours' and pr = '1X2=gagne, LIBRE=en_attente' then 'ok   ' else 'ECHEC' end || ' après accord avec le score : pari ' || st || ' (' || pr || ')' || E'\n';

  perform set_config('role', 'authenticated', true);
  begin perform betwise.set_selection_result(sel_1x2, 'perdu'); r := r || 'ECHEC une ligne réglée sur le score a été changée à la main' || E'\n';
  exception when others then r := r || 'ok    une ligne réglée sur le score ne se change pas à la main : ' || sqlerrm || E'\n'; end;
  perform betwise.set_selection_result(sel_libre, 'gagne');
  perform set_config('role', admin, true);
  select statut::text, gain_net into st, g from betwise.bets where id = v_test;
  select count(*) into n from betwise.bet_versions where selection_id = sel_libre and changes->>'motif' = 'ligne réglée à la main';
  r := r || case when st = 'gagne' and g = 1400 and n = 1 then 'ok   ' else 'ECHEC' end || ' ligne réglée « gagnée » à la main : test ' || st || ', gain ' || g || ' (attendu 1400), ' || n || ' trace dans l''historique' || E'\n';
  perform set_config('role', 'authenticated', true);
  begin perform betwise.set_selection_result(sel_libre, 'en_attente'); r := r || 'ECHEC ligne d''un pari réglé remise en attente' || E'\n';
  exception when others then r := r || 'ok    pari réglé : la ligne ne bouge plus : ' || sqlerrm || E'\n'; end;

  -- ===== Pari réel : rien n'entre dans la bankroll sans confirmation, et l'erreur se rattrape =====
  v_reel := betwise.place_bet(p_mise => 500, p_source_import => 'texte', p_placed_at => now() - interval '6 days', p_summary => '{"bookmaker":"Essai"}'::jsonb, p_virtuel => false,
    p_selections => jsonb_build_array(jsonb_build_object('match_id', m, 'market_code', 'LIBRE', 'selection', 'Double chance buteur : Joueur Un / Joueur Deux', 'cote', 2, 'origin_source_id', src_a)));
  perform set_config('role', admin, true);
  select id into sel_reel from betwise.bet_selections where bet_id = v_reel;
  perform set_config('role', 'authenticated', true);
  perform betwise.set_selection_result(sel_reel, 'gagne');
  perform set_config('role', admin, true);
  select statut::text, resultat_propose::text, gain_propose into st, pr, g from betwise.bets where id = v_reel;
  select solde into s1 from betwise.my_bankroll_summary where user_id = a;
  r := r || case when st = 'en_cours' and pr = 'gagne' and g = 500 and s1 = s0 - 500 then 'ok   ' else 'ECHEC' end || ' pari réel : ' || st || ', proposition ' || coalesce(pr, '—') || ' (gain ' || coalesce(g::text, '—') || '), bankroll ' || (s1 - s0) || ' (seule la mise est sortie)' || E'\n';
  perform set_config('role', 'authenticated', true);
  perform betwise.set_selection_result(sel_reel, 'en_attente');
  perform set_config('role', admin, true);
  select statut::text, resultat_propose::text into st, pr from betwise.bets where id = v_reel;
  r := r || case when st = 'en_cours' and pr is null then 'ok   ' else 'ECHEC' end || ' ligne remise en attente : proposition retirée (' || coalesce(pr, 'aucune') || ')' || E'\n';
  perform set_config('role', 'authenticated', true);
  perform betwise.set_selection_result(sel_reel, 'perdu');
  perform set_config('role', admin, true);
  select statut::text, resultat_propose::text, gain_propose into st, pr, g from betwise.bets where id = v_reel;
  r := r || case when st = 'en_cours' and pr = 'perdu' and g = -500 then 'ok   ' else 'ECHEC' end || ' puis « perdue » : proposition ' || coalesce(pr, '—') || ' (gain ' || coalesce(g::text, '—') || ')' || E'\n';

  -- ===== Match pas encore joué : pas de règlement à la main =====
  if mp is not null then
    perform set_config('role', 'authenticated', true);
    v_avenir := betwise.place_bet(p_mise => 1000, p_source_import => 'manuel', p_virtuel => true,
      p_selections => jsonb_build_array(jsonb_build_object('match_id', mp, 'market_code', 'LIBRE', 'selection', 'Joueur fictif buteur ou passeur', 'cote', 1.8, 'origin_source_id', src_a)));
    perform set_config('role', admin, true);
    select id into sel_avenir from betwise.bet_selections where bet_id = v_avenir;
    perform set_config('role', 'authenticated', true);
    begin perform betwise.set_selection_result(sel_avenir, 'gagne'); r := r || 'ECHEC ligne réglée avant la fin du match' || E'\n';
    exception when others then r := r || 'ok    match à venir : ' || sqlerrm || E'\n'; end;
  else
    r := r || 'ok    (aucun match à venir en base : contrôle sauté)' || E'\n';
  end if;

  -- ===== Registre des libellés non compris =====
  perform set_config('role', 'authenticated', true);
  perform betwise.log_libelle_inconnu('Essai', 'ticket', 'Marché de contrôle 0045', 'Choix de contrôle', 'raison');
  perform betwise.log_libelle_inconnu('essai', 'ticket', 'MARCHÉ DE CONTRÔLE 0045', 'choix de contrôle', 'raison');
  begin select count(*) into n from betwise.libelles_inconnus; r := r || 'ECHEC un compte connecté lit le registre (' || n || ')' || E'\n';
  exception when others then r := r || 'ok    un compte connecté ne lit pas le registre : ' || left(sqlerrm, 60) || E'\n'; end;
  perform set_config('role', admin, true);
  select count(*), max(x.n) into n, n2 from betwise.libelles_inconnus x where lower(x.marche) = 'marché de contrôle 0045';
  r := r || case when n = 1 and n2 = 2 then 'ok   ' else 'ECHEC' end || ' même libellé vu deux fois : ' || n || ' ligne, compteur à ' || n2 || E'\n';

  -- ===== En tant que B : les lignes de A sont hors de portée =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform betwise.set_selection_result(sel_reel, 'gagne'); r := r || 'ECHEC B a réglé une ligne de A' || E'\n';
  exception when others then r := r || 'ok    B ne peut pas régler une ligne de A : ' || sqlerrm || E'\n'; end;
  perform set_config('request.jwt.claims', '', true);
  begin perform betwise.set_selection_result(sel_reel, 'gagne'); r := r || 'ECHEC ligne réglée sans être connecté' || E'\n';
  exception when others then r := r || 'ok    sans connexion : ' || left(sqlerrm, 60) || E'\n'; end;
  perform set_config('role', admin, true);

  raise exception E'RAPPORT (rien n''est conservé, % ms)\n%', round(extract(epoch from clock_timestamp() - t0) * 1000), r;
end $$;
