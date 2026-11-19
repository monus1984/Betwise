-- Correction de données du 18/11/2026 — relecture des libellés d'origine conservés à l'import (uploads.json_extrait).
-- Aucune suppression ; chaque changement est tracé dans bet_versions / prediction_versions ; aucun mouvement de bankroll.
--
-- PARTIE 1 (appliquée le 18/11) : lignes mal lues PAR L'ANALYSEUR, sans que l'utilisateur ait rien choisi.
--   5fee (réel, perdu)  : deux lignes « + de 2,5 / Oui » (MyCombi) enregistrées « les deux marquent » → « plus de 2,5 et les deux marquent ».
--   979e (réel, perdu)  : « Résultat du match (remboursé si match nul) — Angola » enregistrée en victoire sèche → remboursé si nul.
--   55b2 (test)         : « +2 BUTS » enregistrée « plus de 2 » → « plus de 1,5 » (règle du 12/11) ; remboursé → gagné.
-- PARTIE 2 (appliquée le 19/11 avec l'accord de Mounir, voir 2026-11-19_lignes_rangees_a_la_main.sql) : lignes que l'utilisateur
--   avait rangées à la main sous un marché voisin, faute de marché adapté à l'époque. Liste d'origine en fin de fichier.
do $$
declare
  c record; s betwise.bet_selections; b betwise.bets; m betwise.matches; v_res betwise.settle_result; v_pred betwise.predictions;
  n_lost int; n_pending int; v_cote numeric; v_statut betwise.bet_status; v_gain numeric; v_key text; v_marche jsonb; ids uuid[] := '{}';
begin
  for c in select * from (values
    ('c9a88937-0e8f-48b0-86e1-dc2fdab4ca5a'::uuid, 'BTTS', null::numeric, 'Oui',  'OU_BTTS', 2.5::numeric, 'Plus|Oui', 'ticket Betclic du 15/11 : « + de 2,5 Nombre total de buts / Les 2 équipes marquent — + de 2,5 / Oui »'),
    ('e683a1a1-9d3d-411d-b35e-16e26623a9a0'::uuid, 'BTTS', null::numeric, 'Oui',  'OU_BTTS', 2.5::numeric, 'Plus|Oui', 'ticket Betclic du 15/11 : « + de 2,5 Nombre total de buts / Les 2 équipes marquent — + de 2,5 / Oui »'),
    ('9097c7a0-6d5b-4f32-9ed2-b355ede096f0'::uuid, '1X2',  null::numeric, '2',    'DNB',     null::numeric, '2',        'ticket Betclic du 17/11 : « Résultat du match (remboursé si match nul) — Angola »'),
    ('63c69c4f-055a-485d-bfa1-ea7ea9ef89ec'::uuid, 'OU',   2::numeric,    'Plus', 'OU',      1.5::numeric,  'Plus',     'prono du 12/11 : « +2 BUTS », lu depuis le 12/11 comme « au moins 2 buts », soit plus de 1,5')
  ) as t(sel_id, old_mk, old_prm, old_sel, new_mk, new_prm, new_sel, libelle)
  loop
    select * into s from betwise.bet_selections where id = c.sel_id for update;
    if s.id is null or s.market_code <> c.old_mk or s.selection <> c.old_sel or s.market_param is distinct from c.old_prm then
      raise exception 'ligne % : état inattendu (% % %)', c.sel_id, s.market_code, s.market_param, s.selection;
    end if;
    select * into b from betwise.bets where id = s.bet_id for update;
    select * into m from betwise.matches where id = s.match_id;
    if m.id is null or m.statut <> 'termine' then raise exception 'ligne % : match non terminé', c.sel_id; end if;
    v_res := betwise.settle_sel(c.new_mk, c.new_prm, c.new_sel, m);
    if v_res = 'en_attente' then raise exception 'ligne % : résultat non calculable', c.sel_id; end if;
    v_marche := jsonb_build_object('avant', s.market_code || ' ' || coalesce(s.market_param::text, '') || ' ' || s.selection, 'apres', c.new_mk || ' ' || coalesce(c.new_prm::text, '') || ' ' || c.new_sel);
    update betwise.bet_selections set market_code = c.new_mk, market_param = c.new_prm, selection = c.new_sel, resultat = v_res where id = s.id;
    insert into betwise.bet_versions (bet_id, selection_id, changes, changed_by)
    values (b.id, s.id, jsonb_build_object('marche', v_marche, 'resultat', jsonb_build_object('avant', s.resultat, 'apres', v_res), 'motif', 'relecture du libellé d''origine le 18/11 — ' || c.libelle), null);
    if b.virtuel then
      v_pred := null;
      select * into v_pred from betwise.predictions p where p.source_id = s.origin_source_id and p.match_id = s.match_id and p.market_code = c.old_mk
         and p.market_param is not distinct from c.old_prm and p.selection = c.old_sel and p.statut <> 'annule';
      if v_pred.id is not null then
        v_key := v_pred.source_id::text || '|' || v_pred.match_id::text || '|' || c.new_mk || '|' || coalesce(round(c.new_prm, 2)::text, '') || '|' || lower(c.new_sel) || '|' || to_char(coalesce(v_pred.published_at, v_pred.logged_at) at time zone 'UTC', 'YYYY-MM-DD');
        if exists (select 1 from betwise.predictions q where q.dedupe_key = v_key and q.id <> v_pred.id) then raise exception 'prono % : un prono identique existe déjà', v_pred.id; end if;
        update betwise.predictions set market_code = c.new_mk, market_param = c.new_prm, selection = c.new_sel, resultat = v_res, dedupe_key = v_key where id = v_pred.id;
        insert into betwise.prediction_versions (prediction_id, changes, changed_by)
        values (v_pred.id, jsonb_build_object('marche', v_marche, 'resultat', jsonb_build_object('avant', v_pred.resultat, 'apres', v_res), 'motif', 'relecture du libellé d''origine le 18/11 — ' || c.libelle), null);
      end if;
    end if;
    ids := ids || b.id;
  end loop;

  -- Paris : statut recalculé pour les tests ; un pari réel dont le statut bougerait fait tout annuler
  for b in select bb.* from betwise.bets bb where bb.id = any(ids) loop
    select count(*) filter (where resultat = 'en_attente'), count(*) filter (where resultat = 'perdu'), coalesce(exp(sum(ln(cote)) filter (where resultat = 'gagne')), 1)
      into n_pending, n_lost, v_cote from betwise.bet_selections where bet_id = b.id;
    if n_pending > 0 and n_lost = 0 then raise exception 'pari % : une ligne est encore en attente', b.id; end if;
    v_statut := case when n_lost > 1 or (n_lost = 1 and not b.assurance) then 'perdu' when n_lost = 1 then 'rembourse' when round(v_cote, 6) = 1 then 'rembourse' else 'gagne' end;
    v_gain := case v_statut when 'perdu' then -b.mise when 'rembourse' then 0 else round(b.mise * betwise.cote_payee(v_cote, b.bookmaker), 2) - b.mise end;
    if not b.virtuel then
      if v_statut <> b.statut then raise exception 'pari réel % : le statut changerait (% → %), correction abandonnée', b.id, b.statut, v_statut; end if;
    elsif v_statut <> b.statut or v_gain is distinct from b.gain_net then
      insert into betwise.bet_versions (bet_id, changes, changed_by)
      values (b.id, jsonb_build_object('statut', jsonb_build_object('avant', b.statut, 'apres', v_statut), 'gain_net', jsonb_build_object('avant', b.gain_net, 'apres', v_gain), 'motif', 'relecture du libellé d''origine le 18/11'), null);
      update betwise.bets set statut = v_statut, gain_net = v_gain, cote_totale = case when v_statut = 'gagne' then round(v_cote, 3) else cote_totale end where id = b.id;
    end if;
  end loop;
end $$;

-- PARTIE 2 — APPLIQUÉE LE 19/11 par le fichier 2026-11-19_lignes_rangees_a_la_main.sql. Lignes rangées à la main par l'utilisateur sous un marché voisin (le bon marché n'existait pas,
-- ou les boutons « Oui / Non » affichaient « Les deux marquent / Pas les deux »). À recoder seulement avec son accord,
-- par le même bloc que ci-dessus en remplaçant la liste « values » :
--
--   pari  ligne                                  enregistré        → d'après le libellé          résultat de la ligne
--   8d0e  21002c73-311a-4a45-b95e-bfc89c0d49c9   PEN Non           → PKB Oui (but sur penalty)   gagné → perdu   (Biélorussie–Albanie 0-2, aucun penalty)
--   8d0e  ee9e288b-bf9d-45c2-8817-3db90109ac49   PEN Non           → PKB Oui                     gagné → gagné   (Espagne–Angleterre 2-3, deux buts sur penalty)
--         → test 8d0e : gagné à 11,90 → perdu ; pronos e4ae (Moi) et 42c1 (Alfred) recodés de même
--   7eb3  4697a19c-7d6c-4d31-bf00-1caeaea2669c   TT2 0,5 Moins     → TT2 0,5 Plus (« Mali va marquer »)      perdu → gagné (Rwanda–Mali 0-2)
--   8123  1f5f01a0-551f-491a-93b1-8a58e034644f   TT2 0,5 Moins     → TT2 0,5 Plus (« Cap-Vert va marquer ») gagné → perdu (Liberia–Cap-Vert 2-0)
--   3a93  97f3c981-af25-47fc-b5d1-f9c5ee0aa4cb   HT_DC N2          → WEH 2 (« gagne au moins une mi-temps ») gagné → gagné (Galles–Portugal 2-3, mi-temps 2-2)
--   979e  51c6f6ce-2beb-40c3-a6d4-13884e8e18a8   HT_1X2 2          → WEH 2 (« Portugal gagne au moins 1 mi-temps ») perdu → gagné ; pari réel, reste perdu
--
-- Lignes jamais enregistrées (écartées à l'import avant le 18/11), sans effet sur la bankroll car les deux tickets sont perdus :
--   d019 : « Guinée gagne au moins 1 mi-temps — Oui » (cote 1,24) ; d95f : « Un joueur va marquer un doublé — Non » (cote 1,288).
