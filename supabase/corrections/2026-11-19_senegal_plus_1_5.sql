-- Correction de données du 19/11/2026 — « Sénégal +1,5 » (publication « Abdoul Koudouss » du 12/11).
-- L'utilisateur confirme le 19/11 (08:28) : « Sénégal +1,5 » = le Sénégal marque au moins 2 buts.
-- L'analyseur avait lu « +1,5 » (équipe nommée seule : Sénégal) comme le total du match : erreur de lecture, corrigée
-- d'après le texte conservé à l'import (uploads 59e31fc4, ligne 4). Pari test, aucun mouvement de bankroll.
-- Sénégal – Soudan 4-1 : le résultat ne change pas (gagné dans les deux lectures).
-- « Turquie 1BUT+ 3 CORNERS » n'a jamais été enregistré (ni pari ni prono) : rien à corriger. Turquie – Belgique 1-2,
-- corners 2-3 : il aurait été perdu (1 but mais 2 corners).
-- APPLIQUÉE le 19/11/2026 vers 09:00 UTC : ligne 24250cbb et prono 74b362f3 recodés OU 1,5 Plus → TT1 1,5 Plus, résultat gagné inchangé,
-- versions tracées, compute_source_metrics() relancé. Contrôle de cohérence ensuite : tout à 0.
do $$
declare s betwise.bet_selections; m betwise.matches; p betwise.predictions; v_res betwise.settle_result; v_key text;
  v_motif text := 'erreur de lecture de l''analyseur corrigée le 19/11 d''après le libellé conservé — publication du 12/11 : « Sénégal +1,5 » (le Sénégal marque au moins 2 buts, lecture confirmée par l''utilisateur)';
  v_marche jsonb := jsonb_build_object('avant', 'OU 1.50 Plus', 'apres', 'TT1 1.50 Plus');
begin
  select * into s from betwise.bet_selections where id = '24250cbb-addb-4596-97a1-5719ee5fdb9f' for update;
  if s.market_code <> 'OU' or s.market_param <> 1.5 or s.selection <> 'Plus' then raise exception 'ligne : état inattendu'; end if;
  select * into m from betwise.matches where id = s.match_id;
  v_res := betwise.settle_sel('TT1', 1.5, 'Plus', m);
  if v_res <> s.resultat then raise exception 'le résultat changerait (% → %) : à revoir', s.resultat, v_res; end if;
  update betwise.bet_selections set market_code = 'TT1' where id = s.id;
  insert into betwise.bet_versions (bet_id, selection_id, changes, changed_by)
  values (s.bet_id, s.id, jsonb_build_object('marche', v_marche, 'resultat', jsonb_build_object('avant', s.resultat, 'apres', v_res), 'motif', v_motif), null);
  select * into p from betwise.predictions where id = '74b362f3-ed90-4acb-8995-5d5928b296d3' for update;
  if p.market_code <> 'OU' or p.market_param <> 1.5 or p.selection <> 'Plus' then raise exception 'prono : état inattendu'; end if;
  v_key := p.source_id || '|' || p.match_id || '|TT1|1.50|plus|' || to_char(coalesce(p.published_at, p.logged_at) at time zone 'UTC', 'YYYY-MM-DD');
  if exists (select 1 from betwise.predictions q where q.dedupe_key = v_key and q.id <> p.id) then raise exception 'prono identique déjà présent'; end if;
  update betwise.predictions set market_code = 'TT1', dedupe_key = v_key where id = p.id;
  insert into betwise.prediction_versions (prediction_id, changes, changed_by)
  values (p.id, jsonb_build_object('marche', v_marche, 'resultat', jsonb_build_object('avant', p.resultat, 'apres', v_res), 'motif', v_motif), null);
  perform betwise.compute_source_metrics();
end $$;
