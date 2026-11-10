-- 0013 : planification en base (pg_cron) — recalcul nocturne des indicateurs + keepalive du projet gratuit
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('betwise-source-metrics', '0 3 * * *', $$select betwise.compute_source_metrics();$$);
select cron.schedule('betwise-keepalive', '30 5 * * *', $$select count(*) from betwise.markets;$$);
