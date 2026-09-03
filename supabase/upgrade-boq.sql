-- BOQ Costing Relay (design: docs/designs/boq-costing-relay.md, APPROVED).
-- Run once in the SQL editor. Idempotent: re-asserts its prerequisites
-- (roles column, helpers, tightened policies) so it is safe on any state.
--
-- Adds: proposals_team + project_manager roles, the boqs table with
-- pen-holder turn-taking, and gates ALL pricing/pipeline data on BD roles
-- so a delivery login can never read or write margins, GP, or proposals.

-- ---- prerequisites, re-asserted ------------------------------------------
alter table profiles add column if not exists role text not null default 'member';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('member','manager','proposals_team','project_manager'));

create or replace function is_manager() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'manager') $$;

create or replace function is_bd() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role in ('member','manager')) $$;

-- ---- proposals: BD-only entirely -----------------------------------------
drop policy if exists proposals_select on proposals;
create policy proposals_select on proposals for select to authenticated
  using ((select is_bd()) and (owner = auth.uid() or (select is_manager())));
drop policy if exists proposals_insert on proposals;
create policy proposals_insert on proposals for insert to authenticated
  with check ((select is_bd()) and owner = auth.uid());
drop policy if exists proposals_update on proposals;
create policy proposals_update on proposals for update to authenticated
  using ((select is_bd()) and owner = auth.uid()) with check ((select is_bd()) and owner = auth.uid());
drop policy if exists proposals_delete on proposals;
create policy proposals_delete on proposals for delete to authenticated
  using ((select is_bd()) and owner = auth.uid());

-- ---- pipeline / externals / targets: BD-only (delivery never reads GP) ----
drop policy if exists pipeline_select on pipeline_rows;
create policy pipeline_select on pipeline_rows for select to authenticated using ((select is_bd()));
drop policy if exists pipeline_insert on pipeline_rows;
create policy pipeline_insert on pipeline_rows for insert to authenticated
  with check ((select is_bd()) and owner = auth.uid());
drop policy if exists pipeline_update on pipeline_rows;
create policy pipeline_update on pipeline_rows for update to authenticated
  using ((select is_bd())) with check ((select is_bd()));
drop policy if exists pipeline_delete on pipeline_rows;
create policy pipeline_delete on pipeline_rows for delete to authenticated
  using ((select is_bd()) and owner = auth.uid());

drop policy if exists externals_all on external_deals;
create policy externals_all on external_deals for all to authenticated
  using ((select is_bd())) with check ((select is_bd()));

drop policy if exists team_settings_select on team_settings;
create policy team_settings_select on team_settings for select to authenticated using ((select is_bd()));
drop policy if exists team_settings_update on team_settings;
create policy team_settings_update on team_settings for update to authenticated
  using ((select is_bd())) with check ((select is_bd()));

-- ---- the BOQ record -------------------------------------------------------
create table if not exists boqs (
  proposal_id uuid primary key references proposals(id) on delete cascade,
  owner uuid not null references auth.users on delete cascade,
  pt_assignee uuid references auth.users on delete set null,
  pm_assignee uuid references auth.users on delete set null,
  status text not null default 'draft' check (status in ('draft','pm_review','ready','imported')),
  context jsonb not null default '{}'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  rev int not null default 0,
  updated_at timestamptz not null default now()
);
alter table boqs enable row level security;

drop policy if exists boqs_select on boqs;
create policy boqs_select on boqs for select to authenticated
  using (owner = auth.uid() or pt_assignee = auth.uid() or pm_assignee = auth.uid() or (select is_manager()));
drop policy if exists boqs_insert on boqs;
create policy boqs_insert on boqs for insert to authenticated
  with check ((select is_bd()) and owner = auth.uid());
-- Managers are read-only oversight: UPDATE only for owner + assignees.
drop policy if exists boqs_update on boqs;
create policy boqs_update on boqs for update to authenticated
  using (owner = auth.uid() or pt_assignee = auth.uid() or pm_assignee = auth.uid())
  with check (owner = auth.uid() or pt_assignee = auth.uid() or pm_assignee = auth.uid());
drop policy if exists boqs_delete on boqs;
create policy boqs_delete on boqs for delete to authenticated
  using ((select is_bd()) and owner = auth.uid());

-- Pen-holder turn-taking: one writer per stage, enforced here, not in the UI.
create or replace function guard_boq_update() returns trigger
language plpgsql security definer as $$
declare
  actor uuid := auth.uid();
  is_owner boolean := actor = old.owner;
begin
  if new.owner is distinct from old.owner or new.proposal_id is distinct from old.proposal_id then
    raise exception 'owner and proposal_id are immutable';
  end if;
  if (new.pt_assignee is distinct from old.pt_assignee or new.pm_assignee is distinct from old.pm_assignee)
     and not is_owner then
    raise exception 'only the owner reassigns';
  end if;
  if new.lines is distinct from old.lines or new.context is distinct from old.context then
    if not (
      (old.status = 'draft' and actor = old.pt_assignee) or
      (old.status = 'pm_review' and actor = old.pm_assignee) or
      (old.status in ('ready','imported') and is_owner)
    ) then
      raise exception 'not your turn: % holds the pen', old.status;
    end if;
  end if;
  if new.status is distinct from old.status then
    if not (
      is_owner or
      (actor = old.pt_assignee and old.status = 'draft' and new.status = 'pm_review') or
      (actor = old.pm_assignee and old.status = 'pm_review' and new.status in ('draft','ready'))
    ) then
      raise exception 'transition % -> % not allowed for this role', old.status, new.status;
    end if;
  end if;
  new.rev := old.rev + 1;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists boqs_guard on boqs;
create trigger boqs_guard before update on boqs
for each row execute function guard_boq_update();
