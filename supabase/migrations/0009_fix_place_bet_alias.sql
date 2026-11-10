-- 0009 : version finale de place_bet() après 0007 (cast bet_type explicite, alias JSON distincts de la variable de boucle).
-- 0008 (cast) contenait encore un conflit d'alias ; 0009 est la version en service. Copie exacte de la migration appliquée le 2026-11-10.
create or replace function betwise.place_bet(
  p_mise numeric,
  p_selections jsonb,
  p_source_import betwise.import_channel default 'manuel',
  p_raw_text text default null,
  p_upload_id uuid default null,
  p_placed_at timestamptz default null,
  p_summary jsonb default null
) returns uuid
language plpgsql security definer set search_path = betwise, public as $$
declare
  uid uuid := auth.uid();
  v_bankroll uuid; v_bet uuid; v_cote_totale numeric := 1; v_n int; v_item jsonb;
  v_statut betwise.bet_status := 'en_cours'; v_gain numeric; v_bookmaker text; v_coupon text;
  v_nb int; v_type betwise.bet_type;
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
    if p_summary is null or (p_summary->>'cote_totale') is null then raise exception 'aucune sélection'; end if;
    v_cote_totale := (p_summary->>'cote_totale')::numeric;
  else
    for v_item in select * from jsonb_array_elements(p_selections) loop
      if (v_item->>'origin_source_id') is null then raise exception 'origine manquante sur une sélection'; end if;
      if not exists (select 1 from betwise.sources src where src.id = (v_item->>'origin_source_id')::uuid
          and (src.visibilite = 'partagee' or src.created_by = uid or src.type = 'modele_betwise')) then raise exception 'origine inconnue'; end if;
      if (v_item->>'cote')::numeric <= 1 then raise exception 'cote invalide'; end if;
      v_cote_totale := v_cote_totale * (v_item->>'cote')::numeric;
    end loop;
  end if;
  if (p_summary->>'statut') in ('gagne','perdu','rembourse') then v_statut := (p_summary->>'statut')::betwise.bet_status; end if;

  v_nb := coalesce(nullif(p_summary->>'nb_selections','')::int, v_n);
  v_type := case when v_nb > 1 then 'combine'::betwise.bet_type else 'simple'::betwise.bet_type end;
  v_gain := case v_statut when 'gagne' then round(p_mise * v_cote_totale, 2) - p_mise when 'perdu' then -p_mise when 'rembourse' then 0 else null end;

  insert into betwise.bets (user_id, bankroll_id, type, mise, cote_totale, statut, gain_net, settled_at, source_import, raw_text, upload_id, placed_at,
                            nb_selections, detail_complet, coupon_externe, bookmaker)
  values (uid, v_bankroll, v_type, p_mise, round(v_cote_totale, 3), v_statut, v_gain, case when v_statut <> 'en_cours' then now() end,
          p_source_import, p_raw_text, p_upload_id, coalesce(p_placed_at, now()), v_nb, v_n > 0, v_coupon, v_bookmaker)
  returning id into v_bet;

  if v_n > 0 then
    insert into betwise.bet_selections (bet_id, match_id, match_libre, market_code, market_param, selection, cote, origin_source_id, prediction_id, resultat, settled_at)
    select v_bet, nullif(e->>'match_id','')::uuid, e->>'match_libre', e->>'market_code', nullif(e->>'market_param','')::numeric,
           e->>'selection', (e->>'cote')::numeric, (e->>'origin_source_id')::uuid, nullif(e->>'prediction_id','')::uuid,
           case when (e->>'resultat') in ('gagne','perdu','rembourse') then (e->>'resultat')::betwise.settle_result else 'en_attente'::betwise.settle_result end,
           case when (e->>'resultat') in ('gagne','perdu','rembourse') then now() end
    from jsonb_array_elements(p_selections) e;

    insert into betwise.odds_observations (match_id, market_code, market_param, selection, cote, bookmaker, origine, observed_by, observed_at)
    select nullif(e->>'match_id','')::uuid, e->>'market_code', nullif(e->>'market_param','')::numeric, e->>'selection', (e->>'cote')::numeric,
           v_bookmaker, 'ticket', uid, coalesce(p_placed_at, now())
    from jsonb_array_elements(p_selections) e where nullif(e->>'match_id','') is not null;
  end if;

  insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (v_bankroll, 'mise', -p_mise, v_bet, 'Mise');
  if v_statut = 'gagne' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (v_bankroll, 'gain', p_mise + v_gain, v_bet, 'Gain (ticket importé)');
  elsif v_statut = 'rembourse' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (v_bankroll, 'ajustement', p_mise, v_bet, 'Remboursement (ticket importé)');
  end if;
  return v_bet;
end $$;
