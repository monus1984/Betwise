-- 0052 — Rattacher un pari à une montante (19/11). Les utilisateurs n'ont pas le droit de modifier bets directement :
-- cette fonction le fait pour eux, après contrôle (montante et pari au même propriétaire, montante en cours,
-- pari non annulé et pas déjà rattaché, paliers prévus non dépassés). Le numéro du palier est attribué ici.
create or replace function betwise.montante_rattacher(p_montante_id uuid, p_bet_id uuid)
returns smallint language plpgsql security definer set search_path = betwise, pg_temp as $$
declare v_user uuid := auth.uid(); v_pal smallint; v_max smallint;
begin
  if v_user is null then raise exception 'Session expirée.'; end if;
  select paliers_prevus into v_max from betwise.montantes where id = p_montante_id and user_id = v_user and statut = 'en_cours' for update;
  if v_max is null then raise exception 'Montante introuvable ou terminée.'; end if;
  if not exists (select 1 from betwise.bets where id = p_bet_id and user_id = v_user and montante_id is null and statut <> 'annule') then
    raise exception 'Pari introuvable, annulé ou déjà rattaché.';
  end if;
  if exists (select 1 from betwise.bets where montante_id = p_montante_id and statut = 'en_cours') then
    raise exception 'Le palier précédent n''est pas encore réglé.';
  end if;
  select coalesce(max(palier), 0) + 1 into v_pal from betwise.bets where montante_id = p_montante_id and statut <> 'annule';
  if v_pal > v_max then raise exception 'Tous les paliers prévus sont joués.'; end if;
  update betwise.bets set montante_id = p_montante_id, palier = v_pal where id = p_bet_id;
  update betwise.montantes set updated_at = now() where id = p_montante_id;
  return v_pal;
end $$;
revoke execute on function betwise.montante_rattacher(uuid, uuid) from public, anon;
grant execute on function betwise.montante_rattacher(uuid, uuid) to authenticated;
