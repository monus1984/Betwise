-- 0019 : objectifs de bankroll (un actif par utilisateur) et coups du jour (sélections Sûr / Audacieux / Risqué)
create table if not exists betwise.objectifs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bankroll_depart numeric(14,2) not null check (bankroll_depart > 0),
  cible numeric(14,2) not null,
  debut date not null default current_date,
  echeance date not null,
  paris_par_jour smallint not null default 2 check (paris_par_jour between 1 and 10),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  check (cible > bankroll_depart), check (echeance > debut)
);
create unique index if not exists objectifs_un_actif on betwise.objectifs (user_id) where actif;
alter table betwise.objectifs enable row level security;
create policy objectifs_own on betwise.objectifs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists betwise.daily_picks (
  id uuid primary key default gen_random_uuid(),
  jour date not null,
  match_id uuid not null references betwise.matches(id) on delete cascade,
  market_code text not null, market_param numeric(5,2), selection text not null,
  categorie text not null check (categorie in ('sur','audacieux','risque')),
  rang smallint not null,
  probabilite numeric(5,4) not null, cote_ref numeric(7,3), cote_juste numeric(7,3) not null, p_modele numeric(5,4),
  prediction_id uuid references betwise.predictions(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists daily_picks_unique on betwise.daily_picks (jour, match_id, market_code, coalesce(market_param, 0), selection);
create index if not exists daily_picks_jour_idx on betwise.daily_picks (jour, categorie, rang);
alter table betwise.daily_picks enable row level security;
create policy daily_picks_read on betwise.daily_picks for select to authenticated using (true);

insert into betwise.sources (type, nom, description, visibilite)
select 'site', 'Coups du jour BETWISE', 'Sélections quotidiennes Sûr / Audacieux / Risqué tirées des cotes de référence, notées comme toute source.', 'partagee'
where not exists (select 1 from betwise.sources where nom = 'Coups du jour BETWISE' and created_by is null);
