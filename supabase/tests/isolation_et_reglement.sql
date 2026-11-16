-- Test rejouable : étanchéité entre deux comptes, écritures directes fermées, règlement réel sur confirmation.
-- Tout se passe dans un seul bloc qui se termine par une exception : RIEN n'est conservé en base.
-- Le compte rendu est le texte de l'erreur finale (« RAPPORT … »). Une ligne « ECHEC » = un contrôle raté.
-- À lancer avec un rôle d'administration (éditeur SQL Supabase). A = compte principal, B = un autre compte.
do $$
declare
  a uuid := 'a20c0945-ce54-4902-a842-bb50cfea6450'; b uuid := 'b36c02a5-eae8-4782-a481-584190c95c07';
  src_a uuid := 'd55780c0-049e-452c-9732-ac6dd16e81ec'; m uuid := '52c49d37-516f-4db6-a392-1e790bc7b5f5'; -- France–Turquie, terminé 2-1
  admin text := current_user; r text := ''; n int; v_bet uuid; v_test uuid; v_a_bet uuid; s0 numeric; s1 numeric; s2 numeric; st text; pr text; ntx int;
  procedure_ok boolean;
begin
  select id into v_a_bet from betwise.bets where user_id = a and not virtuel limit 1;
  select solde into s0 from betwise.my_bankroll_summary where user_id = a;

  -- ===== En tant que B (rôle authenticated, jeton de B) =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select count(*) into n from betwise.bets where user_id = a;                         r := r || case when n = 0 then 'ok   ' else 'ECHEC' end || ' B ne voit aucun pari de A (' || n || ')' || E'\n';
  select count(*) into n from betwise.bet_selections s where s.bet_id = v_a_bet;      r := r || case when n = 0 then 'ok   ' else 'ECHEC' end || ' B ne voit aucune sélection de A (' || n || ')' || E'\n';
  select count(*) into n from betwise.bankroll_transactions t join betwise.bankrolls k on k.id = t.bankroll_id where k.user_id = a;
                                                                                      r := r || case when n = 0 then 'ok   ' else 'ECHEC' end || ' B ne voit aucun mouvement de bankroll de A (' || n || ')' || E'\n';
  select count(*) into n from betwise.my_bankroll_summary where user_id = a;           r := r || case when n = 0 then 'ok   ' else 'ECHEC' end || ' B ne voit pas le solde de A (' || n || ')' || E'\n';
  select count(*) into n from betwise.messages;                                        r := r || case when n = 0 then 'ok   ' else 'ECHEC' end || ' B ne voit aucun message du Coach d''un autre (' || n || ')' || E'\n';
  select count(*) into n from betwise.uploads where user_id = a;                       r := r || case when n = 0 then 'ok   ' else 'ECHEC' end || ' B ne voit aucune capture de A (' || n || ')' || E'\n';
  select count(*) into n from betwise.notifications where user_id = a;                 r := r || case when n = 0 then 'ok   ' else 'ECHEC' end || ' B ne voit aucune notification de A (' || n || ')' || E'\n';
  select count(*) into n from betwise.objectifs where user_id = a;                     r := r || case when n = 0 then 'ok   ' else 'ECHEC' end || ' B ne voit pas l''objectif de A (' || n || ')' || E'\n';

  begin perform betwise.settle_bet(v_a_bet, 'gagne');           r := r || 'ECHEC B a réglé un pari de A' || E'\n'; exception when others then r := r || 'ok    B ne peut pas régler un pari de A : ' || sqlerrm || E'\n'; end;
  begin perform betwise.correct_bet_result(v_a_bet, 'gagne');   r := r || 'ECHEC B a corrigé un pari de A' || E'\n'; exception when others then r := r || 'ok    B ne peut pas corriger un pari de A : ' || sqlerrm || E'\n'; end;
  begin perform betwise.convert_bet_to_test(v_a_bet);           r := r || 'ECHEC B a converti un pari de A' || E'\n'; exception when others then r := r || 'ok    B ne peut pas passer en test un pari de A : ' || sqlerrm || E'\n'; end;
  begin perform betwise.set_bet_assurance(v_a_bet, true);       r := r || 'ECHEC B a modifié l''assurance d''un pari de A' || E'\n'; exception when others then r := r || 'ok    B ne peut pas toucher à l''assurance d''un pari de A : ' || sqlerrm || E'\n'; end;
  begin perform betwise.settle_by_match(m);                     r := r || 'ECHEC B a lancé le règlement d''un match' || E'\n'; exception when others then r := r || 'ok    B ne peut pas lancer le règlement automatique : ' || left(sqlerrm, 60) || E'\n'; end;
  begin perform betwise.place_bet(1000::numeric, '[]'::jsonb, 'manuel'::betwise.import_channel, null::text, null::uuid, null::timestamptz);
                                                                r := r || 'ECHEC l''ancien place_bet répond encore' || E'\n'; exception when others then r := r || 'ok    ancien place_bet fermé : ' || left(sqlerrm, 60) || E'\n'; end;

  -- écritures directes, y compris sur SES propres données
  begin insert into betwise.bankroll_transactions (bankroll_id, type, montant, note) select id, 'depot', 1000000, 'triche' from betwise.bankrolls where user_id = b;
        r := r || 'ECHEC B s''est crédité 1 000 000 en écrivant dans la table' || E'\n'; exception when others then r := r || 'ok    insertion directe dans bankroll_transactions refusée : ' || left(sqlerrm, 70) || E'\n'; end;
  begin update betwise.bankrolls set capital_initial = 999999 where user_id = b; get diagnostics n = row_count;
        r := r || 'ECHEC B a modifié son capital directement (' || n || ')' || E'\n'; exception when others then r := r || 'ok    modification directe de bankrolls refusée : ' || left(sqlerrm, 70) || E'\n'; end;
  begin update betwise.bets set statut = 'gagne', gain_net = 500000 where user_id = b; get diagnostics n = row_count;
        r := r || 'ECHEC B a modifié un pari directement (' || n || ')' || E'\n'; exception when others then r := r || 'ok    modification directe de bets refusée : ' || left(sqlerrm, 70) || E'\n'; end;
  begin delete from betwise.bets where user_id = b; r := r || 'ECHEC B a supprimé des paris directement' || E'\n'; exception when others then r := r || 'ok    suppression directe de bets refusée : ' || left(sqlerrm, 70) || E'\n'; end;
  begin insert into betwise.predictions (source_id, match_id, market_code, selection, submitted_by, published_at) values (src_a, m, '1X2', '1', b, now() - interval '3 days');
        r := r || 'ECHEC B a inséré un prono antidaté directement' || E'\n'; exception when others then r := r || 'ok    insertion directe dans predictions refusée : ' || left(sqlerrm, 70) || E'\n'; end;
  begin update betwise.matches set score_home = 9 where id = m; get diagnostics n = row_count;
        r := r || 'ECHEC B a modifié un score (' || n || ')' || E'\n'; exception when others then r := r || 'ok    modification directe de matches refusée : ' || left(sqlerrm, 70) || E'\n'; end;

  perform betwise.bankroll_align(123456);   -- B recale SA bankroll : celle de A ne doit pas bouger
  perform set_config('role', admin, true);
  select solde into s1 from betwise.my_bankroll_summary where user_id = a;
  r := r || case when s1 = s0 then 'ok   ' else 'ECHEC' end || ' le recalage de B n''a pas touché la bankroll de A' || E'\n';

  -- ===== En tant que A : un pari réel et un test sur un match déjà terminé =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v_bet  := betwise.place_bet(1000, jsonb_build_array(jsonb_build_object('match_id', m, 'market_code', '1X2', 'selection', '1', 'cote', '1.50', 'origin_source_id', src_a)), 'manuel', null, null, now(), jsonb_build_object('bookmaker', 'Betclic'), false);
  v_test := betwise.place_bet(1000, jsonb_build_array(jsonb_build_object('match_id', m, 'market_code', '1X2', 'selection', '1', 'cote', '1.50', 'origin_source_id', src_a)), 'manuel', null, null, now(), null, true);
  perform set_config('role', admin, true);
  select solde into s1 from betwise.my_bankroll_summary where user_id = a;
  r := r || case when s1 = s0 - 1000 then 'ok   ' else 'ECHEC' end || ' pari réel : la mise (1 000) sort de la bankroll, le test n''y touche pas (' || (s1 - s0) || ')' || E'\n';

  -- règlement automatique (tâche planifiée, sans utilisateur)
  perform set_config('request.jwt.claims', '', true);
  perform betwise.settle_by_match(m);
  select statut::text, resultat_propose::text into st, pr from betwise.bets where id = v_bet;
  select count(*) into ntx from betwise.bankroll_transactions where bet_id = v_bet and type <> 'mise';
  select solde into s2 from betwise.my_bankroll_summary where user_id = a;
  r := r || case when st = 'en_cours' and pr = 'gagne' and ntx = 0 and s2 = s1 then 'ok   ' else 'ECHEC' end || ' pari réel après le match : statut ' || st || ', proposé ' || coalesce(pr, '∅') || ', ' || ntx || ' mouvement de gain, bankroll inchangée' || E'\n';
  select statut::text into st from betwise.bets where id = v_test;
  r := r || case when st = 'gagne' then 'ok   ' else 'ECHEC' end || ' test après le match : réglé tout seul (' || st || ')' || E'\n';
  select count(*) into n from betwise.notifications where user_id = a and cle = 'prop:' || v_bet || ':gagne';
  r := r || case when n = 1 then 'ok   ' else 'ECHEC' end || ' une notification « résultat à confirmer » est en file (' || n || '), sans montant' || E'\n';

  -- confirmation par A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform betwise.settle_bet(v_bet, 'gagne');
  perform set_config('role', admin, true);
  select statut::text into st from betwise.bets where id = v_bet;
  select solde into s2 from betwise.my_bankroll_summary where user_id = a;
  r := r || case when st = 'gagne' and s2 = s0 + 500 then 'ok   ' else 'ECHEC' end || ' après confirmation : statut ' || st || ', bankroll ' || (s2 - s0) || ' par rapport au départ (attendu +500)' || E'\n';

  raise exception E'RAPPORT (rien n''est conservé)\n%', r;
end $$;
