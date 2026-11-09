-- 0004 : enregistrement atomique d'un pari et règlement manuel.
-- Copie exacte de la migration appliquée le 2026-11-09.

create or replace function betwise.place_bet(
  p_mise numeric,
  p_selections jsonb,
  p_source_import betwise.import_channel default 'manuel',
  p_raw_text text default null,
  p_upload_id uuid default null,
  p_placed_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = betwise, public as $$
declare
  uid uuid := auth.uid();
  v_bankroll uuid;
  v_bet uuid;
  v_cote_totale numeric := 1;
  v_n int;
  s jsonb;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  if p_mise is null or p_mise <= 0 then raise exception 'mise invalide'; end if;
  v_n := jsonb_array_length(coalesce(p_selections, '[]'::jsonb));
  if v_n = 0 then raise exception 'aucune sélection'; end if;

  select id into v_bankroll from betwise.bankrolls where user_id = uid and active;
  if v_bankroll is null then raise exception 'bankroll introuvable, appeler ensure_profile()'; end if;

  for s in select * from jsonb_array_elements(p_selections) loop
    if (s->>'origin_source_id') is null then raise exception 'origine manquante sur une sélection'; end if;
    if not exists (
      select 1 from betwise.sources src where src.id = (s->>'origin_source_id')::uuid
        and (src.visibilite = 'partagee' or src.created_by = uid or src.type = 'modele_betwise')
    ) then raise exception 'origine inconnue'; end if;
    if (s->>'cote')::numeric <= 1 then raise exception 'cote invalide'; end if;
    v_cote_totale := v_cote_totale * (s->>'cote')::numeric;
  end loop;

  insert into betwise.bets (user_id, bankroll_id, type, mise, cote_totale, source_import, raw_text, upload_id, placed_at)
  values (uid, v_bankroll, case when v_n > 1 then 'combine' else 'simple' end, p_mise, round(v_cote_totale, 3),
          p_source_import, p_raw_text, p_upload_id, coalesce(p_placed_at, now()))
  returning id into v_bet;

  insert into betwise.bet_selections (bet_id, match_id, match_libre, market_code, market_param, selection, cote, origin_source_id, prediction_id)
  select v_bet,
         nullif(s->>'match_id','')::uuid,
         s->>'match_libre',
         s->>'market_code',
         nullif(s->>'market_param','')::numeric,
         s->>'selection',
         (s->>'cote')::numeric,
         (s->>'origin_source_id')::uuid,
         nullif(s->>'prediction_id','')::uuid
  from jsonb_array_elements(p_selections) s;

  insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note)
  values (v_bankroll, 'mise', -p_mise, v_bet, 'Mise');

  return v_bet;
end $$;

create or replace function betwise.settle_bet(p_bet_id uuid, p_result betwise.settle_result)
returns betwise.bets
language plpgsql security definer set search_path = betwise, public as $$
declare
  uid uuid := auth.uid();
  b betwise.bets;
  v_gain numeric;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;
  if b.statut <> 'en_cours' then raise exception 'pari déjà réglé'; end if;
  if p_result not in ('gagne','perdu','rembourse') then raise exception 'résultat invalide'; end if;

  v_gain := case p_result
    when 'gagne' then round(b.mise * b.cote_totale, 2) - b.mise
    when 'perdu' then -b.mise
    else 0 end;

  update betwise.bets set statut = p_result::text::betwise.bet_status, gain_net = v_gain, settled_at = now()
  where id = b.id returning * into b;

  update betwise.bet_selections set resultat = p_result, settled_at = now() where bet_id = b.id;

  if p_result = 'gagne' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note)
    values (b.bankroll_id, 'gain', b.mise + v_gain, b.id, 'Gain');
  elsif p_result = 'rembourse' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note)
    values (b.bankroll_id, 'ajustement', b.mise, b.id, 'Remboursement');
  end if;
  return b;
end $$;

create or replace function betwise.bankroll_move(p_type betwise.tx_type, p_montant numeric, p_note text default null)
returns betwise.bankroll_transactions
language plpgsql security definer set search_path = betwise, public as $$
declare uid uuid := auth.uid(); v_bankroll uuid; t betwise.bankroll_transactions;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  if p_type not in ('depot','retrait') then raise exception 'type invalide'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'montant invalide'; end if;
  select id into v_bankroll from betwise.bankrolls where user_id = uid and active;
  insert into betwise.bankroll_transactions (bankroll_id, type, montant, note)
  values (v_bankroll, p_type, case when p_type = 'retrait' then -p_montant else p_montant end, p_note)
  returning * into t;
  return t;
end $$;

create or replace view betwise.my_bankroll_summary with (security_invoker = true) as
select k.id as bankroll_id,
       k.user_id,
       k.devise,
       k.capital_initial + coalesce(sum(t.montant), 0) as solde,
       coalesce((select sum(b.mise) from betwise.bets b where b.bankroll_id = k.id and b.statut = 'en_cours'), 0) as exposition,
       coalesce((select sum(b.gain_net) from betwise.bets b where b.bankroll_id = k.id and b.statut <> 'en_cours'), 0) as resultat_net,
       (select count(*) from betwise.bets b where b.bankroll_id = k.id and b.statut <> 'en_cours' and b.statut <> 'annule') as nb_regles,
       (select count(*) from betwise.bets b where b.bankroll_id = k.id and b.statut = 'gagne') as nb_gagnes
from betwise.bankrolls k
left join betwise.bankroll_transactions t on t.bankroll_id = k.id
where k.active
group by k.id;

grant select on betwise.my_bankroll_summary to authenticated;
grant execute on function betwise.place_bet(numeric, jsonb, betwise.import_channel, text, uuid, timestamptz) to authenticated;
grant execute on function betwise.settle_bet(uuid, betwise.settle_result) to authenticated;
grant execute on function betwise.bankroll_move(betwise.tx_type, numeric, text) to authenticated;
