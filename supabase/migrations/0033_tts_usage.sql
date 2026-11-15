-- 0033 : compteur d'usage de la voix (synthèse vocale payante) — une ligne par compte et par jour.
-- tts_take(p_max) incrémente le compteur du jour et dit si la limite est respectée.

create table if not exists betwise.tts_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  jour date not null default (now() at time zone 'utc')::date,
  n integer not null default 0,
  primary key (user_id, jour)
);
alter table betwise.tts_usage enable row level security;
create policy tts_usage_own_read on betwise.tts_usage for select to authenticated using (user_id = auth.uid());

create or replace function betwise.tts_take(p_max integer)
 returns boolean language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare uid uuid := auth.uid(); v integer;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  insert into betwise.tts_usage (user_id, jour, n) values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, jour) do update set n = betwise.tts_usage.n + 1
  returning n into v;
  return v <= greatest(p_max, 0);
end $function$;

revoke execute on function betwise.tts_take(integer) from public, anon;
grant execute on function betwise.tts_take(integer) to authenticated, service_role;
grant select on betwise.tts_usage to authenticated;
grant all on betwise.tts_usage to service_role;
