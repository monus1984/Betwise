-- 0029 : lien de la page d'une source (Facebook, Telegram, Instagram, site), pour s'y rendre depuis sa fiche.
-- Le créateur peut le changer ; sur une source partagée encore sans lien, n'importe quel utilisateur connecté peut le renseigner.

alter table betwise.sources add column if not exists lien text;

create or replace function betwise.set_source_link(p_source_id uuid, p_lien text)
 returns text language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare uid uuid := auth.uid(); s betwise.sources; v text := nullif(trim(p_lien), '');
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into s from betwise.sources where id = p_source_id;
  if s.id is null or s.type in ('perso', 'modele_betwise') then raise exception 'source introuvable'; end if;
  if v is not null and (v !~* '^https://[a-z0-9.-]+\.[a-z]{2,}(/\S*)?$' or length(v) > 300) then raise exception 'lien invalide'; end if;
  if s.created_by = uid or (s.visibilite = 'partagee' and s.lien is null and v is not null) then
    update betwise.sources set lien = v where id = s.id;
    return v;
  end if;
  raise exception 'seul le créateur de la source peut changer ce lien';
end $function$;

revoke execute on function betwise.set_source_link(uuid, text) from public, anon;
grant execute on function betwise.set_source_link(uuid, text) to authenticated, service_role;
