-- 0049 — Marchés étendus : 37 marchés de plus, pour reconnaître et régler seuls davantage de paris.
--   Sur le score        : handicap, remboursé si nul, pair / impair et score exact par mi-temps ; buts d'une équipe (pair / impair,
--                         nombre exact ou tranche) ; gagne les deux mi-temps ; marque dans les deux mi-temps.
--   Sur la feuille de match : première et dernière équipe à marquer, but avant une minute donnée, but contre son camp, penalty manqué,
--                         dernier buteur, joueur à 2 ou 3 buts, joueur averti, équipe la plus avertie, carton rouge d'une équipe,
--                         tirs d'une équipe, corners (handicap, pair / impair, double chance), fautes et hors-jeu.
--   COMBO               : combiné libre sur un même match (« MyCombi », « bet builder ») ; la sélection porte les conditions,
--                         « DC:1N & OU@2.5:Plus & CORN@8.5:Plus ». Gagné si tout est gagné, perdu dès qu'une condition est perdue ;
--                         une condition remboursée parmi des gagnées laisse le pari « en attente » (la cote est à recalculer : réglage à la main).
-- Les marchés préfixés HT_ / H2_ sont réglés par renvoi sur le marché de base : aucun code pour HT_AH, H2_OE, H2_CS…
-- Définitions complètes des fonctions : en base. Test rejouable : supabase/tests/marches_etendus.sql.

insert into betwise.markets (code, libelle_fr, a_parametre) values
  ('HT_AH',   'Mi-temps : handicap', true),
  ('H2_AH',   '2e mi-temps : handicap', true),
  ('HT_DNB',  'Mi-temps : remboursé si nul', false),
  ('H2_DNB',  '2e mi-temps : remboursé si nul', false),
  ('HT_OE',   'Mi-temps : nombre de buts pair / impair', false),
  ('H2_OE',   '2e mi-temps : nombre de buts pair / impair', false),
  ('H2_CS',   '2e mi-temps : score exact', false),
  ('OE1',     'Buts de l''équipe à domicile : pair / impair', false),
  ('OE2',     'Buts de l''équipe à l''extérieur : pair / impair', false),
  ('MG1',     'Nombre de buts de l''équipe à domicile (exact ou tranche)', false),
  ('MG2',     'Nombre de buts de l''équipe à l''extérieur (exact ou tranche)', false),
  ('WBH',     'Gagne les deux mi-temps', false),
  ('SBH',     'Marque dans les deux mi-temps', false),
  ('FTS',     'Première équipe à marquer', false),
  ('LTS',     'Dernière équipe à marquer', false),
  ('GB',      'But avant une minute donnée', true),
  ('OG',      'But contre son camp dans le match', false),
  ('PKM',     'Penalty manqué dans le match', false),
  ('BUTL',    'Dernier buteur', false),
  ('BUT2',    'Joueur : 2 buts ou plus', false),
  ('BUT3',    'Joueur : 3 buts ou plus', false),
  ('PCARD',   'Joueur averti (carton)', false),
  ('CARD_1X2','Équipe avec le plus de cartons', false),
  ('RED1',    'Carton rouge pour l''équipe à domicile', false),
  ('RED2',    'Carton rouge pour l''équipe à l''extérieur', false),
  ('SHOT1',   'Tirs de l''équipe à domicile', true),
  ('SHOT2',   'Tirs de l''équipe à l''extérieur', true),
  ('CORN_AH', 'Corners : handicap', true),
  ('CORN_OE', 'Corners : nombre pair / impair', false),
  ('CORN_DC', 'Corners : double chance', false),
  ('FOUL',    'Fautes : total du match', true),
  ('FOUL1',   'Fautes de l''équipe à domicile', true),
  ('FOUL2',   'Fautes de l''équipe à l''extérieur', true),
  ('OFF',     'Hors-jeu : total du match', true),
  ('OFF1',    'Hors-jeu de l''équipe à domicile', true),
  ('OFF2',    'Hors-jeu de l''équipe à l''extérieur', true),
  ('COMBO',   'Combiné du match (plusieurs conditions)', false)
on conflict (code) do nothing;

