-- 0043 — Appliquée le 2026-11-16.
-- Budget hebdomadaire : ce que l'utilisateur s'autorise à miser et à perdre par semaine. Remplace l'objectif de gain.
create table if not exists betwise.budgets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mise_semaine numeric not null check (mise_semaine > 0),
  perte_max_semaine numeric not null check (perte_max_semaine > 0),
  updated_at timestamptz not null default now()
);
alter table betwise.budgets enable row level security;
create policy budgets_own_select on betwise.budgets for select to authenticated using (user_id = auth.uid());
create policy budgets_own_insert on betwise.budgets for insert to authenticated with check (user_id = auth.uid());
create policy budgets_own_update on betwise.budgets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on betwise.budgets to authenticated;
