-- MW TECH CONTROL - Import staging (2026-11-03)
-- Applied to project qclawbwfrqcwtegkvkmy.
-- This table is NOT a production data switch. Keep Appwrite unchanged until reconciliation.
create table if not exists public.mw_control_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  module text not null check (module in ('agenda','despachante','financeiro','monitoramento','sistemas','usuarios','configuracoes')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  source text not null default 'supabase' check (source in ('supabase','appwrite','local_import')),
  source_revision text,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,module)
);
alter table public.mw_control_snapshots enable row level security;
revoke all on public.mw_control_snapshots from anon;
grant select, insert, update, delete on public.mw_control_snapshots to authenticated;
create policy "mw_control_snapshot_read_own" on public.mw_control_snapshots
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "mw_control_snapshot_insert_own" on public.mw_control_snapshots
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "mw_control_snapshot_update_own" on public.mw_control_snapshots
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "mw_control_snapshot_delete_own" on public.mw_control_snapshots
  for delete to authenticated using ((select auth.uid()) = owner_id);
