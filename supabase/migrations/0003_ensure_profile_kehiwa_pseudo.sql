-- Le pseudo BETWISE reprend par défaut le display_name Kehiwa (public.profiles) s'il existe,
-- puis la partie locale de l'e-mail, puis « joueur ».
create or replace function betwise.ensure_profile(p_pseudo text default null)
returns betwise.profiles language plpgsql security definer set search_path = betwise, public as $$
declare uid uuid := auth.uid(); p betwise.profiles; v_pseudo text;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  v_pseudo := coalesce(
    nullif(p_pseudo, ''),
    (select nullif(display_name, '') from public.profiles where id = uid),
    (select nullif(split_part(coalesce(email,''),'@',1), '') from auth.users where id = uid),
    'joueur');
  insert into betwise.profiles (user_id, pseudo) values (uid, v_pseudo)
  on conflict (user_id) do nothing;
  insert into betwise.sources (type, nom, visibilite, created_by)
  select 'perso','Moi','privee', uid
  where not exists (select 1 from betwise.sources where created_by = uid and type = 'perso');
  insert into betwise.bankrolls (user_id)
  select uid where not exists (select 1 from betwise.bankrolls where user_id = uid and active);
  select * into p from betwise.profiles where user_id = uid;
  return p;
end $$;
