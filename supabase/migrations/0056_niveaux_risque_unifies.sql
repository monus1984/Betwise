-- Niveaux de risque : un seul découpage, celui des profils fixés le 21/11 sur la cote affichée.
--   prudent (affiché « Prudent ») : 1,10 à 1,29 ; moyen (« Équilibré ») : 1,30 à 1,54 ; risque (« Audacieux ») : 1,55 et plus.
--   Sous 1,10 : pas de niveau (null). Les valeurs de l'énumération ne changent pas, seuls les mots affichés changent.
-- 1. risk_from_odds suit ces bornes (avant : < 1,50 / 1,50 à 2,20 / > 2,20).
-- 2. risque_calcule est recalculé sur les pronos et les sélections existants (toujours égal à risk_from_odds de la cote).
-- 3. Les statistiques par niveau des sources se calculent sur risque_calcule (même règle pour tout le monde),
--    plus sur le niveau annoncé par le tipster ; risque_annonce reste enregistré tel quel.
-- Réversible : réappliquer risk_from_odds de 0001 et compute_source_metrics de 0012, puis relancer le recalcul du point 2
-- (risque_calcule ne dépend que de la cote) et select betwise.compute_source_metrics().

create or replace function betwise.risk_from_odds(c numeric)
returns betwise.risk_category
language sql
immutable
set search_path to 'betwise', 'public'
as $$
  select case when c is null or c < 1.10 then null
              when c < 1.30 then 'prudent'::betwise.risk_category
              when c < 1.55 then 'moyen'::betwise.risk_category
              else 'risque'::betwise.risk_category end
$$;

update betwise.predictions set risque_calcule = betwise.risk_from_odds(cote_annoncee)
 where risque_calcule is distinct from betwise.risk_from_odds(cote_annoncee);
update betwise.bet_selections set risque_calcule = betwise.risk_from_odds(cote)
 where risque_calcule is distinct from betwise.risk_from_odds(cote);

CREATE OR REPLACE FUNCTION betwise.compute_source_metrics()
 RETURNS TABLE(sources_calculees integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'betwise', 'public'
AS $function$
declare r record; p record; g numeric[]; ci record; n int := 0;
begin
  delete from betwise.source_metrics; delete from betwise.source_metrics_by_axis;

  for r in select id from betwise.sources loop
    n := n + 1;
    for p in select * from (values ('30j', interval '30 days'), ('90j', interval '90 days'), ('180j', interval '180 days'), ('total', null::interval)) v(periode, iv) loop
      -- gains unitaires chronologiques (pronos vérifiés ou déclarés, hors annulés, réglés, avec cote)
      select coalesce(array_agg(case pr.resultat when 'gagne' then pr.cote_annoncee - 1 when 'perdu' then -1 else 0 end order by coalesce(pr.published_at, pr.logged_at)), '{}')
        into g
      from betwise.predictions pr
      where pr.source_id = r.id and pr.statut <> 'annule' and pr.resultat in ('gagne','perdu','rembourse') and pr.cote_annoncee is not null
        and (p.iv is null or coalesce(pr.published_at, pr.logged_at) >= now() - p.iv);
      select * into ci from betwise.bootstrap_ci(g);

      insert into betwise.source_metrics (source_id, periode, nb_declares, nb_verifies, nb_gagnes, nb_regles, taux_reussite, rendement, ic_bas, ic_haut, pire_serie, statut_eval, computed_at)
      select r.id, p.periode,
             count(*) filter (where pr.statut <> 'annule'),
             count(*) filter (where pr.statut = 'verifie'),
             count(*) filter (where pr.statut <> 'annule' and pr.resultat = 'gagne'),
             count(*) filter (where pr.statut <> 'annule' and pr.resultat in ('gagne','perdu')),
             case when count(*) filter (where pr.statut <> 'annule' and pr.resultat in ('gagne','perdu')) > 0
                  then round(count(*) filter (where pr.statut <> 'annule' and pr.resultat = 'gagne')::numeric / count(*) filter (where pr.statut <> 'annule' and pr.resultat in ('gagne','perdu')), 4) end,
             case when coalesce(array_length(g,1),0) > 0 then round((select avg(x) from unnest(g) x), 4) end,
             ci.ic_bas, ci.ic_haut, betwise.max_drawdown(g),
             case when count(*) filter (where pr.statut <> 'annule') >= 100 then 'evalue' when count(*) filter (where pr.statut <> 'annule') >= 30 then 'provisoire' else 'tendance' end::betwise.eval_status,
             now()
      from betwise.predictions pr
      where pr.source_id = r.id and (p.iv is null or coalesce(pr.published_at, pr.logged_at) >= now() - p.iv);

      -- Détail par axe
      insert into betwise.source_metrics_by_axis (source_id, periode, axe, valeur, nb_declares, nb_gagnes, rendement, computed_at)
      select r.id, p.periode, 'marche', pr.market_code,
             count(*) filter (where pr.statut <> 'annule'), count(*) filter (where pr.statut <> 'annule' and pr.resultat = 'gagne'),
             round(avg(case pr.resultat when 'gagne' then pr.cote_annoncee - 1 when 'perdu' then -1 end) filter (where pr.statut <> 'annule' and pr.cote_annoncee is not null), 4), now()
      from betwise.predictions pr where pr.source_id = r.id and (p.iv is null or coalesce(pr.published_at, pr.logged_at) >= now() - p.iv)
      group by pr.market_code;

      insert into betwise.source_metrics_by_axis (source_id, periode, axe, valeur, nb_declares, nb_gagnes, rendement, computed_at)
      select r.id, p.periode, 'competition', coalesce(c.code_externe, 'autre'),
             count(*) filter (where pr.statut <> 'annule'), count(*) filter (where pr.statut <> 'annule' and pr.resultat = 'gagne'),
             round(avg(case pr.resultat when 'gagne' then pr.cote_annoncee - 1 when 'perdu' then -1 end) filter (where pr.statut <> 'annule' and pr.cote_annoncee is not null), 4), now()
      from betwise.predictions pr left join betwise.matches m on m.id = pr.match_id left join betwise.competitions c on c.id = m.competition_id
      where pr.source_id = r.id and (p.iv is null or coalesce(pr.published_at, pr.logged_at) >= now() - p.iv)
      group by coalesce(c.code_externe, 'autre');

      -- niveau calculé sur la cote (22/11), plus le niveau annoncé
      insert into betwise.source_metrics_by_axis (source_id, periode, axe, valeur, nb_declares, nb_gagnes, rendement, computed_at)
      select r.id, p.periode, 'risque', pr.risque_calcule::text,
             count(*) filter (where pr.statut <> 'annule'), count(*) filter (where pr.statut <> 'annule' and pr.resultat = 'gagne'),
             round(avg(case pr.resultat when 'gagne' then pr.cote_annoncee - 1 when 'perdu' then -1 end) filter (where pr.statut <> 'annule' and pr.cote_annoncee is not null), 4), now()
      from betwise.predictions pr where pr.source_id = r.id and pr.risque_calcule is not null
        and (p.iv is null or coalesce(pr.published_at, pr.logged_at) >= now() - p.iv)
      group by pr.risque_calcule;
    end loop;
  end loop;
  return query select n;
end $function$;

select betwise.compute_source_metrics();
