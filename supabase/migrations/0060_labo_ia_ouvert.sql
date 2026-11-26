-- 0060 (26/11) : Labo IA ouvert en lecture à tous les comptes ; règlement de « gagne sans encaisser — non ».
-- Réversible : drop policy sources_read_ia / predictions_read_ia, drop function est_source_ia,
-- et retirer la ligne « |NON » du bloc WTN de settle_selection.

-- Une source IA : nommée « … · tipster IA » et créée par un administrateur (un compte ordinaire ne peut pas en fabriquer une)
create or replace function betwise.est_source_ia(p_source_id uuid) returns boolean
language sql stable security definer set search_path = betwise, public as $$
  select exists (select 1 from betwise.sources s join betwise.profiles p on p.user_id = s.created_by
                 where s.id = p_source_id and s.type = 'tipster' and s.nom like '% · tipster IA' and p.role = 'admin');
$$;
revoke all on function betwise.est_source_ia(uuid) from public, anon;
grant execute on function betwise.est_source_ia(uuid) to authenticated;

-- Lecture seule : l'écriture reste réservée au créateur (policies existantes inchangées)
create policy sources_read_ia on betwise.sources for select to authenticated using (betwise.est_source_ia(id));
create policy predictions_read_ia on betwise.predictions for select to authenticated using (betwise.est_source_ia(source_id));

-- « Home Win to Nil — No » : sélection « 1|Non » / « 2|Non », gagnée sauf si l'équipe gagne sans encaisser
do $$
declare d text;
begin
  d := pg_get_functiondef('betwise.settle_selection(text,numeric,text,integer,integer,integer,integer)'::regprocedure);
  d := replace(d, $r$  if p_market = 'WTN' then
    if sel = '1' then$r$, $r$  if p_market = 'WTN' then
    if sel in ('1|NON', '2|NON') then return case when (split_part(sel, '|', 1) = '1' and diff > 0 and p_away = 0) or (split_part(sel, '|', 1) = '2' and diff < 0 and p_home = 0) then 'perdu' else 'gagne' end; end if;
    if sel = '1' then$r$);
  if position('1|NON' in d) = 0 then raise exception 'bloc WTN introuvable : settle_selection inchangée'; end if;
  execute d;
end $$;
