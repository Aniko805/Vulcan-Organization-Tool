begin;

-- Lets inventory managers edit the description of a part shown in the parts
-- drawer. part_catalog has no UPDATE grant, so this goes through a narrow RPC
-- that changes only `description`, only on that team's own catalog rows.
-- Official catalog rows are shared by every team and stay read-only.
create or replace function public.update_part_description(
  p_part_id uuid,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_catalog_id uuid;
  v_catalog_team_id uuid;
  v_is_official boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select p.team_id, p.part_catalog_id
  into v_team_id, v_catalog_id
  from public.parts as p
  where p.id = p_part_id;

  if not found then
    raise exception 'Part was not found';
  end if;
  if not private.can_manage_inventory(v_team_id) then
    raise exception 'You do not have permission to manage this inventory';
  end if;
  if v_catalog_id is null then
    raise exception 'This part has no catalog entry to update';
  end if;

  select pc.team_id, pc.is_official
  into v_catalog_team_id, v_is_official
  from public.part_catalog as pc
  where pc.id = v_catalog_id;

  if v_is_official or v_catalog_team_id is distinct from v_team_id then
    raise exception 'Official catalog descriptions cannot be edited';
  end if;

  update public.part_catalog
  set description = nullif(btrim(p_description), '')
  where id = v_catalog_id;
end;
$$;

revoke all on function public.update_part_description(uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_part_description(uuid, text)
  to authenticated;

commit;
