-- 0030 : « je n'ai pas joué ce pari » — passe un pari réel en test. Rien n'est supprimé : les mouvements de bankroll
-- déjà écrits sont compensés par un ajustement, et le pari continue d'être suivi et réglé comme un test.

create or replace function betwise.convert_bet_to_test(p_bet_id uuid)
 returns void language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare uid uuid := auth.uid(); b betwise.bets; v_sum numeric; v_fp text;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;
  if b.virtuel then raise exception 'déjà un test'; end if;
  if b.statut = 'annule' then raise exception 'pari annulé'; end if;

  v_fp := case when b.ticket_fingerprint is not null then 'test|' || b.ticket_fingerprint end;
  if v_fp is not null and exists (select 1 from betwise.bets x where x.user_id = uid and x.ticket_fingerprint = v_fp) then
    raise exception 'ce ticket existe déjà parmi tes tests';
  end if;

  select coalesce(sum(montant), 0) into v_sum from betwise.bankroll_transactions where bet_id = b.id;
  if v_sum <> 0 then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note)
    values (b.bankroll_id, 'ajustement', -v_sum, b.id, 'Pari non joué : passé en test');
  end if;
  update betwise.bets set virtuel = true, ticket_fingerprint = coalesce(v_fp, ticket_fingerprint) where id = b.id;

  -- Comme tout test, il nourrit la fiche de la source d'origine (jamais les sources système), sans doublon
  insert into betwise.predictions (source_id, match_id, market_code, market_param, selection, cote_annoncee, submitted_by, published_at)
  select s.origin_source_id, s.match_id, s.market_code, s.market_param, s.selection, s.cote, uid, b.placed_at
  from betwise.bet_selections s join betwise.sources src on src.id = s.origin_source_id and src.created_by is not null
  where s.bet_id = b.id and s.match_id is not null and s.prediction_id is null
  on conflict do nothing;
end $function$;

revoke execute on function betwise.convert_bet_to_test(uuid) from public, anon;
grant execute on function betwise.convert_bet_to_test(uuid) to authenticated, service_role;
