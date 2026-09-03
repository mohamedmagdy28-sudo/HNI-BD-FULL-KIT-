-- BOQ relay amendment (user direction 2026-09-03): BOTH assignees can edit
-- lines during draft AND pm_review (attribution shows who added what);
-- the owner can edit at any status. Status transitions unchanged.
-- Run once in the SQL editor; safe to re-run.

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
      is_owner or
      (old.status in ('draft','pm_review') and actor in (old.pt_assignee, old.pm_assignee))
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
