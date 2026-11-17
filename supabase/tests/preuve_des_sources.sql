-- Test rejouable (orientation du 17/11) : un prono chargé après le coup d'envoi compte dans la note comme les autres ;
-- le moment de saisie reste une simple information. Rien n'est conservé : le bloc se termine par une exception.
-- Résultat attendu : « RAPPORT … 4/4 ok ».
do $$
declare v_uid uuid := 'a20c0945-ce54-4902-a842-bb50cfea6450'; v_src uuid; v_joue uuid; a betwise.source_proof; b betwise.source_proof;
  v_p1 uuid; n_ok int := 0; v_st1 text; v_res1 text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  select id into v_src from betwise.sources where nom = 'Informations foot international' limit 1;
  select id into v_joue from betwise.matches where statut = 'termine' and score_home > score_away order by kickoff_at desc limit 1;
  select * into a from betwise.source_proof where source_id = v_src;
  select prediction_id into v_p1 from betwise.log_prediction(v_src, '1X2', '1', v_joue, null, null, 1.50);
  perform betwise.settle_by_match(v_joue);
  select statut, resultat into v_st1, v_res1 from betwise.predictions where id = v_p1;
  select * into b from betwise.source_proof where source_id = v_src;
  if v_res1 = 'gagne' then n_ok := n_ok + 1; end if;                                                   -- réglé par le score
  if b.prouves = a.prouves + 1 and b.prouves_regles = a.prouves_regles + 1 and b.prouves_gagnes = a.prouves_gagnes + 1 then n_ok := n_ok + 1; end if;  -- il compte
  if b.prouves_unites = a.prouves_unites + 0.50 then n_ok := n_ok + 1; end if;                          -- rendement compris
  if v_st1 = 'declare' and b.apres_coup = a.apres_coup + 1 then n_ok := n_ok + 1; end if;               -- moment de saisie gardé pour information
  raise exception 'RAPPORT note des sources : %/4 ok (statut %, résultat %)', n_ok, v_st1, v_res1;
end $$;
