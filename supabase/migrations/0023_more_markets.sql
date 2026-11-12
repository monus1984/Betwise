-- 0023 : palette de marchés élargie — mi-temps (résultat, double chance, buts, les deux marquent), 2e mi-temps,
-- mi-temps / fin de match, mi-temps la plus prolifique, pair / impair, tranches de buts, handicap européen, gagne sans encaisser.
-- Les marchés de mi-temps demandent le score à la pause : colonnes ht_home / ht_away sur matches.

alter table betwise.matches add column if not exists ht_home smallint, add column if not exists ht_away smallint;

insert into betwise.markets (code, libelle_fr, a_parametre) values
  ('HT_1X2', 'Mi-temps : résultat', false), ('HT_DC', 'Mi-temps : double chance', false), ('HT_OU', 'Mi-temps : nombre de buts', true), ('HT_BTTS', 'Mi-temps : les deux marquent', false),
  ('H2_1X2', '2e mi-temps : résultat', false), ('H2_OU', '2e mi-temps : nombre de buts', true),
  ('HTFT', 'Mi-temps / fin de match', false), ('HMG', 'Mi-temps avec le plus de buts', false),
  ('OE', 'Nombre de buts pair / impair', false), ('MG', 'Tranche de buts (multi-buts)', false),
  ('EH', 'Handicap européen (3 issues)', true), ('WTN', 'Gagne sans encaisser', false)
on conflict (code) do nothing;

drop function betwise.settle_selection(text, numeric, text, integer, integer);

create function betwise.settle_selection(p_market text, p_param numeric, p_selection text, p_home integer, p_away integer, p_ht_home integer default null, p_ht_away integer default null)
 returns betwise.settle_result language plpgsql immutable set search_path to 'betwise', 'public' as $function$
declare
  total int := p_home + p_away; diff int := p_home - p_away; sel text := upper(trim(p_selection)); adj numeric;
  part1 text; part2 text; r1 betwise.settle_result; r2 betwise.settle_result; lo int; hi int;
