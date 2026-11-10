-- Index for the same-owner checklist relation; added after performance advisor.
create index mw_processes_owner_checklist_idx on public.mw_processes(owner_id,checklist_id);
