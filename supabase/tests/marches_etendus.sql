-- Test rejouable des marchés ajoutés par 0049, sur un match réel (Espagne – Angleterre 2-3, 0-1 à la pause, 19 événements connus)
-- puis sur des feuilles de match fabriquées (but contre son camp, chronologie incohérente). N'écrit rien.
do $$
declare
  m betwise.matches; f betwise.matches; r text := ''; n_ok int := 0; n_ko int := 0; c record; v text;
begin
  select x.* into m from betwise.matches x join betwise.teams th on th.id = x.home_team_id join betwise.teams ta on ta.id = x.away_team_id
   where th.nom = 'Espagne' and ta.nom = 'Angleterre' and x.score_home = 2 and x.score_away = 3 and x.statut = 'termine' limit 1;
  if m.id is null then raise exception 'RAPPORT impossible : match de référence introuvable'; end if;
  for c in select * from (values
    ('FTS', null::numeric, '2', 'gagne'), ('FTS', null, '1', 'perdu'), ('FTS', null, 'Aucun', 'perdu'), ('LTS', null, '1', 'gagne'), ('LTS', null, '2', 'perdu'),
    ('GB', 45, 'Oui', 'gagne'), ('GB', 30, 'Oui', 'perdu'), ('GB', 30, 'Non', 'gagne'), ('GB', null, 'Oui', 'en_attente'),
    ('OG', null, 'Non', 'gagne'), ('OG', null, 'Oui', 'perdu'), ('PKM', null, 'Non', 'gagne'),
    ('BUTL', null, 'Nico Williams', 'gagne'), ('BUTL', null, 'Harry Kane', 'perdu'), ('BUT2', null, 'Harry Kane', 'perdu'), ('BUT3', null, 'Ben White', 'perdu'),
    ('PCARD', null, 'Declan Rice', 'gagne'), ('PCARD', null, 'Elliot Anderson', 'gagne'), ('PCARD', null, 'Harry Kane', 'perdu'),
    ('CARD_1X2', null, 'N', 'gagne'), ('CARD_1X2', null, '1', 'perdu'), ('RED1', null, 'Oui', 'perdu'), ('RED2', null, 'Oui', 'gagne'), ('RED2', null, 'Non', 'perdu'),
    ('SHOT1', 20.5, 'Plus', 'gagne'), ('SHOT2', 9, 'Plus', 'rembourse'), ('SHOT2', 9.5, 'Moins', 'gagne'),
    ('CORN_AH', 2.5, '1', 'gagne'), ('CORN_AH', 2, '1', 'rembourse'), ('CORN_AH', -1.5, '2', 'gagne'), ('CORN_AH', -2.5, '2', 'perdu'),
    ('CORN_OE', null, 'Pair', 'gagne'), ('CORN_OE', null, 'Impair', 'perdu'), ('CORN_DC', null, 'N2', 'gagne'), ('CORN_DC', null, '1N', 'perdu'), ('CORN_DC', null, '12', 'gagne'),
    ('FOUL', 20.5, 'Plus', 'en_attente'), ('OFF1', 1.5, 'Moins', 'en_attente'),
    ('WBH', null, '2', 'perdu'), ('WBH', null, '1', 'perdu'), ('SBH', null, '2', 'gagne'), ('SBH', null, '1', 'perdu'),
    ('OE1', null, 'Pair', 'gagne'), ('OE2', null, 'Impair', 'gagne'), ('OE2', null, 'Pair', 'perdu'), ('MG1', null, '2-2', 'gagne'), ('MG2', null, '0-2', 'perdu'), ('MG2', null, '3-9', 'gagne'),
    ('HT_AH', -0.5, '2', 'gagne'), ('HT_DNB', null, '2', 'gagne'), ('H2_DNB', null, '1', 'rembourse'), ('HT_OE', null, 'Impair', 'gagne'), ('H2_OE', null, 'Pair', 'gagne'), ('H2_CS', null, '2-2', 'gagne'), ('H2_AH', 0.5, '1', 'gagne'),
    ('COMBO', null, 'DC:N2 & OU@2.5:Plus', 'gagne'), ('COMBO', null, 'DC:1N & OU@2.5:Plus', 'perdu'), ('COMBO', null, '1X2:2 & CORN@8.5:Plus & BTTS:Oui', 'gagne'),
    ('COMBO', null, '1X2:2 & FOUL@20.5:Plus', 'en_attente'), ('COMBO', null, '1X2:1 & FOUL@20.5:Plus', 'perdu'), ('COMBO', null, '1X2:2 & SHOT2@9:Plus', 'en_attente'),
    ('COMBO', null, 'H2_DNB:1 & SHOT2@9:Plus', 'rembourse'), ('COMBO', null, 'BUT:Harry Kane & 1X2:2 & PCARD:Declan Rice', 'gagne'), ('COMBO', null, '1X2:2', 'en_attente'),
    ('COMBO', null, 'COMBO:x & 1X2:2', 'en_attente'), ('COMBO', null, 'ou@2.5:plus & btts:oui', 'gagne')
  ) as t(mk, prm, sl, attendu) loop
    v := betwise.settle_sel(c.mk, c.prm, c.sl, m)::text;
    if v = c.attendu then n_ok := n_ok + 1; else n_ko := n_ko + 1; r := r || 'ECHEC ' || c.mk || ' ' || coalesce(c.prm::text, '') || ' ' || c.sl || ' : ' || v || ' (attendu ' || c.attendu || E')\n'; end if;
  end loop;

  -- Feuilles fabriquées : 1-0 sur un but contre son camp, rangé sous l'équipe qui en profite (A) puis sous celle du joueur (B)
  f := m; f.score_home := 1; f.score_away := 0; f.ht_home := 0; f.ht_away := 0;
  f.details := '{"evts": [{"e": "1", "m": 60, "n": "X", "t": "csc"}], "buteurs": []}'::jsonb;
  for c in select * from (values ('FTS', null::numeric, '1', 'gagne'), ('LTS', null, '2', 'perdu'), ('OG', null, 'Oui', 'gagne'), ('GB', 45, 'Oui', 'perdu'), ('GB', 60, 'Oui', 'gagne'), ('BUTL', null, 'X', 'perdu')) as t(mk, prm, sl, attendu) loop
    v := betwise.settle_sel(c.mk, c.prm, c.sl, f)::text;
    if v = c.attendu then n_ok := n_ok + 1; else n_ko := n_ko + 1; r := r || 'ECHEC csc A ' || c.mk || ' ' || c.sl || ' : ' || v || E'\n'; end if;
  end loop;
  f.details := '{"evts": [{"e": "2", "m": 60, "n": "X", "t": "csc"}], "buteurs": []}'::jsonb;
  for c in select * from (values ('FTS', null::numeric, '1', 'gagne'), ('FTS', null, '2', 'perdu'), ('LTS', null, '1', 'gagne')) as t(mk, prm, sl, attendu) loop
    v := betwise.settle_sel(c.mk, c.prm, c.sl, f)::text;
    if v = c.attendu then n_ok := n_ok + 1; else n_ko := n_ko + 1; r := r || 'ECHEC csc B ' || c.mk || ' ' || c.sl || ' : ' || v || E'\n'; end if;
  end loop;
  -- Chronologie qui ne recoupe pas le score (un but manque) : on ne tranche pas
  f.score_home := 2; f.details := '{"evts": [{"e": "1", "m": 10, "n": "Y", "t": "but"}]}'::jsonb;
  for c in select * from (values ('FTS', null::numeric, '1', 'en_attente'), ('GB', 15, 'Oui', 'en_attente')) as t(mk, prm, sl, attendu) loop
    v := betwise.settle_sel(c.mk, c.prm, c.sl, f)::text;
    if v = c.attendu then n_ok := n_ok + 1; else n_ko := n_ko + 1; r := r || 'ECHEC incohérent ' || c.mk || ' : ' || v || E'\n'; end if;
  end loop;
  -- 0-0 : aucune chronologie nécessaire
  f.score_home := 0; f.score_away := 0; f.details := null;
  for c in select * from (values ('FTS', null::numeric, 'Aucun', 'gagne'), ('FTS', null, '1', 'perdu'), ('GB', 30, 'Non', 'gagne'), ('GB', 30, 'Oui', 'perdu'), ('WBH', null, '1', 'perdu'), ('MG1', null, '0-0', 'gagne')) as t(mk, prm, sl, attendu) loop
    v := betwise.settle_sel(c.mk, c.prm, c.sl, f)::text;
    if v = c.attendu then n_ok := n_ok + 1; else n_ko := n_ko + 1; r := r || 'ECHEC 0-0 ' || c.mk || ' ' || c.sl || ' : ' || v || E'\n'; end if;
  end loop;
  -- Les marchés d'avant ne bougent pas
  for c in select * from (values ('1X2', null::numeric, '2', 'gagne'), ('OU', 5, 'Plus', 'rembourse'), ('PKB', null, 'Oui', 'gagne'), ('WEH', null, '2', 'gagne'), ('CORN', 9.5, 'Plus', 'gagne'), ('BUT', null, 'Harry Kane', 'gagne'), ('HTFT', null, '2/2', 'gagne')) as t(mk, prm, sl, attendu) loop
    v := betwise.settle_sel(c.mk, c.prm, c.sl, m)::text;
    if v = c.attendu then n_ok := n_ok + 1; else n_ko := n_ko + 1; r := r || 'ECHEC ancien ' || c.mk || ' ' || c.sl || ' : ' || v || E'\n'; end if;
  end loop;
  raise exception E'RAPPORT % ok, % échec(s) · % marchés en base\n%', n_ok, n_ko, (select count(*) from betwise.markets), r;
end $$;
