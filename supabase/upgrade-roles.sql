-- Roles v2 (design: docs/designs/accounts-supabase.md, deferred section — now activated).
-- member  = sees ONLY their own proposals (plus the shared pipeline numbers)
-- manager = reads every proposal (drafts, costing, documents); writes stay owner-only for everyone.
-- Run once in the SQL editor. Safe to re-run.

alter table profiles add column if not exists role text not null default 'member'
  check (role in ('member','manager'));

-- SECURITY DEFINER bypasses profiles RLS inside the policy check (no recursion),
-- and the (select ...) call form caches it once per statement.
create or replace function is_manager() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'manager') $$;

drop policy if exists proposals_select on proposals;
create policy proposals_select on proposals for select to authenticated
  using (owner = auth.uid() or (select is_manager()));

-- Current team keeps exactly today's mutual visibility:
update profiles set role = 'manager'
 where id in ('fa96958f-5984-4c6b-a058-5d5d753b3c92',  -- Magdy
              'b0294902-0dff-41ee-8ea3-0fa46234f90a'); -- Heba
