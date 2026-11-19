-- 0048 — Cotes par bookmaker : le dernier relevé connu de chaque sélection, avec l'heure du relevé chez le fournisseur.
-- Une ligne par (match, bookmaker, marché, ligne, sélection). Le relevé d'un match est remplacé en bloc à chaque passage,
-- tant que le match n'a pas commencé : après le coup d'envoi, il reste le dernier relevé d'avant-match.
-- Ce sont des cotes publiques, sans donnée d'utilisateur : lecture ouverte aux comptes connectés, écriture réservée au service.
create table if not exists betwise.bookmaker_odds (
  match_id uuid not null references betwise.matches(id) on delete cascade,
  bookmaker text not null,
  market_code text not null references betwise.markets(code),
  market_param numeric,
  selection text not null,
  cote numeric(8,3) not null check (cote > 1),
  releve_at timestamptz not null,
  source text not null,
  imported_at timestamptz not null default now()
);
create unique index if not exists bookmaker_odds_cle on betwise.bookmaker_odds (match_id, bookmaker, market_code, coalesce(market_param, -1000), selection);
alter table betwise.bookmaker_odds enable row level security;
create policy bookmaker_odds_lecture on betwise.bookmaker_odds for select to authenticated using (true);
revoke all on betwise.bookmaker_odds from anon, authenticated;
grant select on betwise.bookmaker_odds to authenticated;

-- p_matches : [{ "match_id": uuid, "releve_at": horodatage, "rows": [{ "m": marché, "p": ligne ou null, "s": sélection, "c": cote }] }]
create or replace function betwise.replace_bookmaker_odds(p_bookmaker text, p_source text, p_matches jsonb)
returns integer language plpgsql security definer set search_path = betwise, public as $$
declare
  m jsonb; v_match uuid; v_releve timestamptz; v_n integer; v_total integer := 0;
begin
  if coalesce(trim(p_bookmaker), '') = '' then raise exception 'bookmaker manquant'; end if;
  for m in select * from jsonb_array_elements(coalesce(p_matches, '[]'::jsonb)) loop
    v_match := (m->>'match_id')::uuid;
    v_releve := (m->>'releve_at')::timestamptz;
    -- on ne remplace jamais un relevé par un plus ancien, ni celui d'un match déjà commencé
    if exists (select 1 from betwise.bookmaker_odds o where o.match_id = v_match and o.bookmaker = p_bookmaker and o.releve_at > v_releve) then continue; end if;
    if not exists (select 1 from betwise.matches x where x.id = v_match and x.statut = 'programme' and x.kickoff_at > now()) then continue; end if;
    delete from betwise.bookmaker_odds o where o.match_id = v_match and o.bookmaker = p_bookmaker;
    insert into betwise.bookmaker_odds (match_id, bookmaker, market_code, market_param, selection, cote, releve_at, source)
    select distinct on (r->>'m', coalesce((r->>'p')::numeric, -1000), r->>'s')
      v_match, p_bookmaker, r->>'m', (r->>'p')::numeric, r->>'s', (r->>'c')::numeric, v_releve, p_source
    from jsonb_array_elements(coalesce(m->'rows', '[]'::jsonb)) r
    where (r->>'c')::numeric > 1 and exists (select 1 from betwise.markets k where k.code = r->>'m');
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end loop;
  return v_total;
end $$;
revoke all on function betwise.replace_bookmaker_odds(text, text, jsonb) from public, anon, authenticated;
grant execute on function betwise.replace_bookmaker_odds(text, text, jsonb) to service_role;
