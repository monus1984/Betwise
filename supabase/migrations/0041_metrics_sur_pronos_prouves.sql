-- 0041 — Appliquée le 2026-11-16.
-- compute_source_metrics() et source_cumulative() ne portent plus que sur les pronos prouvés :
-- dans les deux fonctions, « pr.statut <> 'annule' » devient « pr.statut = 'verifie' » (20 occurrences).
do $$
declare r record; v_def text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'betwise' and p.proname in ('compute_source_metrics', 'source_cumulative') loop
    v_def := pg_get_functiondef(r.oid);
    if position('pr.statut <> ''annule''' in v_def) = 0 then continue; end if;   -- déjà appliquée
    execute replace(v_def, 'pr.statut <> ''annule''', 'pr.statut = ''verifie''');
  end loop;
end $$;
