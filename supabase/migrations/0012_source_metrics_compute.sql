-- 0012 : calcul nocturne des indicateurs de source (rendement, IC bootstrap, pire série, détail par axe)
-- Appliquée via MCP le 2026-11-10 ; corrigée par 0014 (types de bootstrap_ci).

CREATE OR REPLACE FUNCTION betwise.max_drawdown(p_gains numeric[])
 RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $function$
declare cum numeric := 0; peak numeric := 0; dd numeric := 0; g numeric;
begin
  if p_gains is null then return null; end if;
  foreach g in array p_gains loop
    cum := cum + g; if cum > peak then peak := cum; end if; if peak - cum > dd then dd := peak - cum; end if;
  end loop;
  return round(dd, 2);
end $function$;

-- bootstrap_ci : version finale dans 0014.

CREATE OR REPLACE FUNCTION betwise.compute_source_metrics()
 RETURNS TABLE(sources_calculees integer) LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'betwise', 'public' AS $function$
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

      insert into betwise.source_metrics_by_axis (source_id, periode, axe, valeur, nb_declares, nb_gagnes, rendement, computed_at)
      select r.id, p.periode, 'risque', coalesce(pr.risque_annonce, pr.risque_calcule)::text,
             count(*) filter (where pr.statut <> 'annule'), count(*) filter (where pr.statut <> 'annule' and pr.resultat = 'gagne'),
             round(avg(case pr.resultat when 'gagne' then pr.cote_annoncee - 1 when 'perdu' then -1 end) filter (where pr.statut <> 'annule' and pr.cote_annoncee is not null), 4), now()
      from betwise.predictions pr where pr.source_id = r.id and coalesce(pr.risque_annonce, pr.risque_calcule) is not null
        and (p.iv is null or coalesce(pr.published_at, pr.logged_at) >= now() - p.iv)
      group by coalesce(pr.risque_annonce, pr.risque_calcule);
    end loop;
  end loop;
  return query select n;
end $function$;

CREATE OR REPLACE FUNCTION betwise.source_cumulative(p_source_id uuid, p_since timestamptz DEFAULT NULL)
 RETURNS TABLE(at timestamptz, gain numeric, cumul numeric, resultat betwise.settle_result, libelle text)
 LANGUAGE sql STABLE SET search_path TO 'betwise', 'public' AS $function$
  select t.at, t.gain, sum(t.gain) over (order by t.at, t.id) as cumul, t.resultat, t.libelle
  from (
    select coalesce(pr.published_at, pr.logged_at) as at, pr.id,
           case pr.resultat when 'gagne' then pr.cote_annoncee - 1 when 'perdu' then -1 else 0 end as gain,
           pr.resultat,
           coalesce(h.nom || ' – ' || a.nom, pr.match_libre) || ' · ' || pr.market_code || ' ' || pr.selection as libelle
    from betwise.predictions pr
    left join betwise.matches m on m.id = pr.match_id left join betwise.teams h on h.id = m.home_team_id left join betwise.teams a on a.id = m.away_team_id
    where pr.source_id = p_source_id and pr.statut <> 'annule' and pr.resultat in ('gagne','perdu','rembourse') and pr.cote_annoncee is not null
      and (p_since is null or coalesce(pr.published_at, pr.logged_at) >= p_since)
  ) t order by t.at, t.id
$function$;

revoke all on function betwise.compute_source_metrics() from public, anon, authenticated;
grant execute on function betwise.compute_source_metrics() to service_role;
grant execute on function betwise.source_cumulative(uuid, timestamptz) to authenticated;
