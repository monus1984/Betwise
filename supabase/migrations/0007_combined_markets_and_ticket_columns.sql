-- 0007 : marchés combinés (double chance & buts, résultat & buts), tickets résumés et coupons externes.
-- Copie exacte de la migration appliquée le 2026-11-10.

insert into betwise.markets (code, libelle_fr, a_parametre) values
  ('DC_OU', 'Double chance & nombre de buts', true),
  ('1X2_OU', 'Résultat & nombre de buts', true)
on conflict (code) do nothing;

-- Sélection d'un marché combiné : "<dc>|<Plus|Moins>" ex. "N2|Plus", "1|Moins". Les deux conditions doivent être vraies.
create or replace function betwise.settle_selection(
  p_market text, p_param numeric, p_selection text, p_home int, p_away int
) returns betwise.settle_result
language plpgsql immutable set search_path = betwise, public as $$
declare
  total int := p_home + p_away;
  diff int := p_home - p_away;
  sel text := upper(trim(p_selection));
  adj numeric;
  part1 text; part2 text; r1 betwise.settle_result; r2 betwise.settle_result;
begin
  if p_home is null or p_away is null then return 'en_attente'; end if;

  if p_market in ('DC_OU', '1X2_OU') then
    if position('|' in sel) = 0 then return 'en_attente'; end if;
    part1 := split_part(sel, '|', 1); part2 := split_part(sel, '|', 2);
    r1 := betwise.settle_selection(case when p_market = 'DC_OU' then 'DC' else '1X2' end, null, part1, p_home, p_away);
    r2 := betwise.settle_selection('OU', p_param, part2, p_home, p_away);
    if r1 = 'perdu' or r2 = 'perdu' then return 'perdu'; end if;
    if r1 = 'en_attente' or r2 = 'en_attente' then return 'en_attente'; end if;
    if r2 = 'rembourse' then return r1; end if;   -- ligne entière touchée : seule la 1re condition compte
    return 'gagne';
  end if;

  if p_market = '1X2' then
    if sel = '1' then return case when diff > 0 then 'gagne' else 'perdu' end; end if;
    if sel in ('N','X') then return case when diff = 0 then 'gagne' else 'perdu' end; end if;
    if sel = '2' then return case when diff < 0 then 'gagne' else 'perdu' end; end if;
  elsif p_market = 'DC' then
    if sel in ('1N','1X') then return case when diff >= 0 then 'gagne' else 'perdu' end; end if;
    if sel = '12' then return case when diff <> 0 then 'gagne' else 'perdu' end; end if;
    if sel in ('N2','X2') then return case when diff <= 0 then 'gagne' else 'perdu' end; end if;
  elsif p_market = 'DNB' then
    if diff = 0 then return 'rembourse'; end if;
    if sel = '1' then return case when diff > 0 then 'gagne' else 'perdu' end; end if;
    if sel = '2' then return case when diff < 0 then 'gagne' else 'perdu' end; end if;
  elsif p_market = 'OU' then
    if p_param is null then return 'en_attente'; end if;
    if total = p_param then return 'rembourse'; end if;
    if sel in ('PLUS','OVER','+') then return case when total > p_param then 'gagne' else 'perdu' end; end if;
    if sel in ('MOINS','UNDER','-') then return case when total < p_param then 'gagne' else 'perdu' end; end if;
  elsif p_market = 'BTTS' then
    if sel in ('OUI','YES') then return case when p_home >= 1 and p_away >= 1 then 'gagne' else 'perdu' end; end if;
    if sel in ('NON','NO') then return case when p_home = 0 or p_away = 0 then 'gagne' else 'perdu' end; end if;
  elsif p_market = 'AH' then
    if p_param is null then return 'en_attente'; end if;
    adj := case when sel = '1' then diff + p_param when sel = '2' then -diff + p_param else null end;
    if adj is null then return 'en_attente'; end if;
    if adj > 0 then return 'gagne'; end if;
    if adj < 0 then return 'perdu'; end if;
    return 'rembourse';
  elsif p_market = 'CS' then
    return case when regexp_replace(sel, '\s', '', 'g') = p_home || '-' || p_away then 'gagne' else 'perdu' end;
  end if;
  return 'en_attente';
end $$;

-- Tickets résumés (capture repliée) et coupons externes (lien 1xBet)
alter table betwise.bets
  add column if not exists nb_selections smallint,
  add column if not exists detail_complet boolean not null default true,
  add column if not exists coupon_externe text,
  add column if not exists bookmaker text;
create index if not exists bets_coupon_idx on betwise.bets (user_id, coupon_externe) where coupon_externe is not null;

