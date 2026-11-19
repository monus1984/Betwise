-- 0050 — Statistiques d'un joueur : tirs, tirs cadrés, passes décisives.
-- Donnée : matches.details->'joueurs', relevée avec la feuille de match (même requête /fixtures?ids, aucune requête de plus) :
--   [{ n: "H. Kane", e: "1"|"2", min: 78, t: 3, c: 1, pd: 0 }, …]  (t = tirs, c = tirs cadrés, pd = passes décisives)
-- Sélection : « Plus|Harry Kane » ou « Moins|Harry Kane », la ligne dans market_param (0,5 ; 1,5…).
-- Règlement : joueur introuvable, ou deux joueurs qui répondent au nom (J. Bellingham et J. Bellingham) → en attente, réglé à la main ;
-- joueur qui n'a pas joué (0 minute) → remboursé, comme chez les bookmakers ; ligne entière atteinte pile → remboursé.

insert into betwise.markets (code, libelle_fr, a_parametre) values
  ('PSHOT', 'Joueur : nombre de tirs', true),
  ('PSOT',  'Joueur : nombre de tirs cadrés', true),
  ('PAST',  'Joueur : passes décisives', true)
on conflict (code) do nothing;

-- Le joueur de la feuille de match qui répond au nom écrit sur le ticket ; null si aucun ou plusieurs.
create or replace function betwise.joueur_de(d jsonb, nom text) returns jsonb
language plpgsql immutable set search_path = betwise, public as $$
declare c jsonb[]; t text := betwise.norm_name(nom); x jsonb;
begin
  if d is null or jsonb_typeof(d->'joueurs') <> 'array' or coalesce(t, '') = '' then return null; end if;
  select array_agg(j) into c from jsonb_array_elements(d->'joueurs') j
   where betwise.same_player(nom, j->>'n')
      or (string_to_array(t, ' ') <@ string_to_array(betwise.norm_name(j->>'n'), ' '));
  if c is null then return null; end if;
  if array_length(c, 1) > 1 and position(' ' in t) > 0 then
    -- plusieurs joueurs du même nom : l'initiale du prénom tranche
    select array_agg(y) into c from unnest(c) y where left(betwise.norm_name(y->>'n'), 1) = left(t, 1);
  end if;
  if c is null or array_length(c, 1) <> 1 then return null; end if;
  x := c[1];
  return x;
end $$;

do $do$
declare def text; anc text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'betwise' and p.proname = 'settle_sel';
  anc := $n$  if p_market in ('ET', 'PEN', 'QUALIF') then$n$;
  if position('PSHOT' in def) = 0 then
    if position(anc in def) = 0 then raise exception 'settle_sel : repère introuvable'; end if;
    def := replace(def, anc, $n$  -- Statistiques d'un joueur (0050) : « Plus|Nom » ou « Moins|Nom », ligne dans p_param
  if p_market in ('PSHOT', 'PSOT', 'PAST') then
    if p_param is null or position('|' in p_selection) = 0 then return 'en_attente'; end if;
    lm := upper(trim(split_part(p_selection, '|', 1))); ls := trim(substr(p_selection, position('|' in p_selection) + 1));
    leg := (betwise.joueur_de(d, ls))::text;
    if leg is null then return 'en_attente'; end if;
    if coalesce((leg::jsonb->>'min')::int, 0) = 0 then return 'rembourse'; end if;
    v := (leg::jsonb->>(case p_market when 'PSHOT' then 't' when 'PSOT' then 'c' else 'pd' end))::numeric;
    if v is null then return 'en_attente'; end if;
    if v = p_param then return 'rembourse'; end if;
    if lm in ('PLUS', 'OVER') then return case when v > p_param then 'gagne' else 'perdu' end; end if;
    if lm in ('MOINS', 'UNDER') then return case when v < p_param then 'gagne' else 'perdu' end; end if;
    return 'en_attente';
  end if;

$n$ || anc);
    execute def;
  end if;
end $do$;

revoke all on function betwise.joueur_de(jsonb, text) from public, anon;
grant execute on function betwise.joueur_de(jsonb, text) to authenticated, service_role;
