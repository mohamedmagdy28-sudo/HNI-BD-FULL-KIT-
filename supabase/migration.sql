-- HNI Pricing & Costing — cloud store schema (design: docs/designs/accounts-supabase.md, APPROVED)
-- Run ONCE in the Supabase SQL editor. Idempotent where practical.
--
-- Sharing model (v1, Mohamed + Heba, symmetric):
--   proposals      team-READABLE, owner-writable (split per-command policies)
--   pipeline_rows  journey columns team-editable; identity/money owner-only (trigger)
--   external_deals team CRUD
--   team_settings  one row, team UPDATE
--   user_settings  strictly per-user (signatures/stamps never cross accounts)
--   profiles       display names only, dashboard-seeded, team-readable
--   copies         per-user copy stamps

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null
);
alter table profiles enable row level security;
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated using (true);
-- No INSERT/UPDATE policies on purpose: rows are seeded from the dashboard.

create table if not exists proposals (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  sort_index int not null default 0,
  updated_at timestamptz not null default now()
);
alter table proposals enable row level security;
drop policy if exists proposals_select on proposals;
drop policy if exists proposals_insert on proposals;
drop policy if exists proposals_update on proposals;
drop policy if exists proposals_delete on proposals;
-- Split per-command policies: write-denial is grammar, not a condition.
create policy proposals_select on proposals for select to authenticated using (true);
create policy proposals_insert on proposals for insert to authenticated with check (owner = auth.uid());
create policy proposals_update on proposals for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy proposals_delete on proposals for delete to authenticated using (owner = auth.uid());

create table if not exists pipeline_rows (
  proposal_id uuid primary key references proposals(id) on delete cascade,
  owner uuid not null default auth.uid(),
  client text not null default '',
  title text not null default '',
  value bigint,
  gp_amount bigint,
  gp_pct numeric,
  stage text,
  probability int,
  decided_at text,
  source text,
  deal_type text,
  sector text,
  primary_service text,
  delivery_start text,
  delivery_end text,
  po_number text,
  project_status text,
  notes text,
  updated_at timestamptz not null default now()
);
alter table pipeline_rows enable row level security;
drop policy if exists pipeline_select on pipeline_rows;
drop policy if exists pipeline_insert on pipeline_rows;
drop policy if exists pipeline_update on pipeline_rows;
drop policy if exists pipeline_delete on pipeline_rows;
create policy pipeline_select on pipeline_rows for select to authenticated using (true);
create policy pipeline_insert on pipeline_rows for insert to authenticated with check (owner = auth.uid());
-- Journey columns are team-editable; the trigger below keeps identity/money owner-only.
create policy pipeline_update on pipeline_rows for update to authenticated using (true) with check (true);
create policy pipeline_delete on pipeline_rows for delete to authenticated using (owner = auth.uid());

-- Postgres has no column-level RLS: this trigger is the enforcement mechanism.
create or replace function guard_pipeline_row_update() returns trigger
language plpgsql security definer as $$
begin
  if new.owner is distinct from old.owner or new.proposal_id is distinct from old.proposal_id then
    raise exception 'owner and proposal_id are immutable';
  end if;
  if auth.uid() is distinct from old.owner and (
    new.client is distinct from old.client or
    new.title is distinct from old.title or
    new.value is distinct from old.value or
    new.gp_amount is distinct from old.gp_amount or
    new.gp_pct is distinct from old.gp_pct
  ) then
    raise exception 'identity and money columns are owner-only';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists pipeline_rows_guard on pipeline_rows;
create trigger pipeline_rows_guard before update on pipeline_rows
for each row execute function guard_pipeline_row_update();

create table if not exists external_deals (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table external_deals enable row level security;
drop policy if exists externals_all on external_deals;
create policy externals_all on external_deals for all to authenticated using (true) with check (true);

create table if not exists team_settings (
  id smallint primary key,
  targets jsonb not null default '{}'::jsonb
);
alter table team_settings enable row level security;
drop policy if exists team_settings_select on team_settings;
drop policy if exists team_settings_update on team_settings;
create policy team_settings_select on team_settings for select to authenticated using (true);
create policy team_settings_update on team_settings for update to authenticated using (true) with check (true);
insert into team_settings (id, targets) values (1, '{}'::jsonb) on conflict (id) do nothing;

create table if not exists user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb
);
alter table user_settings enable row level security;
drop policy if exists user_settings_all on user_settings;
create policy user_settings_all on user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists copies (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  row_id text not null,
  copied_at timestamptz not null default now(),
  primary key (user_id, row_id)
);
alter table copies enable row level security;
drop policy if exists copies_all on copies;
create policy copies_all on copies for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Every policy above targets `authenticated`; anon has no access anywhere.

-- ---------------------------------------------------------------------------
-- AFTER creating the two accounts in Authentication > Users, seed their names
-- (replace the UUIDs with the real user ids from the dashboard):
--   insert into profiles (id, display_name) values
--     ('<mohamed-user-uuid>', 'Mohamed'),
--     ('<heba-user-uuid>', 'Heba')
--   on conflict (id) do update set display_name = excluded.display_name;