-- place_bet : accepte un ticket sans sélections (résumé) avec statut connu, et les métadonnées de ticket
create or replace function betwise.place_bet(
  p_mise numeric,
  p_selections jsonb,
  p_source_import betwise.import_channel default 'manuel',
  p_raw_text text default null,
  p_upload_id uuid default null,
  p_placed_at timestamptz default null,
  p_summary jsonb default null   -- {cote_totale, nb_selections, statut (en_cours|gagne|perdu|rembourse), bookmaker, coupon_externe, origin_source_id}
) returns uuid
language plpgsql security definer set search_path = betwise, public as $$
declare
  uid uuid := auth.uid();
  v_bankroll uuid; v_bet uuid; v_cote_totale numeric := 1; v_n int; s jsonb;
  v_statut betwise.bet_status := 'en_cours'; v_gain numeric; v_bookmaker text; v_coupon text;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  if p_mise is null or p_mise <= 0 then raise exception 'mise invalide'; end if;
  v_n := jsonb_array_length(coalesce(p_selections, '[]'::jsonb));
  v_bookmaker := nullif(p_summary->>'bookmaker','');
  v_coupon := nullif(p_summary->>'coupon_externe','');

  select id into v_bankroll from betwise.bankrolls where user_id = uid and active;
  if v_bankroll is null then raise exception 'bankroll introuvable, appeler ensure_profile()'; end if;

  if v_coupon is not null and exists (select 1 from betwise.bets b where b.user_id = uid and b.coupon_externe = v_coupon) then
    raise exception 'coupon déjà importé';
  end if;

  if v_n = 0 then
    -- Ticket résumé : cote totale, nombre de sélections et statut fournis
    if p_summary is null or (p_summary->>'cote_totale') is null then raise exception 'aucune sélection'; end if;
    v_cote_totale := (p_summary->>'cote_totale')::numeric;
    if (p_summary->>'statut') in ('gagne','perdu','rembourse') then v_statut := (p_summary->>'statut')::betwise.bet_status; end if;
  else
    for s in select * from jsonb_array_elements(p_selections) loop
      if (s->>'origin_source_id') is null then raise exception 'origine manquante sur une sélection'; end if;
      if not exists (select 1 from betwise.sources src where src.id = (s->>'origin_source_id')::uuid
          and (src.visibilite = 'partagee' or src.created_by = uid or src.type = 'modele_betwise')) then raise exception 'origine inconnue'; end if;
      if (s->>'cote')::numeric <= 1 then raise exception 'cote invalide'; end if;
      v_cote_totale := v_cote_totale * (s->>'cote')::numeric;
    end loop;
    if (p_summary->>'statut') in ('gagne','perdu','rembourse') then v_statut := (p_summary->>'statut')::betwise.bet_status; end if;
  end if;

  v_gain := case v_statut when 'gagne' then round(p_mise * v_cote_totale, 2) - p_mise when 'perdu' then -p_mise when 'rembourse' then 0 else null end;

  insert into betwise.bets (user_id, bankroll_id, type, mise, cote_totale, statut, gain_net, settled_at, source_import, raw_text, upload_id, placed_at,
                            nb_selections, detail_complet, coupon_externe, bookmaker)
  values (uid, v_bankroll,
          case when coalesce(nullif(p_summary->>'nb_selections','')::int, v_n) > 1 then 'combine' else 'simple' end,
          p_mise, round(v_cote_totale, 3), v_statut, v_gain, case when v_statut <> 'en_cours' then now() end,
          p_source_import, p_raw_text, p_upload_id, coalesce(p_placed_at, now()),
          coalesce(nullif(p_summary->>'nb_selections','')::int, v_n), v_n > 0, v_coupon, v_bookmaker)
  returning id into v_bet;

  if v_n > 0 then
    insert into betwise.bet_selections (bet_id, match_id, match_libre, market_code, market_param, selection, cote, origin_source_id, prediction_id, resultat, settled_at)
    select v_bet, nullif(s->>'match_id','')::uuid, s->>'match_libre', s->>'market_code', nullif(s->>'market_param','')::numeric,
           s->>'selection', (s->>'cote')::numeric, (s->>'origin_source_id')::uuid, nullif(s->>'prediction_id','')::uuid,
           case when (s->>'resultat') in ('gagne','perdu','rembourse') then (s->>'resultat')::betwise.settle_result else 'en_attente' end,
           case when (s->>'resultat') in ('gagne','perdu','rembourse') then now() end
    from jsonb_array_elements(p_selections) s;

    insert into betwise.odds_observations (match_id, market_code, market_param, selection, cote, bookmaker, origine, observed_by, observed_at)
    select nullif(s->>'match_id','')::uuid, s->>'market_code', nullif(s->>'market_param','')::numeric, s->>'selection', (s->>'cote')::numeric,
           v_bookmaker, 'ticket', uid, coalesce(p_placed_at, now())
    from jsonb_array_elements(p_selections) s where nullif(s->>'match_id','') is not null;
  end if;

  insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (v_bankroll, 'mise', -p_mise, v_bet, 'Mise');
  if v_statut = 'gagne' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (v_bankroll, 'gain', p_mise + v_gain, v_bet, 'Gain (ticket importé)');
  elsif v_statut = 'rembourse' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (v_bankroll, 'ajustement', p_mise, v_bet, 'Remboursement (ticket importé)');
  end if;
  return v_bet;
end $$;

grant execute on function betwise.place_bet(numeric, jsonb, betwise.import_channel, text, uuid, timestamptz, jsonb) to authenticated;