begin
  if p_home is null or p_away is null then return 'en_attente'; end if;

  -- Marchés de mi-temps : même règle que le marché de base, appliquée au score de la mi-temps (HT_) ou de la 2e mi-temps (H2_)
  if left(p_market, 3) in ('HT_', 'H2_') then
    if p_ht_home is null or p_ht_away is null then return 'en_attente'; end if;
    if left(p_market, 3) = 'HT_' then return betwise.settle_selection(substr(p_market, 4), p_param, p_selection, p_ht_home, p_ht_away); end if;
    return betwise.settle_selection(substr(p_market, 4), p_param, p_selection, p_home - p_ht_home, p_away - p_ht_away);
  end if;
  if p_market = 'HTFT' then  -- « 1/2 » : résultat à la mi-temps / résultat final
    if p_ht_home is null or p_ht_away is null or position('/' in sel) = 0 then return 'en_attente'; end if;
    r1 := betwise.settle_selection('1X2', null, split_part(sel, '/', 1), p_ht_home, p_ht_away);
    r2 := betwise.settle_selection('1X2', null, split_part(sel, '/', 2), p_home, p_away);
    if r1 = 'en_attente' or r2 = 'en_attente' then return 'en_attente'; end if;
    return case when r1 = 'gagne' and r2 = 'gagne' then 'gagne' else 'perdu' end;
  end if;
  if p_market = 'HMG' then  -- mi-temps avec le plus de buts : 1 = première, N = autant, 2 = seconde
    if p_ht_home is null or p_ht_away is null then return 'en_attente'; end if;
    adj := (p_ht_home + p_ht_away) - (total - p_ht_home - p_ht_away);
    if sel = '1' then return case when adj > 0 then 'gagne' else 'perdu' end; end if;
    if sel in ('N','X') then return case when adj = 0 then 'gagne' else 'perdu' end; end if;
    if sel = '2' then return case when adj < 0 then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;
  if p_market = 'OE' then
    if sel in ('PAIR','EVEN') then return case when total % 2 = 0 then 'gagne' else 'perdu' end; end if;
    if sel in ('IMPAIR','ODD') then return case when total % 2 = 1 then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;
  if p_market = 'MG' then  -- « 2-4 » : entre 2 et 4 buts dans le match
    if sel !~ '^\d+-\d+$' then return 'en_attente'; end if;
    lo := split_part(sel, '-', 1)::int; hi := split_part(sel, '-', 2)::int;
    return case when total between lo and hi then 'gagne' else 'perdu' end;
  end if;
  if p_market = 'EH' then  -- handicap européen (3 issues) : le handicap s'applique à l'équipe à domicile
    if p_param is null then return 'en_attente'; end if;
    adj := diff + p_param;
    if sel = '1' then return case when adj > 0 then 'gagne' else 'perdu' end; end if;
    if sel in ('N','X') then return case when adj = 0 then 'gagne' else 'perdu' end; end if;
    if sel = '2' then return case when adj < 0 then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;
  if p_market = 'WTN' then  -- gagne sans encaisser
    if sel = '1' then return case when diff > 0 and p_away = 0 then 'gagne' else 'perdu' end; end if;
    if sel = '2' then return case when diff < 0 and p_home = 0 then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;

  if p_market in ('DC_OU', '1X2_OU', 'DC_BTTS', '1X2_BTTS', 'OU_BTTS') then
    if position('|' in sel) = 0 then return 'en_attente'; end if;
    part1 := split_part(sel, '|', 1); part2 := split_part(sel, '|', 2);
    r1 := case p_market when 'DC_OU' then betwise.settle_selection('DC', null, part1, p_home, p_away)
                        when 'DC_BTTS' then betwise.settle_selection('DC', null, part1, p_home, p_away)
                        when 'OU_BTTS' then betwise.settle_selection('OU', p_param, part1, p_home, p_away)
                        else betwise.settle_selection('1X2', null, part1, p_home, p_away) end;
    r2 := case when p_market in ('DC_OU', '1X2_OU') then betwise.settle_selection('OU', p_param, part2, p_home, p_away)
               else betwise.settle_selection('BTTS', null, part2, p_home, p_away) end;
    if r1 = 'perdu' or r2 = 'perdu' then return 'perdu'; end if;
    if r1 = 'en_attente' or r2 = 'en_attente' then return 'en_attente'; end if;
    if r1 = 'rembourse' then return r2; end if;
    if r2 = 'rembourse' then return r1; end if;
    return 'gagne';
  end if;

  if p_market in ('TT1', 'TT2') then
    if p_param is null then return 'en_attente'; end if;
    adj := case when p_market = 'TT1' then p_home else p_away end;
    if adj = p_param then return 'rembourse'; end if;
    if sel in ('PLUS','OVER','+') then return case when adj > p_param then 'gagne' else 'perdu' end; end if;
    if sel in ('MOINS','UNDER','-') then return case when adj < p_param then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
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
end $function$;

create or replace function betwise.settle_by_match(p_match_id uuid)
 returns table(selections_reglees integer, pronos_regles integer, paris_finalises integer) language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare
  m betwise.matches; r record; n_sel int := 0; n_pred int := 0; n_bets int := 0;
begin
  select * into m from betwise.matches where id = p_match_id;
  if m.id is null or m.statut <> 'termine' or m.score_home is null or m.score_away is null then
    return query select 0, 0, 0; return;
  end if;

  for r in
    update betwise.bet_selections s
       set resultat = betwise.settle_selection(s.market_code, s.market_param, s.selection, m.score_home, m.score_away, m.ht_home, m.ht_away),
           settled_at = now()
     where s.match_id = m.id and s.resultat = 'en_attente'
       and betwise.settle_selection(s.market_code, s.market_param, s.selection, m.score_home, m.score_away, m.ht_home, m.ht_away) <> 'en_attente'
     returning s.bet_id
  loop
    n_sel := n_sel + 1;
    perform betwise.finalize_bet(r.bet_id);
  end loop;

  select count(*) into n_bets from betwise.bets b where b.settled_at >= now() - interval '2 seconds' and exists (select 1 from betwise.bet_selections s where s.bet_id = b.id and s.match_id = m.id);

  update betwise.predictions p
     set resultat = betwise.settle_selection(p.market_code, p.market_param, p.selection, m.score_home, m.score_away, m.ht_home, m.ht_away),
         settled_at = now()
   where p.match_id = m.id and p.resultat = 'en_attente' and p.statut <> 'annule'
     and betwise.settle_selection(p.market_code, p.market_param, p.selection, m.score_home, m.score_away, m.ht_home, m.ht_away) <> 'en_attente';
  get diagnostics n_pred = row_count;

  return query select n_sel, n_pred, n_bets;
end $function$;
