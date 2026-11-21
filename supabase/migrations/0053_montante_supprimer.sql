-- 0053 — Suppression d'une montante (21/11, demandée par Mounir). Additive : une fonction nouvelle, aucune table modifiée.
-- La montante disparaît ; ses paris restent dans Mes paris et la bankroll, simplement détachés (montante_id et palier vidés).
create or replace function betwise.montante_supprimer(p_montante_id uuid)
returns void language plpgsql security definer set search_path = betwise, pg_temp as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Session expirée.'; end if;
  if not exists (select 1 from betwise.montantes where id = p_montante_id and user_id = v_user) then
    raise exception 'Montante introuvable.';
  end if;
  update betwise.bets set montante_id = null, palier = null where montante_id = p_montante_id and user_id = v_user;
  delete from betwise.montantes where id = p_montante_id and user_id = v_user;
end $$;
revoke execute on function betwise.montante_supprimer(uuid) from public, anon;
grant execute on function betwise.montante_supprimer(uuid) to authenticated;
