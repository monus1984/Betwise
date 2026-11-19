-- Test rejouable des marchés « statistique d'un joueur » (0050). Rien n'est écrit : le bloc finit par une exception qui porte le rapport.
-- Match réel : Espagne – Angleterre 2-3 du 15/11/2026 (feuille du fournisseur).
do $$
declare m betwise.matches; r text := ''; ko int := 0; c record; got text;
begin
  select x.* into m from betwise.matches x where x.af_fixture_id = 1528984;
  if m.details->'joueurs' is null then raise exception 'feuille des joueurs absente'; end if;
  for c in select * from (values
    ('PSOT',  1.5, 'Plus|Harry Kane',      'perdu'),      -- 1 tir cadré
    ('PSOT',  0.5, 'Plus|Harry Kane',      'gagne'),
    ('PSHOT', 2.5, 'Plus|H. Kane',         'gagne'),      -- 3 tirs
    ('PSOT',  1.5, 'Plus|Lamine Yamal',    'perdu'),      -- 6 tirs, 1 cadré
    ('PSHOT', 4.5, 'Plus|Yamal',           'gagne'),
    ('PSHOT', 5.5, 'Moins|Lamine Yamal',   'perdu'),
    ('PAST',  0.5, 'Plus|Lamine Yamal',    'gagne'),      -- 1 passe décisive
    ('PAST',  0.5, 'Plus|Declan Rice',     'gagne'),
    ('PAST',  0.5, 'Moins|Harry Kane',     'gagne'),
    ('PSOT',  1,   'Plus|Harry Kane',      'rembourse'),  -- ligne entière atteinte
    ('PSHOT', 0.5, 'Plus|Bellingham',      'en_attente'), -- deux J. Bellingham : on ne choisit pas
    ('PSHOT', 0.5, 'Plus|Jude Bellingham', 'en_attente'), -- même initiale : toujours deux
    ('PSHOT', 0.5, 'Plus|Eberechi Eze',    'rembourse'),  -- n'a pas joué
    ('PSHOT', 0.5, 'Plus|Kylian Mbappé',   'en_attente'), -- pas sur la feuille
    ('PSHOT', 0.5, 'Plus|Pau Cubarsí',     'perdu'),      -- « Pau Cubarsí Paredes » chez le fournisseur
    ('PSHOT', null,'Plus|Harry Kane',      'en_attente'),
    ('PSOT',  0.5, 'Harry Kane',           'en_attente')
  ) t(mk, prm, sel, attendu) loop
    got := betwise.settle_sel(c.mk, c.prm::numeric, c.sel, m)::text;
    if got <> c.attendu then ko := ko + 1; r := r || 'ÉCHEC ' || c.mk || ' ' || coalesce(c.prm::text, '∅') || ' ' || c.sel || ' : ' || got || ' au lieu de ' || c.attendu || E'\n'; end if;
  end loop;
  -- dans un combiné libre
  got := betwise.settle_sel('COMBO', null, 'BTTS:Oui & PSHOT@2.5:Plus|Harry Kane', m)::text;
  if got <> 'gagne' then ko := ko + 1; r := r || 'ÉCHEC combo : ' || got || E'\n'; end if;
  raise exception E'RAPPORT : % échec(s) sur 18\n%', ko, r;
end $$;
