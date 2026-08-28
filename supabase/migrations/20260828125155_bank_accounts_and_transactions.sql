create table public.contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  banco text not null,
  codigo_banco text,
  agencia text,
  conta text,
  tipo_conta text not null default 'corrente' check (tipo_conta in ('corrente','poupanca','caixa','investimento','outro')),
  saldo_inicial numeric(14,2) not null default 0,
  cor text not null default '#f7c600',
  logo_url text,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.receitas add column conta_bancaria_id uuid references public.contas_bancarias(id) on delete set null;
alter table public.despesas add column conta_bancaria_id uuid references public.contas_bancarias(id) on delete set null;
alter table public.retiradas add column conta_bancaria_id uuid references public.contas_bancarias(id) on delete set null;
create index receitas_conta_idx on public.receitas(conta_bancaria_id);
create index despesas_conta_idx on public.despesas(conta_bancaria_id);
create index retiradas_conta_idx on public.retiradas(conta_bancaria_id);
create trigger set_updated_at before update on public.contas_bancarias for each row execute function public.set_updated_at();
alter table public.contas_bancarias enable row level security;
create policy "authenticated_all" on public.contas_bancarias for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
grant select,insert,update,delete on public.contas_bancarias to authenticated;
insert into public.contas_bancarias(nome,banco,codigo_banco,tipo_conta,cor) values ('Conta principal','Banco do Brasil','001','corrente','#f7c600');
