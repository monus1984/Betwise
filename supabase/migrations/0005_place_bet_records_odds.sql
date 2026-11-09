-- 0005 : place_bet() journalise la cote de chaque sélection rapprochée d'un match
-- comme observation utilisateur (origine 'ticket'), horodatée.
-- Copie exacte de la migration appliquée le 2026-11-09. Corps identique à 0004 + le bloc odds_observations.
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

  insert into betwise.odds_observations (match_id, market_code, market_param, selection, cote, bookmaker, origine, observed_by)
  select nullif(s->>'match_id','')::uuid,
         s->>'market_code',
         nullif(s->>'market_param','')::numeric,
         s->>'selection',
         (s->>'cote')::numeric,
         nullif(s->>'bookmaker',''),
         'ticket',
         uid
  from jsonb_array_elements(p_selections) s
  where nullif(s->>'match_id','') is not null;

  insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note)
  values (v_bankroll, 'mise', -p_mise, v_bet, 'Mise');

  return v_bet;
end $$;
