-- 0036 : (1) un pari RÉEL n'est plus réglé tout seul. Le règlement automatique calcule un résultat PROPOSÉ ;
--            la bankroll ne bouge que lorsque l'utilisateur confirme (settle_bet). Les tests restent réglés automatiquement.
--        (2) plus aucune écriture directe sur les tables d'argent, de pronos et de référentiel avec un compte connecté :
--            tout passe par les fonctions, qui contrôlent auth.uid(). La RLS reste en place en seconde barrière.
--        (3) l'ancienne version de place_bet (6 arguments) n'est plus appelable.

alter table betwise.bets
  add column if not exists resultat_propose betwise.settle_result,
  add column if not exists gain_propose numeric,
  add column if not exists propose_at timestamptz;

create or replace function betwise.finalize_bet(p_bet_id uuid) returns void language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare b betwise.bets; n_pending int; n_lost int; v_cote numeric; v_gain numeric; v_result betwise.bet_status; v_prop betwise.settle_result;
begin
  select * into b from betwise.bets where id = p_bet_id for update;
  if b.statut <> 'en_cours' then return; end if;
  select count(*) filter (where resultat = 'en_attente'), count(*) filter (where resultat = 'perdu'), coalesce(exp(sum(ln(cote)) filter (where resultat = 'gagne')), 1)
    into n_pending, n_lost, v_cote from betwise.bet_selections where bet_id = b.id;
  if n_lost > 1 or (n_lost = 1 and not b.assurance) then v_result := 'perdu'; v_gain := -b.mise;
  elsif n_pending > 0 then return;
  elsif n_lost = 1 then v_result := 'rembourse'; v_gain := 0;   -- combiné assuré : une seule sélection perdue
  else
    if v_cote = 1 then v_result := 'rembourse'; v_gain := 0;
    else v_result := 'gagne'; v_gain := round(b.mise * betwise.cote_payee(v_cote, b.bookmaker), 2) - b.mise; end if;
  end if;

  -- Pari réel : on propose, on n'écrit rien dans la bankroll. C'est l'utilisateur qui confirme, ticket du bookmaker en main.
  if not b.virtuel then
    v_prop := v_result::text::betwise.settle_result;
    if b.resultat_propose is distinct from v_prop or b.gain_propose is distinct from v_gain then
      update betwise.bets set resultat_propose = v_prop, gain_propose = v_gain, propose_at = now() where id = b.id;
      if betwise.notif_wanted(b.user_id, 'resultat') then
        insert into betwise.notifications (user_id, type, cle, titre, corps, url)
        values (b.user_id, 'resultat', 'prop:' || b.id || ':' || v_prop, '🔎 Résultat à confirmer',
                case when coalesce(b.nb_selections, 1) > 1 then 'Combiné de ' || b.nb_selections || ' sélections' else 'Simple' end || ' · cote ' || replace(round(b.cote_totale, 2)::text, '.', ',')
                  || ' — BETWISE propose : ' || case v_prop when 'gagne' then 'gagné' when 'perdu' then 'perdu' else 'remboursé' end,
                '/paris/' || b.id)
        on conflict do nothing;
      end if;
    end if;
    return;
  end if;

  update betwise.bets set statut = v_result, gain_net = v_gain, settled_at = now(), cote_totale = case when v_result='gagne' then round(v_cote,3) else cote_totale end where id = b.id;
end $function$;

-- Confirmation (ou règlement à la main) par l'utilisateur. Le gain proposé est repris quand le résultat confirmé est celui proposé
-- (il tient compte des sélections remboursées) ; les résultats ligne par ligne déjà établis ne sont pas écrasés.
create or replace function betwise.settle_bet(p_bet_id uuid, p_result betwise.settle_result) returns betwise.bets language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare uid uuid := auth.uid(); b betwise.bets; v_gain numeric;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into b from betwise.bets where id = p_bet_id and user_id = uid for update;
  if b.id is null then raise exception 'pari introuvable'; end if;
  if b.statut <> 'en_cours' then raise exception 'pari déjà réglé'; end if;
  if p_result not in ('gagne','perdu','rembourse') then raise exception 'résultat invalide'; end if;
  v_gain := case
    when p_result = b.resultat_propose and b.gain_propose is not null then b.gain_propose
    when p_result = 'gagne' then round(b.mise * betwise.cote_payee(b.cote_totale, b.bookmaker), 2) - b.mise
    when p_result = 'perdu' then -b.mise else 0 end;
  insert into betwise.bet_versions (bet_id, changes, changed_by)
  values (b.id, jsonb_build_object('statut', jsonb_build_object('avant', b.statut, 'apres', p_result, 'propose', b.resultat_propose)), uid);
  update betwise.bets set statut = p_result::text::betwise.bet_status, gain_net = v_gain, settled_at = now() where id = b.id returning * into b;
  update betwise.bet_selections set resultat = p_result, settled_at = now() where bet_id = b.id and resultat = 'en_attente';
  if not b.virtuel then
    if p_result = 'gagne' then
      insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'gain', b.mise + v_gain, b.id, 'Gain');
    elsif p_result = 'rembourse' then
      insert into betwise.bankroll_transactions (bankroll_id, type, montant, bet_id, note) values (b.bankroll_id, 'ajustement', b.mise, b.id, 'Remboursement');
    end if;
  end if;
  return b;
end $function$;

-- Écritures directes fermées : ces tables ne s'écrivent que par les fonctions (ou par la clé de service des tâches planifiées).
revoke insert, update, delete, truncate on
  betwise.bets, betwise.bet_selections, betwise.bet_versions, betwise.bankrolls, betwise.bankroll_transactions,
  betwise.predictions, betwise.prediction_versions, betwise.odds_observations, betwise.notifications,
  betwise.source_metrics, betwise.source_metrics_by_axis, betwise.matches, betwise.teams, betwise.competitions, betwise.standings,
  betwise.markets, betwise.daily_picks, betwise.model_estimates, betwise.match_extras, betwise.match_history, betwise.af_history,
  betwise.tts_usage, betwise.app_secrets
from authenticated, anon;

revoke execute on function betwise.place_bet(numeric, jsonb, betwise.import_channel, text, uuid, timestamptz) from public, anon, authenticated;
