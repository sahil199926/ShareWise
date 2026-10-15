begin;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := public.current_app_user_id();
  membership public.group_members;
begin
  membership := public.assert_group_member(p_group_id);
  if membership.role in ('owner', 'admin') then
    raise exception 'Group admins must delete the group instead of leaving it.';
  end if;

  perform set_config('app.allow_group_hard_delete', 'on', true);

  delete from public.debt_share_tokens
  where group_id = p_group_id
    and (person_user_id = actor or created_by_user_id = actor);
  delete from public.debts
  where group_id = p_group_id
    and (debtor_id = actor or creditor_id = actor);
  delete from public.sheet_person_aliases
  where group_id = p_group_id and user_id = actor;
  delete from public.daily_reminder_deliveries
  where group_id = p_group_id and user_id = actor;
  delete from public.audit_events
  where group_id = p_group_id
    and (
      actor_user_id = actor
      or (entity_type = 'user' and entity_id = actor::text)
    );
  delete from public.group_members
  where group_id = p_group_id and user_id = actor;
end;
$$;

revoke all on function public.leave_group(uuid) from public;
grant execute on function public.leave_group(uuid) to anon, authenticated;

commit;
