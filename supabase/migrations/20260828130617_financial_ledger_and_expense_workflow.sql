alter table public.contas_bancarias add column if not exists saldo_atual numeric(14,2);
update public.contas_bancarias set saldo_atual=saldo_inicial where saldo_atual is null;
alter table public.contas_bancarias alter column saldo_atual set default 0;
alter table public.contas_bancarias alter column saldo_atual set not null;

create table public.categorias_financeiras(
 id uuid primary key default gen_random_uuid(), nome text not null, tipo text not null check(tipo in('entrada','saida','ambos')),
 ativo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(nome,tipo));
create table public.movimentacoes_financeiras(
 id uuid primary key default gen_random_uuid(), tipo text not null check(tipo in('entrada','saida','transferencia_entrada','transferencia_saida','estorno')),
 data date not null, descricao text not null, categoria_id uuid references public.categorias_financeiras(id) on delete set null,
 conta_id uuid not null references public.contas_bancarias(id), conta_destino_id uuid references public.contas_bancarias(id), valor numeric(14,2) not null check(valor>0),
 observacao text, comprovante_url text, despesa_id uuid references public.despesas(id), transferencia_id uuid, estorno_de_id uuid references public.movimentacoes_financeiras(id),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now());
create table public.despesas_recorrencias(
 id uuid primary key default gen_random_uuid(), descricao text not null, dia_vencimento smallint not null check(dia_vencimento between 1 and 31), valor numeric(14,2) not null check(valor>0),
 categoria text, conta_id uuid references public.contas_bancarias(id), fornecedor text, data_inicio date not null, data_fim date, ativo boolean not null default true,
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.pagamentos_despesas(
 id uuid primary key default gen_random_uuid(), despesa_id uuid not null references public.despesas(id), conta_id uuid not null references public.contas_bancarias(id),
 movimentacao_id uuid not null references public.movimentacoes_financeiras(id), valor numeric(14,2) not null check(valor>0), data_pagamento date not null,
 comprovante_url text, observacao text, created_by uuid not null default auth.uid() references auth.users(id), estornado boolean not null default false,
 estornado_por uuid references auth.users(id), estornado_em timestamptz, created_at timestamptz not null default now());
alter table public.despesas add column if not exists competencia date;
alter table public.despesas add column if not exists recorrencia_id uuid references public.despesas_recorrencias(id);
alter table public.despesas add column if not exists pago_por uuid references auth.users(id);
update public.despesas set competencia=date_trunc('month',data_vencimento)::date where competencia is null;
create unique index pagamentos_despesa_ativo_uidx on public.pagamentos_despesas(despesa_id) where estornado=false;
create index movimentacoes_conta_data_idx on public.movimentacoes_financeiras(conta_id,data desc);
create index movimentacoes_despesa_idx on public.movimentacoes_financeiras(despesa_id);
create index despesas_competencia_idx on public.despesas(competencia,status);

create or replace function public.registrar_movimentacao(p_tipo text,p_data date,p_descricao text,p_conta_id uuid,p_valor numeric,p_categoria_id uuid default null,p_observacao text default null,p_comprovante_url text default null,p_conta_destino_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$ declare v_id uuid;v_transfer uuid:=gen_random_uuid();begin
 if (select auth.uid()) is null then raise exception 'Não autenticado'; end if;
 if p_valor<=0 then raise exception 'Valor deve ser positivo'; end if;
 if p_tipo='entrada' then update public.contas_bancarias set saldo_atual=saldo_atual+p_valor where id=p_conta_id;
 elsif p_tipo='saida' then update public.contas_bancarias set saldo_atual=saldo_atual-p_valor where id=p_conta_id;
 elsif p_tipo='transferencia' then
  if p_conta_destino_id is null or p_conta_destino_id=p_conta_id then raise exception 'Conta de destino inválida'; end if;
  update public.contas_bancarias set saldo_atual=saldo_atual-p_valor where id=p_conta_id;
  update public.contas_bancarias set saldo_atual=saldo_atual+p_valor where id=p_conta_destino_id;
  insert into public.movimentacoes_financeiras(tipo,data,descricao,conta_id,conta_destino_id,valor,observacao,comprovante_url,transferencia_id) values('transferencia_saida',p_data,p_descricao,p_conta_id,p_conta_destino_id,p_valor,p_observacao,p_comprovante_url,v_transfer) returning id into v_id;
  insert into public.movimentacoes_financeiras(tipo,data,descricao,conta_id,conta_destino_id,valor,observacao,comprovante_url,transferencia_id) values('transferencia_entrada',p_data,p_descricao,p_conta_destino_id,p_conta_id,p_valor,p_observacao,p_comprovante_url,v_transfer);return v_id;
 else raise exception 'Tipo inválido'; end if;
 insert into public.movimentacoes_financeiras(tipo,data,descricao,categoria_id,conta_id,valor,observacao,comprovante_url) values(p_tipo,p_data,p_descricao,p_categoria_id,p_conta_id,p_valor,p_observacao,p_comprovante_url) returning id into v_id;return v_id;end $$;

create or replace function public.pagar_despesa(p_despesa_id uuid,p_conta_id uuid,p_valor numeric,p_data date,p_comprovante_url text default null,p_observacao text default null)
returns uuid language plpgsql security invoker set search_path='' as $$ declare v_mov uuid;v_pag uuid;v_desc text;begin
 if (select auth.uid()) is null then raise exception 'Não autenticado'; end if;
 if exists(select 1 from public.pagamentos_despesas where despesa_id=p_despesa_id and estornado=false) then raise exception 'Despesa já paga'; end if;
 select descricao into v_desc from public.despesas where id=p_despesa_id for update;if v_desc is null then raise exception 'Despesa não encontrada';end if;
 update public.contas_bancarias set saldo_atual=saldo_atual-p_valor where id=p_conta_id;
 insert into public.movimentacoes_financeiras(tipo,data,descricao,conta_id,valor,observacao,comprovante_url,despesa_id) values('saida',p_data,'Pagamento: '||v_desc,p_conta_id,p_valor,p_observacao,p_comprovante_url,p_despesa_id) returning id into v_mov;
 insert into public.pagamentos_despesas(despesa_id,conta_id,movimentacao_id,valor,data_pagamento,comprovante_url,observacao) values(p_despesa_id,p_conta_id,v_mov,p_valor,p_data,p_comprovante_url,p_observacao) returning id into v_pag;
 update public.despesas set status='pago',data_pagamento=p_data,conta_bancaria_id=p_conta_id,pago_por=(select auth.uid()),comprovante_url=coalesce(p_comprovante_url,comprovante_url) where id=p_despesa_id;return v_pag;end $$;

create or replace function public.estornar_pagamento_despesa(p_pagamento_id uuid,p_observacao text default null)
returns uuid language plpgsql security invoker set search_path='' as $$ declare p public.pagamentos_despesas;v_mov uuid;begin
 if (select auth.uid()) is null then raise exception 'Não autenticado'; end if;
 select * into p from public.pagamentos_despesas where id=p_pagamento_id and estornado=false for update;if p.id is null then raise exception 'Pagamento inexistente ou já estornado';end if;
 update public.contas_bancarias set saldo_atual=saldo_atual+p.valor where id=p.conta_id;
 insert into public.movimentacoes_financeiras(tipo,data,descricao,conta_id,valor,observacao,despesa_id,estorno_de_id) values('estorno',current_date,'Estorno de pagamento',p.conta_id,p.valor,p_observacao,p.despesa_id,p.movimentacao_id) returning id into v_mov;
 update public.pagamentos_despesas set estornado=true,estornado_por=(select auth.uid()),estornado_em=now() where id=p.id;
 update public.despesas set status='pendente',data_pagamento=null,pago_por=null where id=p.despesa_id;return v_mov;end $$;

do $$ declare t text;begin foreach t in array array['categorias_financeiras','movimentacoes_financeiras','despesas_recorrencias','pagamentos_despesas'] loop execute format('alter table public.%I enable row level security',t);execute format('create policy "authenticated_all" on public.%I for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',t);execute format('grant select,insert,update,delete on public.%I to authenticated',t);end loop;end $$;
grant execute on function public.registrar_movimentacao(text,date,text,uuid,numeric,uuid,text,text,uuid) to authenticated;
grant execute on function public.pagar_despesa(uuid,uuid,numeric,date,text,text) to authenticated;
grant execute on function public.estornar_pagamento_despesa(uuid,text) to authenticated;
