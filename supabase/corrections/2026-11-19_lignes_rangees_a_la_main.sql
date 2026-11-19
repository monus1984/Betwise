-- Correction de données du 19/11/2026 — PARTIE 2 de la relecture des libellés d'origine (voir 2026-11-18_relecture_libelles.sql).
-- Six lignes que l'utilisateur avait rangées à la main sous un marché voisin, faute de marché adapté à l'époque (ou parce que
-- les boutons « Oui / Non » affichaient « Les deux marquent / Pas les deux »). Recodées avec son accord (« Ok corrige », 19/11 à 07:07),
-- d'après le libellé conservé à l'import (uploads.json_extrait).
-- Aucune suppression ; chaque changement est tracé dans bet_versions / prediction_versions ; aucun mouvement de bankroll
-- (quatre paris test, et un pari réel qui reste perdu). Le bloc s'arrête sans rien écrire si une ligne n'est plus dans l'état attendu.
--
-- APPLIQUÉE le 19/11/2026 vers 07:15 UTC, après un essai à blanc (ligne « --ESSAI » activée : le rapport sort, rien n'est gardé).
-- Résultat : 6 lignes recodées, 5 pronos recodés avec elles (e4ae « Moi », 42c1 « Alfred », 4d9a, d4c5 et f5d8
-- « Informations foot international »), 3 paris test dont le statut change (8d0e gagné → perdu, 7eb3 perdu → gagné,
-- 8123 gagné → perdu), 3a93 et le pari réel 979e inchangés. compute_source_metrics() relancé (13 sources).
-- Contrôle de cohérence ensuite : tout à 0 sur 256 sélections, 139 pronos, 99 paris (le contrôle I passe de 2 à 0).
--
--   pari  ligne      enregistré      → d'après le libellé   résultat de la ligne   match
--   8d0e  21002c73   PEN Non         → PKB Oui              gagné → perdu          Biélorussie – Albanie 0-2, aucun but sur penalty
--   8d0e  ee9e288b   PEN Non         → PKB Oui              gagné → gagné          Espagne – Angleterre 2-3, but(s) sur penalty
--   7eb3  4697a19c   TT2 0,5 Moins   → TT2 0,5 Plus         perdu → gagné          Rwanda – Mali 0-2
--   8123  1f5f01a0   TT2 0,5 Moins   → TT2 0,5 Plus         gagné → perdu          Liberia – Cap-Vert 2-0
--   3a93  97f3c981   HT_DC N2        → WEH 2                gagné → gagné          Pays de Galles – Portugal 2-3 (2-2 à la pause)
--   979e  51c6f6ce   HT_1X2 2        → WEH 2                perdu → gagné          même match ; pari réel, reste perdu (3 autres lignes perdues)
do $$
declare
  c record; s betwise.bet_selections; b betwise.bets; m betwise.matches; v_res betwise.settle_result; v_pred betwise.predictions;
  n_lost int; n_pending int; v_cote numeric; v_statut betwise.bet_status; v_gain numeric; v_key text; v_marche jsonb; ids uuid[] := '{}';
  v_motif text; r text := '';
begin
  for c in select * from (values
    ('21002c73-311a-4a45-b95e-bfc89c0d49c9'::uuid, 'PEN',    null::numeric, 'Non',   'PKB', null::numeric, 'Oui',  'capture du 15/11 : « Une des 2 équipes marque un pénalty — But marqué sur penalty » (Biélorussie – Albanie)'),
    ('ee9e288b-bf9d-45c2-8817-3db90109ac49'::uuid, 'PEN',    null::numeric, 'Non',   'PKB', null::numeric, 'Oui',  'capture du 15/11 : « Une des 2 équipes marque un pénalty — But marqué sur penalty » (Espagne – Angleterre)'),
    ('4697a19c-7d6c-4d31-bf00-1caeaea2669c'::uuid, 'TT2',    0.5::numeric,  'Moins', 'TT2', 0.5::numeric,  'Plus', 'publication du 17/11 : « Mali — Va marquer »'),
    ('1f5f01a0-551f-491a-93b1-8a58e034644f'::uuid, 'TT2',    0.5::numeric,  'Moins', 'TT2', 0.5::numeric,  'Plus', 'publication du 17/11 : « Cap-Vert — Va marquer »'),
    ('97f3c981-af25-47fc-b5d1-f9c5ee0aa4cb'::uuid, 'HT_DC',  null::numeric, 'N2',    'WEH', null::numeric, '2',    'publication du 17/11 : « Portugal — Gagne au moins une mi-temps »'),
    ('51c6f6ce-2beb-40c3-a6d4-13884e8e18a8'::uuid, 'HT_1X2', null::numeric, '2',     'WEH', null::numeric, '2',    'ticket Betclic du 17/11 : « Portugal gagne au moins 1 mi-temps — Oui »')
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
    v_motif := 'ligne rangée à la main sous un marché voisin, recodée le 19/11 avec ton accord — ' || c.libelle;
    v_marche := jsonb_build_object('avant', s.market_code || ' ' || coalesce(s.market_param::text, '') || ' ' || s.selection, 'apres', c.new_mk || ' ' || coalesce(round(c.new_prm, 2)::text, '') || ' ' || c.new_sel);
    update betwise.bet_selections set market_code = c.new_mk, market_param = c.new_prm, selection = c.new_sel, resultat = v_res where id = s.id;
    insert into betwise.bet_versions (bet_id, selection_id, changes, changed_by)
    values (b.id, s.id, jsonb_build_object('marche', v_marche, 'resultat', jsonb_build_object('avant', s.resultat, 'apres', v_res), 'motif', v_motif), null);
    r := r || 'ligne ' || left(s.id::text, 8) || ' (pari ' || left(b.id::text, 4) || case when b.virtuel then ', test' else ', réel' end || ') : ' || (v_marche->>'avant') || ' → ' || (v_marche->>'apres') || ' · ' || s.resultat || ' → ' || v_res || E'\n';
    if b.virtuel then
      v_pred := null;
      select * into v_pred from betwise.predictions p where p.source_id = s.origin_source_id and p.match_id = s.match_id and p.market_code = c.old_mk
         and p.market_param is not distinct from c.old_prm and p.selection = c.old_sel and p.statut <> 'annule';
      if v_pred.id is not null then
        v_key := v_pred.source_id::text || '|' || v_pred.match_id::text || '|' || c.new_mk || '|' || coalesce(round(c.new_prm, 2)::text, '') || '|' || lower(c.new_sel) || '|' || to_char(coalesce(v_pred.published_at, v_pred.logged_at) at time zone 'UTC', 'YYYY-MM-DD');
        if exists (select 1 from betwise.predictions q where q.dedupe_key = v_key and q.id <> v_pred.id) then raise exception 'prono % : un prono identique existe déjà', v_pred.id; end if;
        update betwise.predictions set market_code = c.new_mk, market_param = c.new_prm, selection = c.new_sel, resultat = v_res, dedupe_key = v_key where id = v_pred.id;
        insert into betwise.prediction_versions (prediction_id, changes, changed_by)
        values (v_pred.id, jsonb_build_object('marche', v_marche, 'resultat', jsonb_build_object('avant', v_pred.resultat, 'apres', v_res), 'motif', v_motif), null);
        r := r || '  prono ' || left(v_pred.id::text, 4) || ' (' || (select nom from betwise.sources where id = v_pred.source_id) || ') : ' || v_pred.resultat || ' → ' || v_res || E'\n';
      end if;
    end if;
    if not (b.id = any(ids)) then ids := ids || b.id; end if;
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
      r := r || 'pari ' || left(b.id::text, 4) || ' (réel) : reste ' || b.statut || ', ' || n_lost || ' ligne(s) perdue(s), gain et bankroll inchangés' || E'\n';
    elsif v_statut <> b.statut or v_gain is distinct from b.gain_net then
      insert into betwise.bet_versions (bet_id, changes, changed_by)
      values (b.id, jsonb_build_object('statut', jsonb_build_object('avant', b.statut, 'apres', v_statut), 'gain_net', jsonb_build_object('avant', b.gain_net, 'apres', v_gain), 'motif', 'ligne rangée à la main sous un marché voisin, recodée le 19/11 avec ton accord'), null);
      update betwise.bets set statut = v_statut, gain_net = v_gain, cote_totale = case when v_statut = 'gagne' then round(v_cote, 3) else cote_totale end where id = b.id;
      r := r || 'pari ' || left(b.id::text, 4) || ' (test) : ' || b.statut || ' → ' || v_statut || ' · gain ' || coalesce(b.gain_net::text, '∅') || ' → ' || v_gain || E'\n';
    else
      r := r || 'pari ' || left(b.id::text, 4) || ' (test) : inchangé (' || b.statut || ', gain ' || coalesce(b.gain_net::text, '∅') || ')' || E'\n';
    end if;
  end loop;
  --ESSAI raise exception E'RAPPORT (essai, rien n''est gardé)\n%', r;
end $$;
