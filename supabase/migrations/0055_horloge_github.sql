-- Horloge : Supabase lance les automatisations GitHub à l'heure (les horaires GitHub partent avec des heures de retard).
-- Le jeton est lu dans le coffre (secret github_dispatch_token) et n'est jamais écrit ailleurs.
-- Réversible : cron.unschedule des jobs betwise-horloge-* puis drop function betwise.declencher_workflow.

create or replace function betwise.declencher_workflow(fichier text, entrees jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  jeton text;
  requete bigint;
begin
  if fichier !~ '^[a-z0-9-]+\.yml$' then
    raise exception 'fichier de workflow invalide : %', fichier;
  end if;
  select decrypted_secret into jeton from vault.decrypted_secrets where name = 'github_dispatch_token';
  if jeton is null then
    raise exception 'secret github_dispatch_token absent';
  end if;
  select net.http_post(
    url := 'https://api.github.com/repos/monus1984/Betwise/actions/workflows/' || fichier || '/dispatches',
    body := jsonb_build_object('ref', 'main', 'inputs', coalesce(entrees, '{}'::jsonb)),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || jeton,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'betwise-horloge',
      'Content-Type', 'application/json'
    )
  ) into requete;
  return requete;
end;
$$;

revoke all on function betwise.declencher_workflow(text, jsonb) from public, anon, authenticated;

select cron.schedule('betwise-horloge-matchs',   '0 6 * * *',  $$select betwise.declencher_workflow('import-matches.yml')$$);
select cron.schedule('betwise-horloge-cotes-ref', '0 7 * * *',  $$select betwise.declencher_workflow('import-odds.yml')$$);
select cron.schedule('betwise-horloge-cotes-1x',  '10 7 * * *', $$select betwise.declencher_workflow('import-api-football.yml')$$);
select cron.schedule('betwise-horloge-modele',    '30 7 * * *', $$select betwise.declencher_workflow('run-model.yml')$$);
select cron.schedule('betwise-horloge-tipster',   '50 7,13,17 * * *', $$select betwise.declencher_workflow('tipster-virtuel.yml')$$);
