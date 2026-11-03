-- Applied on MW TECH CONTROL Supabase project on 2026-11-03.
-- Empty, owner-scoped destination; app remains on Appwrite until tested cutover.
create table public.mw_clients (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 source_id text, name text not null check (length(trim(name)) > 0), phone text not null default '',
 details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,id), unique(owner_id,source_id)
);
create table public.mw_checklists (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 source_id text, client_id uuid not null, title text not null default '', model_id text not null default '',
 details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,id), unique(owner_id,source_id),
 foreign key(owner_id,client_id) references public.mw_clients(owner_id,id) on delete restrict
);
create table public.mw_processes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 source_id text, client_id uuid not null, checklist_id uuid, title text not null default '',
 status text not null default 'pendente',
 details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,id), unique(owner_id,source_id),
 foreign key(owner_id,client_id) references public.mw_clients(owner_id,id) on delete restrict,
 foreign key(owner_id,checklist_id) references public.mw_checklists(owner_id,id) on delete set null (checklist_id)
);
create table public.mw_agenda_entries (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 source_id text, entry_date date not null,
 entry_type text not null check(entry_type in ('evento','pagina','desenho','tarefa')),
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,source_id)
);
create index mw_clients_owner_name_idx on public.mw_clients(owner_id,name);
create index mw_checklists_owner_client_idx on public.mw_checklists(owner_id,client_id);
create index mw_processes_owner_client_idx on public.mw_processes(owner_id,client_id);
create index mw_agenda_entries_owner_date_idx on public.mw_agenda_entries(owner_id,entry_date);
do $policies$
declare t text;
begin
 foreach t in array array['mw_clients','mw_checklists','mw_processes','mw_agenda_entries'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)',t||'_select_own',t);
  execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)',t||'_insert_own',t);
  execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',t||'_update_own',t);
  execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)',t||'_delete_own',t);
 end loop;
end $policies$;
comment on table public.mw_clients is 'Clientes compartilhados entre Processos e Checklists; aguardando importacao validada.';
comment on table public.mw_checklists is 'Checklists independentes de processos, com vinculo opcional a partir de processos.';
comment on table public.mw_processes is 'Processos independentes de checklists; ambos referenciam o mesmo cadastro de clientes.';
comment on table public.mw_agenda_entries is 'Eventos, paginas, desenhos e tarefas da Agenda; sem sincronizacao ativa antes do cutover.';
