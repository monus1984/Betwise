-- 0038 — Appliquée le 2026-11-16.
-- Un ticket importé arrive avec des statuts lus sur l'image. Ils ne font pas foi : les scores en base, si.
-- bet_recheck remet chaque sélection d'accord avec le match (joué : résultat calculé ; pas encore joué : en attente)
-- et rouvre un pari marqué perdu alors qu'aucune sélection n'est perdue et qu'il reste des matchs à jouer.
create or replace function betwise.bet_recheck(p_bet_id uuid)
returns text language plpgsql security definer set search_path to 'betwise', 'public' as $fn$
declare uid uuid := auth.uid(); b betwise.bets; r record; v_calc betwise.settle_result; n_fix int := 0; n_lost int; n_pending int; v_msg text := null;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;

  for r in select s.id, s.market_code, s.market_param, s.selection, s.resultat, m as mt
             from betwise.bet_selections s join betwise.matches m on m.id = s.match_id where s.bet_id = b.id loop
    if (r.mt).statut = 'termine' then v_calc := betwise.settle_sel(r.market_code, r.market_param, r.selection, r.mt);
    elsif (r.mt).statut in ('programme', 'en_cours') then v_calc := 'en_attente';
    else continue; end if;
    -- match joué mais non calculable (statistiques absentes) : on garde ce qui a été saisi
    if (r.mt).statut = 'termine' and v_calc = 'en_attente' then continue; end if;
    if v_calc is distinct from r.resultat then
      update betwise.bet_selections set resultat = v_calc, settled_at = case when v_calc = 'en_attente' then null else now() end where id = r.id;
      insert into betwise.bet_versions (bet_id, selection_id, changes, changed_by)
      values (b.id, r.id, jsonb_build_object('resultat', jsonb_build_object('avant', r.resultat, 'apres', v_calc), 'motif', 'accord avec le score en base'), uid);
      n_fix := n_fix + 1;
    end if;
  end loop;

  select count(*) filter (where resultat = 'perdu'), count(*) filter (where resultat = 'en_attente') into n_lost, n_pending
    from betwise.bet_selections where bet_id = b.id;

  if b.statut = 'perdu' and n_pending > 0 and (n_lost = 0 or (n_lost = 1 and b.assurance)) then
    insert into betwise.bet_versions (bet_id, changes, changed_by)
    values (b.id, jsonb_build_object('statut', jsonb_build_object('avant', 'perdu', 'apres', 'en_cours'), 'motif', 'aucune sélection perdue, des matchs restent à jouer'), uid);
    update betwise.bets set statut = 'en_cours', gain_net = null, settled_at = null, resultat_propose = null, gain_propose = null where id = b.id;
    v_msg := 'Le ticket était lu comme perdu, mais aucune sélection n''est perdue d''après les scores et des matchs restent à jouer : il est enregistré en cours.';
  elsif b.statut = 'gagne' and n_lost > 0 then
    v_msg := 'Le ticket est enregistré gagné, mais une sélection est perdue d''après les scores : vérifie-le.';
  elsif b.statut = 'gagne' and n_pending > 0 then
    v_msg := 'Le ticket est enregistré gagné alors qu''un match n''est pas terminé : vérifie-le.';
  elsif n_fix > 0 then
    v_msg := n_fix || ' sélection(s) remise(s) d''accord avec le score du match.';
  end if;
  return v_msg;
end $fn$;
revoke all on function betwise.bet_recheck(uuid) from public, anon;
grant execute on function betwise.bet_recheck(uuid) to authenticated;

-- settle_bet : confirmer « perdu » ne marque plus perdues les sélections dont le match n'est pas joué.
-- Seule ligne changée par rapport à 0036 :
--   if p_result <> 'perdu' then
--     update betwise.bet_selections set resultat = p_result, settled_at = now() where bet_id = b.id and resultat = 'en_attente';
--   end if;
-- (définition complète appliquée en base ; voir pg_get_functiondef('betwise.settle_bet'::regproc))
