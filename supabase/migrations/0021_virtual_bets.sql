-- 0021 : paris de test (virtuel) sans mouvement de bankroll ; un test alimente la fiche des sources d'origine

drop function if exists betwise.place_bet(numeric, jsonb, betwise.import_channel, text, uuid, timestamptz, jsonb);

create or replace function betwise.place_bet(p_mise numeric, p_selections jsonb, p_source_import betwise.import_channel default 'manuel', p_raw_text text default null, p_upload_id uuid default null, p_placed_at timestamptz default null, p_summary jsonb default null, p_virtuel boolean default false)
 returns uuid language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare
  uid uuid := auth.uid();
  v_bankroll uuid; v_bet uuid; v_cote_totale numeric := 1; v_n int; v_item jsonb;
  v_statut betwise.bet_status := 'en_cours'; v_gain numeric; v_bookmaker text; v_coupon text;
  v_nb int; v_type betwise.bet_type; v_fp text; v_dup betwise.bets;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  if p_mise is null or p_mise <= 0 then raise exception 'mise invalide'; end if;
  v_n := jsonb_array_length(coalesce(p_selections, '[]'::jsonb));
  v_bookmaker := nullif(p_summary->>'bookmaker','');
  v_coupon := nullif(p_summary->>'coupon_externe','');

  select id into v_bankroll from betwise.bankrolls where user_id = uid and active;
  if v_bankroll is null then raise exception 'bankroll introuvable, appeler ensure_profile()'; end if;

  if v_coupon is not null and exists (select 1 from betwise.bets b where b.user_id = uid and b.coupon_externe = v_coupon and b.virtuel = p_virtuel) then
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

  if p_source_import in ('capture','texte') then
    v_fp := betwise.ticket_fingerprint(v_bookmaker, p_placed_at, p_mise, v_cote_totale);
    if v_fp is not null and p_virtuel then v_fp := 'test|' || v_fp; end if;
    if v_fp is not null then
      select * into v_dup from betwise.bets b where b.user_id = uid and b.ticket_fingerprint = v_fp;
      if v_dup.id is not null then
        raise exception 'ticket déjà importé le % (%, mise %, cote %)',
          to_char(v_dup.created_at at time zone 'UTC', 'DD/MM à HH24:MI'), v_bookmaker, round(p_mise)::text, round(v_cote_totale, 2)::text;
      end if;
    end if;
  end if;

  v_nb := coalesce(nullif(p_summary->>'nb_selections','')::int, v_n);
  v_type := case when v_nb > 1 then 'combine'::betwise.bet_type else 'simple'::betwise.bet_type end;
  v_gain := case v_statut when 'gagne' then round(p_mise * v_cote_totale, 2) - p_mise when 'perdu' then -p_mise when 'rembourse' then 0 else null end;

  insert into betwise.bets (user_id, bankroll_id, type, mise, cote_totale, statut, gain_net, settled_at, source_import, raw_text, upload_id, placed_at,
                            nb_selections, detail_complet, coupon_externe, bookmaker, ticket_fingerprint, virtuel)
  values (uid, v_bankroll, v_type, p_mise, round(v_cote_totale, 3), v_statut, v_gain, case when v_statut <> 'en_cours' then now() end,
          p_source_import, p_raw_text, p_upload_id, coalesce(p_placed_at, now()), v_nb, v_n > 0, v_coupon, v_bookmaker, v_fp, p_virtuel)
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

    -- Un test nourrit aussi la fiche de chaque source d'origine (justesse des choix), sans doublon
    if p_virtuel then
      insert into betwise.predictions (source_id, match_id, market_code, market_param, selection, cote_annoncee, submitted_by, published_at)
      select (e->>'origin_source_id')::uuid, nullif(e->>'match_id','')::uuid, e->>'market_code', nullif(e->>'market_param','')::numeric, e->>'selection',
             (e->>'cote')::numeric, uid, coalesce(p_placed_at, now())
      from jsonb_array_elements(p_selections) e
      join betwise.sources src on src.id = (e->>'origin_source_id')::uuid
        and src.created_by is not null  -- jamais dans les sources système (modèle, coups du jour)
      where nullif(e->>'match_id','') is not null and nullif(e->>'prediction_id','') is null
      on conflict do nothing;
    end if;
  end if;

  if not p_virtuel then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (v_bankroll, 'mise', -p_mise, v_bet, 'Mise');
    if v_statut = 'gagne' then
      insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (v_bankroll, 'gain', p_mise + v_gain, v_bet, 'Gain (ticket importé)');
    elsif v_statut = 'rembourse' then
      insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (v_bankroll, 'ajustement', p_mise, v_bet, 'Remboursement (ticket importé)');
    end if;
  end if;
  return v_bet;
