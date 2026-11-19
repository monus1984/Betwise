-- 0051 — Montantes (19/11, validée par Mounir à 16 h 15). Additive : une table nouvelle, deux colonnes facultatives sur bets.
-- Une montante : une mise de départ, un objectif, des paliers ; chaque palier est un pari réel dont la mise vient du palier précédent.
-- Jamais supprimée (pas de droit de suppression) : arrêtée = statut 'arretee'.
create table if not exists betwise.montantes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom text not null check (length(nom) between 1 and 80),
  mise_depart numeric not null check (mise_depart > 0),
  objectif numeric not null check (objectif > 0),
  paliers_prevus smallint not null check (paliers_prevus between 1 and 30),
  niveau text check (niveau in ('sur', 'audacieux', 'risque')),
  statut text not null default 'en_cours' check (statut in ('en_cours', 'atteinte', 'cassee', 'arretee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  termine_at timestamptz,
  constraint montantes_objectif_au_dessus check (objectif > mise_depart),
  constraint montantes_id_user unique (id, user_id)
);
create index if not exists montantes_user_idx on betwise.montantes (user_id, created_at desc);
alter table betwise.montantes enable row level security;
create policy montantes_own_select on betwise.montantes for select to authenticated using (user_id = auth.uid());
create policy montantes_own_insert on betwise.montantes for insert to authenticated with check (user_id = auth.uid());
create policy montantes_own_update on betwise.montantes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on betwise.montantes to authenticated;

-- Rattachement d'un pari à un palier ; la clé composée garantit qu'un pari ne peut entrer que dans une montante de son propriétaire.
alter table betwise.bets add column if not exists montante_id uuid;
alter table betwise.bets add column if not exists palier smallint check (palier between 1 and 30);
alter table betwise.bets add constraint bets_montante_fk foreign key (montante_id, user_id) references betwise.montantes (id, user_id);
alter table betwise.bets add constraint bets_palier_avec_montante check ((montante_id is null) = (palier is null));
create unique index if not exists bets_montante_palier_uniq on betwise.bets (montante_id, palier) where montante_id is not null and statut <> 'annule';
