-- 0054 — Pas de règlement à la main avant la fin des matchs (audit UX du 22/11/2026, P1-4).
-- Même fonction que 0036, avec un contrôle de plus : tant qu'un match du pari n'est ni terminé ni annulé et que son coup
-- d'envoi date de moins de 2 h 15, le règlement est refusé. Les sélections sans match reconnu ne bloquent pas.
-- Réversible : réappliquer la définition de 0036.
create or replace function betwise.settle_bet(p_bet_id uuid, p_result betwise.settle_result)
 returns betwise.bets
 language plpgsql
 security definer
 set search_path to 'betwise', 'public'
as $function$
declare uid uuid := auth.uid(); b betwise.bets; v_gain numeric;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;
  if b.statut <> 'en_cours' then raise exception 'pari déjà réglé'; end if;
  if p_result not in ('gagne','perdu','rembourse') then raise exception 'résultat invalide'; end if;
  if exists (
    select 1 from betwise.bet_selections s join betwise.matches m on m.id = s.match_id
    where s.bet_id = b.id and m.statut not in ('termine', 'annule') and m.kickoff_at + interval '135 minutes' > now()
  ) then raise exception 'matchs pas encore terminés : règlement possible après le dernier match'; end if;
  v_gain := case
    when p_result = b.resultat_propose and b.gain_propose is not null then b.gain_propose
    when p_result = 'gagne' then round(b.mise * betwise.cote_payee(b.cote_totale, b.bookmaker), 2) - b.mise
    when p_result = 'perdu' then -b.mise else 0 end;
  insert into betwise.bet_versions (bet_id, changes, changed_by)
  values (b.id, jsonb_build_object('statut', jsonb_build_object('avant', b.statut, 'apres', p_result, 'propose', b.resultat_propose)), uid);
  update betwise.bets set statut = p_result::text::betwise.bet_status, gain_net = v_gain, settled_at = now() where id = b.id returning * into b;
  if p_result <> 'perdu' then
    update betwise.bet_selections set resultat = p_result, settled_at = now() where bet_id = b.id and resultat = 'en_attente';
  end if;
  if not b.virtuel then
    if p_result = 'gagne' then
      insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'gain', b.mise + v_gain, b.id, 'Gain');
    elsif p_result = 'rembourse' then
      insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'ajustement', b.mise, b.id, 'Remboursement');
    end if;
  end if;
  return b;
end $function$;
