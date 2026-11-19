-- Contrôle de cohérence des paris et des pronos. À rejouer après tout changement qui touche l'import ou le règlement.
-- Chaque ligne doit valoir 0. Première exécution le 2026-11-16 : 202 sélections, 114 pronos, 78 paris, tout à 0.
-- Contrôles I et J ajoutés le 2026-11-18 (import fiable).
-- Contrôles K et L ajoutés le 2026-11-19 (cotes par bookmaker).
with sel as (
  select s.resultat res, s.selection, m.statut ms,
    case when m.id is not null and m.statut = 'termine' then betwise.settle_sel(s.market_code, s.market_param, s.selection, m) end calc
  from betwise.bet_selections s join betwise.bets b on b.id = s.bet_id left join betwise.matches m on m.id = s.match_id where b.statut <> 'annule'),
pr as (
  select p.resultat res, p.selection, m.statut ms,
    case when m.id is not null and m.statut = 'termine' then betwise.settle_sel(p.market_code, p.market_param, p.selection, m) end calc
  from betwise.predictions p left join betwise.matches m on m.id = p.match_id where p.statut <> 'annule'),
bt as (
  select b.*, (select coalesce(sum(montant), 0) from betwise.bankroll_transactions t where t.bet_id = b.id) tx,
    (select count(*) filter (where resultat = 'perdu') from betwise.bet_selections s where s.bet_id = b.id) nl,
    (select count(*) filter (where resultat = 'en_attente') from betwise.bet_selections s where s.bet_id = b.id) np,
    (select count(*) from betwise.bet_selections s where s.bet_id = b.id) ns
  from betwise.bets b where b.statut <> 'annule')
select * from (values
  ('A  sélection dont le résultat contredit le score',            (select count(*) from sel where calc is not null and calc <> 'en_attente' and calc <> res)),
  ('B  sélection réglée alors que le match n''est pas joué',       (select count(*) from sel where ms in ('programme', 'en_cours') and res <> 'en_attente')),
  ('C1 pari gagné avec une sélection perdue',                     (select count(*) from bt where statut = 'gagne' and nl > 0 and cashout is null)),
  ('C2 pari perdu sans aucune sélection perdue',                  (select count(*) from bt where statut = 'perdu' and ns > 0 and nl = 0 and cashout is null)),
  ('C3 pari en cours dont tout est réglé, sans proposition',      (select count(*) from bt where statut = 'en_cours' and ns > 0 and np = 0 and resultat_propose is null)),
  ('D  gain du pari différent de la somme de ses mouvements',     (select count(*) from bt where not virtuel and statut in ('gagne', 'perdu', 'rembourse') and round(coalesce(gain_net, 0), 2) <> round(tx, 2))),
  ('D2 pari test avec un mouvement de bankroll',                  (select count(*) from bt where virtuel and tx <> 0)),
  ('E  prono dont le résultat contredit le score',                (select count(*) from pr where calc is not null and calc <> 'en_attente' and calc <> res)),
  ('E2 prono réglé alors que le match n''est pas joué',            (select count(*) from pr where ms in ('programme', 'en_cours') and res <> 'en_attente')),
  ('F  sélection ou prono sans choix',                            (select count(*) from sel where coalesce(trim(selection), '') = '') + (select count(*) from pr where coalesce(trim(selection), '') = '')),
  ('G  tir ou tir cadré compté comme total du match',             (select count(*) from betwise.bet_selections s join betwise.bets b on b.id = s.bet_id where b.statut <> 'annule' and s.market_code in ('SOT', 'SHOT') and s.market_param <= 3.5 and s.cote >= 1.5)),
  ('I  « tirs au but : non » à une cote de penalty (pari sur un penalty rangé sous le mauvais marché)', (select count(*) from betwise.bet_selections s join betwise.bets b on b.id = s.bet_id where b.statut <> 'annule' and s.market_code = 'PEN' and upper(s.selection) = 'NON' and s.cote >= 1.5)),
  ('J  pari gardé tel quel (LIBRE) réglé sans geste de l''utilisateur', (select count(*) from betwise.bet_selections s join betwise.bets b on b.id = s.bet_id
                                                                     where b.statut <> 'annule' and s.market_code = 'LIBRE' and s.resultat <> 'en_attente' and s.settled_at > b.created_at + interval '1 minute'
                                                                       and not exists (select 1 from betwise.bet_versions v where v.bet_id = b.id and (v.selection_id = s.id or v.selection_id is null)))),
  ('H  solde différent de la somme des comptes',                  (select count(*) from betwise.bankrolls k where k.active and round(k.capital_initial + coalesce((select sum(montant) from betwise.bankroll_transactions t where t.bankroll_id = k.id), 0), 2)
                                                                     <> round(k.capital_initial + coalesce((select sum(j.montant) from betwise.my_bankroll_journal j where j.bankroll_id = k.id), 0), 2))),
  ('K  relevé de bookmaker daté après le coup d''envoi',           (select count(distinct o.match_id) from betwise.bookmaker_odds o join betwise.matches m on m.id = o.match_id where o.releve_at > m.kickoff_at)),
  ('L  relevé de bookmaker incohérent (1N2 ou plus/moins 2,5 dont les cotes ne laissent aucune marge)',
                                                                   (select count(*) from (select o.match_id, o.bookmaker,
                                                                       sum(1 / o.cote) filter (where o.market_code = '1X2') a, count(*) filter (where o.market_code = '1X2') na,
                                                                       sum(1 / o.cote) filter (where o.market_code = 'OU' and o.market_param = 2.5) b, count(*) filter (where o.market_code = 'OU' and o.market_param = 2.5) nb
                                                                     from betwise.bookmaker_odds o group by 1, 2) x where (na = 3 and a < 1) or (nb = 2 and b < 1)))
) as t(controle, anomalies);
