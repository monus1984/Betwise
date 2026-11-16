-- Test rejouable : un prono saisi après le coup d'envoi n'entre ni dans la note ni dans le classement, même gagné.
-- Rien n'est conservé : le bloc se termine par une exception qui annule tout. Résultat attendu : « RAPPORT … 5/5 ok ».
do $$
declare v_uid uuid := 'a20c0945-ce54-4902-a842-bb50cfea6450'; v_src uuid; v_joue uuid; v_avenir uuid; a betwise.source_proof; b betwise.source_proof;
  v_p1 uuid; v_p2 uuid; n_ok int := 0; v_st1 text; v_st2 text; v_res1 text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  select id into v_src from betwise.sources where nom = 'Informations foot international' limit 1;
  select id into v_joue from betwise.matches where statut = 'termine' and score_home > score_away order by kickoff_at desc limit 1;
  select id into v_avenir from betwise.matches where statut = 'programme' and kickoff_at > now() + interval '1 hour' order by kickoff_at limit 1;
  select * into a from betwise.source_proof where source_id = v_src;

  -- 1. Prono « victoire à domicile » saisi après un match déjà gagné à domicile
  select prediction_id into v_p1 from betwise.log_prediction(v_src, '1X2', '1', v_joue, null, null, 1.50);
  perform betwise.settle_by_match(v_joue);
  select statut, resultat into v_st1, v_res1 from betwise.predictions where id = v_p1;
  if v_st1 = 'declare' then n_ok := n_ok + 1; end if;                      -- rangé « saisi après le match »
  if v_res1 = 'gagne' then n_ok := n_ok + 1; end if;                       -- et pourtant gagné
  select * into b from betwise.source_proof where source_id = v_src;
  if b.prouves = a.prouves and b.prouves_regles = a.prouves_regles and b.prouves_gagnes = a.prouves_gagnes and b.prouves_unites = a.prouves_unites then n_ok := n_ok + 1; end if;  -- la note ne bouge pas
  if b.apres_coup = a.apres_coup + 1 then n_ok := n_ok + 1; end if;        -- il est compté à part

  -- 2. Prono saisi avant le coup d'envoi : prouvé
  select prediction_id into v_p2 from betwise.log_prediction(v_src, '1X2', '1', v_avenir, null, null, 1.50);
  select statut into v_st2 from betwise.predictions where id = v_p2;
  if v_st2 = 'verifie' then n_ok := n_ok + 1; end if;

  raise exception 'RAPPORT preuve des sources : %/5 ok (après coup : statut %, résultat % ; avant : statut %)', n_ok, v_st1, v_res1, v_st2;
end $$;
