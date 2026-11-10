-- Applied to MW TECH CONTROL Supabase project on 2026-11-03.
-- Optimistic compare-and-swap: prevents outdated device snapshots from overwriting newer ones.
create or replace function public.mw_save_despachante_snapshot(p_payload jsonb, p_expected_revision bigint default 0)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare v_owner uuid := (select auth.uid()); v_revision bigint;
begin
 if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
 if jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload->'clients') <> 'array'
    or jsonb_typeof(p_payload->'jobs') <> 'array'
    or jsonb_typeof(p_payload->'models') <> 'array'
    or (p_payload ? 'processes' and jsonb_typeof(p_payload->'processes') <> 'array') then
    raise exception 'Invalid Despachante snapshot' using errcode = '22023';
 end if;
 if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
 end if;
 if p_expected_revision = 0 then
   insert into public.mw_control_snapshots (owner_id, module, payload, source, revision)
   values (v_owner,'despachante',p_payload,'supabase',1)
   on conflict (owner_id,module) do nothing
   returning revision into v_revision;
 else
   update public.mw_control_snapshots
     set payload=p_payload, revision=revision+1, updated_at=now(), source='supabase'
   where owner_id=v_owner and module='despachante' and revision=p_expected_revision
   returning revision into v_revision;
 end if;
 if v_revision is null then
    raise exception 'Conflict: Despachante data changed in another device' using errcode='40001';
 end if;
 return v_revision;
end;
$$;
revoke all on function public.mw_save_despachante_snapshot(jsonb,bigint) from public,anon;
grant execute on function public.mw_save_despachante_snapshot(jsonb,bigint) to authenticated;
