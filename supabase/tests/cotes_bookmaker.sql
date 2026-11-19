-- Test rejouable de replace_bookmaker_odds() et des droits de bookmaker_odds. Ne garde rien : tout se termine par une exception « RAPPORT ».
do $$
declare
  v_match uuid; v_fini uuid; n integer; r text := '';
  ok boolean;
begin
  -- de préférence un match qui a déjà un relevé d'un vrai bookmaker, pour vérifier qu'il n'est pas touché (point 5)
  select m.id into v_match from betwise.matches m where m.statut = 'programme' and m.kickoff_at > now() + interval '1 day'
  order by exists (select 1 from betwise.bookmaker_odds o where o.match_id = m.id) desc, m.kickoff_at limit 1;
  select id into v_fini from betwise.matches where statut = 'termine' order by kickoff_at desc limit 1;
  if v_match is null or v_fini is null then raise exception 'RAPPORT impossible : pas de match à venir ou terminé'; end if;

  -- 1. premier relevé : 4 lignes valables sur 7 (doublon, cote à 1, marché inconnu écartés)
  n := betwise.replace_bookmaker_odds('TEST-BK', 'test', jsonb_build_array(jsonb_build_object('match_id', v_match, 'releve_at', now() - interval '3 hours', 'rows', jsonb_build_array(
    jsonb_build_object('m', '1X2', 'p', null, 's', '1', 'c', 1.81),
    jsonb_build_object('m', '1X2', 'p', null, 's', '1', 'c', 1.99),
    jsonb_build_object('m', 'OU', 'p', 2.5, 's', 'Plus', 'c', 1.51),
    jsonb_build_object('m', 'OU', 'p', 3.5, 's', 'Plus', 'c', 2.38),
    jsonb_build_object('m', 'AH', 'p', -1.5, 's', '1', 'c', 2.9),
    jsonb_build_object('m', 'OU', 'p', 0.5, 's', 'Plus', 'c', 1.0),
    jsonb_build_object('m', 'MARCHE_INCONNU', 'p', null, 's', 'x', 'c', 2.0)))));
  r := r || case when n = 4 then 'ok' else 'ECHEC' end || ' 1 premier relevé : ' || n || ' lignes (attendu 4)' || E'\n';
  select count(*) = 1 into ok from betwise.bookmaker_odds where match_id = v_match and bookmaker = 'TEST-BK' and market_code = '1X2';
  r := r || case when ok then 'ok' else 'ECHEC' end || ' 2 une seule ligne par sélection' || E'\n';

  -- 3. un relevé plus ancien ne remplace pas le plus récent
  n := betwise.replace_bookmaker_odds('TEST-BK', 'test', jsonb_build_array(jsonb_build_object('match_id', v_match, 'releve_at', now() - interval '9 hours', 'rows', jsonb_build_array(jsonb_build_object('m', '1X2', 'p', null, 's', '1', 'c', 5.0)))));
  select count(*) = 4 and bool_and(releve_at > now() - interval '4 hours') into ok from betwise.bookmaker_odds where match_id = v_match and bookmaker = 'TEST-BK';
  r := r || case when n = 0 and ok then 'ok' else 'ECHEC' end || ' 3 relevé plus ancien ignoré' || E'\n';

  -- 4. un relevé plus récent remplace tout le relevé du match (la ligne disparue ne reste pas)
  n := betwise.replace_bookmaker_odds('TEST-BK', 'test', jsonb_build_array(jsonb_build_object('match_id', v_match, 'releve_at', now() - interval '1 hour', 'rows', jsonb_build_array(
    jsonb_build_object('m', '1X2', 'p', null, 's', '1', 'c', 1.75), jsonb_build_object('m', 'OU', 'p', 2.5, 's', 'Plus', 'c', 1.55)))));
  select count(*) = 2 and max(cote) filter (where market_code = '1X2') = 1.75 into ok from betwise.bookmaker_odds where match_id = v_match and bookmaker = 'TEST-BK';
  r := r || case when n = 2 and ok then 'ok' else 'ECHEC' end || ' 4 relevé plus récent : remplacement en bloc' || E'\n';

  -- 5. le relevé d'un autre bookmaker du même match n'est pas touché
  select count(*) into n from betwise.bookmaker_odds where match_id = v_match and bookmaker <> 'TEST-BK';
  perform betwise.replace_bookmaker_odds('TEST-BK', 'test', jsonb_build_array(jsonb_build_object('match_id', v_match, 'releve_at', now(), 'rows', jsonb_build_array(jsonb_build_object('m', '1X2', 'p', null, 's', 'N', 'c', 4.3)))));
  select count(*) = n into ok from betwise.bookmaker_odds where match_id = v_match and bookmaker <> 'TEST-BK';
  r := r || case when ok then 'ok' else 'ECHEC' end || ' 5 autres bookmakers du match intacts (' || n || ' lignes)' || E'\n';

  -- 6. un match terminé ne reçoit plus de relevé
  n := betwise.replace_bookmaker_odds('TEST-BK', 'test', jsonb_build_array(jsonb_build_object('match_id', v_fini, 'releve_at', now(), 'rows', jsonb_build_array(jsonb_build_object('m', '1X2', 'p', null, 's', '1', 'c', 1.5)))));
  r := r || case when n = 0 then 'ok' else 'ECHEC' end || ' 6 match terminé : rien écrit' || E'\n';

  -- 7. droits : lecture pour les comptes connectés seulement, écriture et fonction réservées au service
  r := r || case when has_table_privilege('authenticated', 'betwise.bookmaker_odds', 'select') and not has_table_privilege('anon', 'betwise.bookmaker_odds', 'select') then 'ok' else 'ECHEC' end || ' 7 lecture : connectés oui, anonymes non' || E'\n';
  r := r || case when not has_table_privilege('authenticated', 'betwise.bookmaker_odds', 'insert') and not has_table_privilege('authenticated', 'betwise.bookmaker_odds', 'delete') then 'ok' else 'ECHEC' end || ' 8 écriture interdite aux comptes connectés' || E'\n';
  r := r || case when not has_function_privilege('authenticated', 'betwise.replace_bookmaker_odds(text, text, jsonb)', 'execute') and not has_function_privilege('anon', 'betwise.replace_bookmaker_odds(text, text, jsonb)', 'execute') and has_function_privilege('service_role', 'betwise.replace_bookmaker_odds(text, text, jsonb)', 'execute') then 'ok' else 'ECHEC' end || ' 9 fonction réservée au service' || E'\n';
  r := r || case when not has_table_privilege('anon', 'betwise.mesures_probabilites', 'select') and has_table_privilege('authenticated', 'betwise.mesures_probabilites', 'select') and not has_table_privilege('authenticated', 'betwise.mesures_probabilites', 'insert') then 'ok' else 'ECHEC' end || ' 10 mesures_probabilites : lecture seule pour les comptes connectés' || E'\n';

  raise exception E'RAPPORT\n%', r;
end $$;
