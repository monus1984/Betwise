-- 0032 : combiné « Assurance » (Betclic) — si une seule sélection perd, la mise est remboursée.
-- bets.assurance, finalize_bet() en tient compte, set_bet_assurance() pour le poser à l'import ou le corriger.

alter table betwise.bets add column if not exists assurance boolean not null default false;

create or replace function betwise.finalize_bet(p_bet_id uuid) returns void language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare b betwise.bets; n_pending int; n_lost int; v_cote numeric; v_gain numeric; v_result betwise.bet_status;
begin
  select * into b from betwise.bets where id = p_bet_id for update;
  if b.statut <> 'en_cours' then return; end if;
  select count(*) filter (where resultat = 'en_attente'), count(*) filter (where resultat = 'perdu'), coalesce(exp(sum(ln(cote)) filter (where resultat = 'gagne')), 1)
    into n_pending, n_lost, v_cote from betwise.bet_selections where bet_id = b.id;
  if n_lost > 1 or (n_lost = 1 and not b.assurance) then v_result := 'perdu'; v_gain := -b.mise;
  elsif n_pending > 0 then return;
  elsif n_lost = 1 then v_result := 'rembourse'; v_gain := 0;   -- combiné assuré : une seule sélection perdue
  else
    if v_cote = 1 then v_result := 'rembourse'; v_gain := 0;
    else v_result := 'gagne'; v_gain := round(b.mise * v_cote, 2) - b.mise; end if;
  end if;
  update betwise.bets set statut = v_result, gain_net = v_gain, settled_at = now(), cote_totale = case when v_result='gagne' then round(v_cote,3) else cote_totale end where id = b.id;
  if b.virtuel then return; end if;
  if v_result = 'gagne' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'gain', b.mise + v_gain, b.id, 'Gain (auto)');
  elsif v_result = 'rembourse' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'ajustement', b.mise, b.id, case when n_lost = 1 then 'Remboursement (assurance)' else 'Remboursement (auto)' end);
  end if;
end $function$;

create or replace function betwise.set_bet_assurance(p_bet_id uuid, p_on boolean)
 returns void language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare uid uuid := auth.uid(); b betwise.bets;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;
  update betwise.bets set assurance = coalesce(p_on, false) where id = b.id;
  if b.statut = 'en_cours' then perform betwise.finalize_bet(b.id); end if;
end $function$;

revoke execute on function betwise.set_bet_assurance(uuid, boolean) from public, anon;
grant execute on function betwise.set_bet_assurance(uuid, boolean) to authenticated, service_role;
