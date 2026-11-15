-- 0034 : recaler la bankroll sur le solde réel du bookmaker. Un seul mouvement d'ajustement, daté et noté,
-- égal à l'écart entre le solde déclaré et le solde calculé : rien n'est effacé, l'écart reste visible dans le journal.

create or replace function betwise.bankroll_align(p_solde numeric)
 returns numeric language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare uid uuid := auth.uid(); k betwise.bankrolls; v_actuel numeric; v_ecart numeric;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  if p_solde is null or p_solde < 0 or p_solde > 1000000000 then raise exception 'solde invalide'; end if;
  select * into k from betwise.bankrolls where user_id = uid and active for update;
  if k.id is null then raise exception 'bankroll introuvable'; end if;
  select k.capital_initial + coalesce(sum(montant), 0) into v_actuel from betwise.bankroll_transactions where bankroll_id = k.id;
  v_ecart := round(p_solde - v_actuel, 2);
  if v_ecart <> 0 then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, note)
    values (k.id, 'ajustement', v_ecart, 'Recalage sur le solde réel du bookmaker (' || round(p_solde)::text || ')');
  end if;
  return v_ecart;
end $function$;

revoke execute on function betwise.bankroll_align(numeric) from public, anon;
grant execute on function betwise.bankroll_align(numeric) to authenticated, service_role;
