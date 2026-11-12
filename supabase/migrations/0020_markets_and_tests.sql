-- 0020 : marchés exhaustifs (buts par équipe, combos même match avec « les deux marquent ») et paris de test (virtuels)

insert into betwise.markets (code, libelle_fr, a_parametre) values
  ('TT1', 'Buts de l''équipe à domicile', true),
  ('TT2', 'Buts de l''équipe à l''extérieur', true),
  ('DC_BTTS', 'Double chance & les deux marquent', false),
  ('1X2_BTTS', 'Résultat & les deux marquent', false),
  ('OU_BTTS', 'Nombre de buts & les deux marquent', true)
on conflict (code) do nothing;

-- Règlement : combos « A|B » (DC_OU, 1X2_OU, DC_BTTS, 1X2_BTTS, OU_BTTS), buts par équipe TT1/TT2 (remboursé si égalité à la ligne)
create or replace function betwise.settle_selection(p_market text, p_param numeric, p_selection text, p_home integer, p_away integer)
 returns betwise.settle_result language plpgsql immutable set search_path to 'betwise', 'public' as $function$
declare
  total int := p_home + p_away; diff int := p_home - p_away; sel text := upper(trim(p_selection)); adj numeric;
  part1 text; part2 text; r1 betwise.settle_result; r2 betwise.settle_result;
begin
  if p_home is null or p_away is null then return 'en_attente'; end if;

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

-- Paris de test : enregistrés et réglés comme les autres, sans aucun mouvement de bankroll
alter table betwise.bets add column if not exists virtuel boolean not null default false;
create index if not exists bets_user_virtuel_idx on betwise.bets (user_id, virtuel, placed_at desc);