do $do$
declare def text; anc text;
begin
  -- settle_selection() : quatre branches ajoutées avant « OE »
  def := pg_get_functiondef('betwise.settle_selection(text,numeric,text,integer,integer,integer,integer)'::regprocedure);
  anc := $n$  if p_market = 'OE' then$n$;
  if position('WBH' in def) = 0 then
    if position(anc in def) = 0 then raise exception 'settle_selection : repère introuvable'; end if;
    def := replace(def, anc, $n$  if p_market = 'WBH' then
    if p_ht_home is null or p_ht_away is null then return 'en_attente'; end if;
    if sel = '1' then return case when p_ht_home > p_ht_away and (p_home - p_ht_home) > (p_away - p_ht_away) then 'gagne' else 'perdu' end; end if;
    if sel = '2' then return case when p_ht_away > p_ht_home and (p_away - p_ht_away) > (p_home - p_ht_home) then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;
  if p_market = 'SBH' then
    if p_ht_home is null or p_ht_away is null then return 'en_attente'; end if;
    if sel = '1' then return case when p_ht_home >= 1 and (p_home - p_ht_home) >= 1 then 'gagne' else 'perdu' end; end if;
    if sel = '2' then return case when p_ht_away >= 1 and (p_away - p_ht_away) >= 1 then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;
  if p_market in ('OE1', 'OE2') then
    lo := case when p_market = 'OE1' then p_home else p_away end;
    if sel in ('PAIR','EVEN') then return case when lo % 2 = 0 then 'gagne' else 'perdu' end; end if;
    if sel in ('IMPAIR','ODD') then return case when lo % 2 = 1 then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;
  if p_market in ('MG1', 'MG2') then
    if sel !~ '^\d+-\d+$' then return 'en_attente'; end if;
    lo := split_part(sel, '-', 1)::int; hi := split_part(sel, '-', 2)::int;
    return case when (case when p_market = 'MG1' then p_home else p_away end) between lo and hi then 'gagne' else 'perdu' end;
  end if;
$n$ || anc);
    execute def;
  end if;

  -- settle_sel() : variables de plus, puis les marchés réglés sur la feuille de match, avant « ET / PEN / QUALIF »
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'betwise' and p.proname = 'settle_sel';
  anc := $n$  if p_market in ('ET', 'PEN', 'QUALIF') then$n$;
  if position('COMBO' in def) = 0 then
    if position(anc in def) = 0 or position('v numeric; first_n text;' in def) = 0 then raise exception 'settle_sel : repère introuvable'; end if;
    def := replace(def, 'v numeric; first_n text;', 'v numeric; first_n text; c1 int; c2 int; c3 int; c4 int; leg text; lm text; lp numeric; ls text; r betwise.settle_result; n_att int := 0; n_gg int := 0; n_rr int := 0;');
    def := replace(def, anc, $n$  -- Statistiques par équipe (0049) : corners (handicap, pair / impair, double chance), cartons, tirs, fautes, hors-jeu
  if p_market in ('CORN_AH','CORN_OE','CORN_DC','CARD_1X2','RED1','RED2','SHOT1','SHOT2','FOUL','FOUL1','FOUL2','OFF','OFF1','OFF2') then
    if p_market in ('CARD_1X2','RED1','RED2') then
      if d is null or d->'jaunes' is null or d->'rouges' is null or jsonb_typeof(d->'jaunes') <> 'array' or jsonb_typeof(d->'rouges') <> 'array' then return 'en_attente'; end if;
      if p_market in ('RED1','RED2') then
        v := (d->'rouges'->>(case when p_market = 'RED1' then 0 else 1 end))::int;
        if v is null then return 'en_attente'; end if;
        if sel in ('OUI','YES') then return case when v > 0 then 'gagne' else 'perdu' end; end if;
        if sel in ('NON','NO') then return case when v = 0 then 'gagne' else 'perdu' end; end if;
        return 'en_attente';
      end if;
      h := (d->'jaunes'->>0)::int + (d->'rouges'->>0)::int; a := (d->'jaunes'->>1)::int + (d->'rouges'->>1)::int;
    else
      k := case when p_market like 'CORN%' then 'corners' when p_market like 'SHOT%' then 'tirs' when p_market like 'FOUL%' then 'fautes' else 'hors_jeu' end;
      if d is null or d->k is null or jsonb_typeof(d->k) <> 'array' or d->k->>0 is null or d->k->>1 is null then return 'en_attente'; end if;
      h := (d->k->>0)::int; a := (d->k->>1)::int;
    end if;
    if h is null or a is null then return 'en_attente'; end if;
    if p_market = 'CARD_1X2' then
      if sel = '1' then return case when h > a then 'gagne' else 'perdu' end; end if;
      if sel in ('N','X') then return case when h = a then 'gagne' else 'perdu' end; end if;
      if sel = '2' then return case when h < a then 'gagne' else 'perdu' end; end if;
      return 'en_attente';
    end if;
    if p_market = 'CORN_DC' then
      if sel in ('1N','1X') then return case when h >= a then 'gagne' else 'perdu' end; end if;
      if sel = '12' then return case when h <> a then 'gagne' else 'perdu' end; end if;
      if sel in ('N2','X2') then return case when h <= a then 'gagne' else 'perdu' end; end if;
      return 'en_attente';
    end if;
    if p_market = 'CORN_OE' then
      if sel in ('PAIR','EVEN') then return case when (h + a) % 2 = 0 then 'gagne' else 'perdu' end; end if;
      if sel in ('IMPAIR','ODD') then return case when (h + a) % 2 = 1 then 'gagne' else 'perdu' end; end if;
      return 'en_attente';
    end if;
    if p_param is null then return 'en_attente'; end if;
    if p_market = 'CORN_AH' then
      v := case when sel = '1' then (h - a) + p_param when sel = '2' then (a - h) + p_param else null end;
      if v is null then return 'en_attente'; end if;
      return case when v > 0 then 'gagne' when v < 0 then 'perdu' else 'rembourse' end;
    end if;
    v := case when right(p_market, 1) = '1' then h when right(p_market, 1) = '2' then a else h + a end;
    if v = p_param then return 'rembourse'; end if;
    if sel in ('PLUS','OVER','+') then return case when v > p_param then 'gagne' else 'perdu' end; end if;
    if sel in ('MOINS','UNDER','-') then return case when v < p_param then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;

  -- Ordre et minute des buts (0049) : première / dernière équipe à marquer, but avant une minute donnée
  if p_market in ('FTS', 'LTS', 'GB') then
    if m.score_home + m.score_away = 0 then
      if p_market = 'GB' then return case when sel in ('NON','NO') then 'gagne' when sel in ('OUI','YES') then 'perdu' else 'en_attente' end; end if;
      return case when sel in ('AUCUN','AUCUNE','0','N','X') then 'gagne' when sel in ('1','2') then 'perdu' else 'en_attente' end;
    end if;
    if d is null or d->'evts' is null or jsonb_typeof(d->'evts') <> 'array' then return 'en_attente'; end if;
    -- Les buts de la chronologie doivent recouper le score, équipe par équipe. Un but contre son camp peut être rangé
    -- sous l'équipe qui en profite (lecture A) ou sous celle du joueur (lecture B) : on garde la lecture qui recoupe, sinon on ne tranche pas.
    select count(*) filter (where e->>'e' = '1'), count(*) filter (where e->>'e' = '2'),
           count(*) filter (where (e->>'e' = '1') = (e->>'t' <> 'csc')), count(*) filter (where (e->>'e' = '2') = (e->>'t' <> 'csc'))
      into c1, c2, c3, c4 from jsonb_array_elements(d->'evts') e where e->>'t' in ('but', 'pen', 'csc');
    if c1 = m.score_home and c2 = m.score_away then k := 'A';
    elsif c3 = m.score_home and c4 = m.score_away then k := 'B';
    else return 'en_attente'; end if;
    if p_market = 'GB' then
      if p_param is null then return 'en_attente'; end if;
      v := (exists (select 1 from jsonb_array_elements(d->'evts') e where e->>'t' in ('but', 'pen', 'csc') and (e->>'m')::int <= p_param))::int;
      if sel in ('OUI','YES') then return case when v = 1 then 'gagne' else 'perdu' end; end if;
      if sel in ('NON','NO') then return case when v = 0 then 'gagne' else 'perdu' end; end if;
      return 'en_attente';
    end if;
    select case when k = 'B' and e->>'t' = 'csc' then (case when e->>'e' = '1' then '2' else '1' end) else e->>'e' end into first_n
      from jsonb_array_elements(d->'evts') with ordinality as t(e, i) where e->>'t' in ('but', 'pen', 'csc')
      order by (case when p_market = 'FTS' then 1 else -1 end) * ((e->>'m')::int * 10000 + coalesce((e->>'x')::int, 0) * 100 + i) limit 1;
    if sel in ('1','2') then return case when sel = first_n then 'gagne' else 'perdu' end; end if;
    if sel in ('AUCUN','AUCUNE','0','N','X') then return 'perdu'; end if;
    return 'en_attente';
  end if;

  -- But contre son camp, penalty manqué (0049) : sur la chronologie, quand elle est publiée
  if p_market in ('OG', 'PKM') then
    if m.details_at is null or d is null or d->'evts' is null or jsonb_typeof(d->'evts') <> 'array' or jsonb_array_length(d->'evts') = 0 then return 'en_attente'; end if;
    v := (exists (select 1 from jsonb_array_elements(d->'evts') e where e->>'t' = case when p_market = 'OG' then 'csc' else 'pen_rate' end))::int;
    if sel in ('OUI','YES') then return case when v = 1 then 'gagne' else 'perdu' end; end if;
    if sel in ('NON','NO') then return case when v = 0 then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;

  -- Joueurs (0049) : dernier buteur, 2 ou 3 buts, joueur averti
  if p_market in ('BUTL', 'BUT2', 'BUT3') then
    if d is null or d->'buteurs' is null or jsonb_typeof(d->'buteurs') <> 'array' then return 'en_attente'; end if;
    if p_market = 'BUTL' then
      select b->>'n' into first_n from jsonb_array_elements(d->'buteurs') with ordinality as t(b, i) order by (b->>'m')::int desc, coalesce((b->>'x')::int, 0) desc, i desc limit 1;
      if first_n is null then return case when sel in ('AUCUN','AUCUN BUTEUR','PAS DE BUT') then 'gagne' else 'perdu' end; end if;
      return case when betwise.same_player(p_selection, first_n) then 'gagne' else 'perdu' end;
    end if;
    select count(*) into c1 from jsonb_array_elements(d->'buteurs') b where betwise.same_player(p_selection, b->>'n');
    return case when c1 >= (case when p_market = 'BUT2' then 2 else 3 end) then 'gagne' else 'perdu' end;
  end if;
  if p_market = 'PCARD' then
    if m.details_at is null or d is null or d->'evts' is null or jsonb_typeof(d->'evts') <> 'array' or jsonb_array_length(d->'evts') = 0 then return 'en_attente'; end if;
    return case when exists (select 1 from jsonb_array_elements(d->'evts') e where e->>'t' in ('jaune', 'rouge') and betwise.same_player(p_selection, e->>'n')) then 'gagne' else 'perdu' end;
  end if;

  -- Combiné libre sur un même match (0049) : « CODE@ligne:choix & CODE:choix & … »
  if p_market = 'COMBO' then
    for leg in select trim(x) from unnest(string_to_array(p_selection, '&')) x loop
      if position(':' in leg) = 0 then return 'en_attente'; end if;
      lm := upper(trim(split_part(leg, ':', 1))); ls := trim(substr(leg, position(':' in leg) + 1)); lp := null;
      if position('@' in lm) > 0 then
        if split_part(lm, '@', 2) !~ '^-?\d+(\.\d+)?$' then return 'en_attente'; end if;
        lp := split_part(lm, '@', 2)::numeric; lm := split_part(lm, '@', 1);
      end if;
      if lm in ('COMBO', 'LIBRE') or ls = '' then return 'en_attente'; end if;
      r := betwise.settle_sel(lm, lp, ls, m);
      if r = 'perdu' then return 'perdu'; end if;
      if r = 'en_attente' then n_att := n_att + 1; elsif r = 'rembourse' then n_rr := n_rr + 1; else n_gg := n_gg + 1; end if;
    end loop;
    if n_att > 0 or n_gg + n_rr < 2 then return 'en_attente'; end if;
    if n_rr > 0 then return case when n_gg = 0 then 'rembourse' else 'en_attente' end; end if;
    return 'gagne';
  end if;

$n$ || anc);
    execute def;
  end if;
end $do$;
