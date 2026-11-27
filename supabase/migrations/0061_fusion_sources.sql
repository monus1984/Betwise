-- 0061 (27/11) : suppression d'une source réparée ; fusion de deux sources (même tipster sous deux noms).
-- delete_source : les lignes de paris qui citaient la source passent à « Moi » (origin_source_id est obligatoire ;
-- la version 0059 tentait de le mettre à null et échouait).
-- merge_sources : déplace pronos, lignes de paris et abonnements de p_from vers p_into, puis supprime p_from.
-- Réversible : recréer delete_source de 0059 et supprimer merge_sources (une fusion faite ne se défait pas).

create or replace function betwise.delete_source(p_id uuid) returns integer
language plpgsql security definer set search_path = betwise, public as $$
declare uid uuid := auth.uid(); s betwise.sources; n int;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  select * into s from betwise.sources where id = p_id and created_by = uid for update;
  if s.id is null then raise exception 'source introuvable ou créée par quelqu''un d''autre'; end if;
  if s.type in ('perso', 'modele_betwise') then raise exception 'cette source ne se supprime pas'; end if;
  if exists (select 1 from betwise.source_follows f where f.source_id = s.id and f.user_id <> uid)
     or exists (select 1 from betwise.predictions p where p.source_id = s.id and p.submitted_by is distinct from uid) then
    raise exception 'd''autres utilisateurs la suivent ou y ont chargé des pronos : elle ne peut pas être supprimée';
  end if;
  update betwise.bet_selections bs set origin_source_id = (
    select ps.id from betwise.bets b join betwise.sources ps on ps.created_by = b.user_id and ps.type = 'perso' where b.id = bs.bet_id limit 1)
  where bs.origin_source_id = s.id;
  if exists (select 1 from betwise.bet_selections where origin_source_id = s.id) then raise exception 'source « Moi » introuvable pour un de tes paris'; end if;
  update betwise.bet_selections set prediction_id = null where prediction_id in (select id from betwise.predictions where source_id = s.id);
  update betwise.model_estimates set prediction_id = null where prediction_id in (select id from betwise.predictions where source_id = s.id);
  delete from betwise.predictions where source_id = s.id;
  get diagnostics n = row_count;
  delete from betwise.sources where id = s.id;
  return n;
end $$;

create or replace function betwise.merge_sources(p_from uuid, p_into uuid) returns integer
language plpgsql security definer set search_path = betwise, public as $$
declare uid uuid := auth.uid(); a betwise.sources; b betwise.sources; p record; k text; dup uuid; n int := 0;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  if p_from = p_into then raise exception 'choisis une autre source'; end if;
  select * into a from betwise.sources where id = p_from and created_by = uid for update;
  select * into b from betwise.sources where id = p_into and (created_by = uid or visibilite = 'partagee') for update;
  if a.id is null or b.id is null then raise exception 'source introuvable'; end if;
  if a.type in ('perso', 'modele_betwise') or b.type in ('perso', 'modele_betwise') then raise exception 'cette source ne se fusionne pas'; end if;
  if exists (select 1 from betwise.source_follows f where f.source_id = a.id and f.user_id <> uid)
     or exists (select 1 from betwise.predictions x where x.source_id = a.id and x.submitted_by is distinct from uid) then
    raise exception 'd''autres utilisateurs suivent cette source ou y ont chargé des pronos';
  end if;
  for p in select * from betwise.predictions where source_id = a.id loop
    k := b.id::text || substr(p.dedupe_key, length(a.id::text) + 1);
    dup := null;
    select id into dup from betwise.predictions where dedupe_key = k;
    if dup is not null then
      -- Le même prono existe déjà chez l'autre : on garde celui-là
      update betwise.bet_selections set prediction_id = dup where prediction_id = p.id;
      update betwise.model_estimates set prediction_id = dup where prediction_id = p.id;
      delete from betwise.predictions where id = p.id;
    else
      update betwise.predictions set source_id = b.id, dedupe_key = k where id = p.id;
      n := n + 1;
    end if;
  end loop;
  update betwise.bet_selections set origin_source_id = b.id where origin_source_id = a.id;
  insert into betwise.source_follows (user_id, source_id) select user_id, b.id from betwise.source_follows where source_id = a.id on conflict do nothing;
  delete from betwise.sources where id = a.id;
  return n;
end $$;

revoke all on function betwise.merge_sources(uuid, uuid) from public, anon;
grant execute on function betwise.merge_sources(uuid, uuid) to authenticated;