end $function$;
grant execute on function betwise.place_bet(numeric, jsonb, betwise.import_channel, text, uuid, timestamptz, jsonb, boolean) to authenticated;

create or replace function betwise.finalize_bet(p_bet_id uuid) returns void language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare b betwise.bets; n_pending int; n_lost int; v_cote numeric; v_gain numeric; v_result betwise.bet_status;
begin
  select * into b from betwise.bets where id = p_bet_id for update;
  if b.statut <> 'en_cours' then return; end if;
  select count(*) filter (where resultat = 'en_attente'), count(*) filter (where resultat = 'perdu'), coalesce(exp(sum(ln(cote)) filter (where resultat = 'gagne')), 1)
    into n_pending, n_lost, v_cote from betwise.bet_selections where bet_id = b.id;
  if n_lost > 0 then v_result := 'perdu'; v_gain := -b.mise;
  elsif n_pending > 0 then return;
  else
    if v_cote = 1 then v_result := 'rembourse'; v_gain := 0;
    else v_result := 'gagne'; v_gain := round(b.mise * v_cote, 2) - b.mise; end if;
  end if;
  update betwise.bets set statut = v_result, gain_net = v_gain, settled_at = now(), cote_totale = case when v_result='gagne' then round(v_cote,3) else cote_totale end where id = b.id;
  if b.virtuel then return; end if;
  if v_result = 'gagne' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'gain', b.mise + v_gain, b.id, 'Gain (auto)');
  elsif v_result = 'rembourse' then
    insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'ajustement', b.mise, b.id, 'Remboursement (auto)');
  end if;
end $function$;

create or replace function betwise.settle_bet(p_bet_id uuid, p_result betwise.settle_result) returns betwise.bets language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare uid uuid := auth.uid(); b betwise.bets; v_gain numeric;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;
  if b.statut <> 'en_cours' then raise exception 'pari déjà réglé'; end if;
  if p_result not in ('gagne','perdu','rembourse') then raise exception 'résultat invalide'; end if;
  v_gain := case p_result when 'gagne' then round(b.mise * b.cote_totale, 2) - b.mise when 'perdu' then -b.mise else 0 end;
  update betwise.bets set statut = p_result::text::betwise.bet_status, gain_net = v_gain, settled_at = now() where id = b.id returning * into b;
  update betwise.bet_selections set resultat = p_result, settled_at = now() where bet_id = b.id;
  if not b.virtuel then
    if p_result = 'gagne' then
      insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'gain', b.mise + v_gain, b.id, 'Gain');
    elsif p_result = 'rembourse' then
      insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'ajustement', b.mise, b.id, 'Remboursement');
    end if;
  end if;
  return b;
end $function$;

create or replace view betwise.my_bankroll_summary with (security_invoker = true) as
select k.id as bankroll_id, k.user_id, k.devise,
       k.capital_initial + coalesce(sum(t.montant), 0) as solde,
       coalesce((select sum(b.mise) from betwise.bets b where b.bankroll_id = k.id and b.statut = 'en_cours' and not b.virtuel), 0) as exposition,
       coalesce((select sum(b.gain_net) from betwise.bets b where b.bankroll_id = k.id and b.statut <> 'en_cours' and not b.virtuel), 0) as resultat_net,
       (select count(*) from betwise.bets b where b.bankroll_id = k.id and b.statut <> 'en_cours' and b.statut <> 'annule' and not b.virtuel) as nb_regles,
       (select count(*) from betwise.bets b where b.bankroll_id = k.id and b.statut = 'gagne' and not b.virtuel) as nb_gagnes
from betwise.bankrolls k
left join betwise.bankroll_transactions t on t.bankroll_id = k.id
where k.active
group by k.id;
