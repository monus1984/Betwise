-- 0031 : corriger le résultat d'un pari déjà réglé (réglage automatique faux, erreur de saisie).
-- Rien n'est supprimé : l'écart de bankroll est compensé par un ajustement et le changement est journalisé.

create or replace function betwise.correct_bet_result(p_bet_id uuid, p_result betwise.settle_result)
 returns void language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare uid uuid := auth.uid(); b betwise.bets; v_gain numeric; v_cible numeric; v_actuel numeric; v_cote numeric;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;
  if b.statut not in ('gagne', 'perdu', 'rembourse') then raise exception 'pari pas encore réglé'; end if;
  if p_result not in ('gagne', 'perdu', 'rembourse') then raise exception 'résultat invalide'; end if;
  if b.statut::text = p_result::text then return; end if;

  -- Cote du ticket : produit des cotes des sélections quand le détail existe, sinon la cote totale enregistrée
  select coalesce(exp(sum(ln(cote))), b.cote_totale) into v_cote from betwise.bet_selections where bet_id = b.id;
  v_gain := case p_result when 'gagne' then round(b.mise * v_cote, 2) - b.mise when 'perdu' then -b.mise else 0 end;

  if not b.virtuel then
    v_cible := v_gain;                                   -- effet net voulu sur la bankroll : -mise, 0 ou gain net
    select coalesce(sum(montant), 0) into v_actuel from betwise.bankroll_transactions where bet_id = b.id;
    if v_cible <> v_actuel then
      insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note)
      values (b.bankroll_id, 'ajustement', v_cible - v_actuel, b.id, 'Résultat corrigé');
    end if;
  end if;

  insert into betwise.bet_versions (bet_id, changes, changed_by)
  values (b.id, jsonb_build_object('statut', jsonb_build_object('avant', b.statut, 'apres', p_result)), uid);
  update betwise.bets set statut = p_result::text::betwise.bet_status, gain_net = v_gain, settled_at = now(),
         cote_totale = case when p_result = 'gagne' then round(v_cote, 3) else cote_totale end where id = b.id;
  -- Les résultats ligne par ligne ne sont pas touchés : ils servent à noter les sources et restent ceux des matchs.
end $function$;

revoke execute on function betwise.correct_bet_result(uuid, betwise.settle_result) from public, anon;
grant execute on function betwise.correct_bet_result(uuid, betwise.settle_result) to authenticated, service_role;
