-- Notebook tables had row-level security enabled without a policy that
-- accepts a team member's insert. PostgREST then reports
-- "new row violates row-level security policy" on INSERT ... RETURNING.
-- Recreate the member policies and make sure the membership helper can run.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members as tm
    where tm.team_id = p_team_id
      and tm.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_team_member(uuid) from public, anon, authenticated;
grant execute on function private.is_team_member(uuid) to authenticated;

grant execute on function private.can_manage_team_roles(uuid) to authenticated;

alter table public.notebooks enable row level security;
alter table public.notebook_sections enable row level security;
alter table public.notebook_templates enable row level security;
alter table public.notebook_template_tabs enable row level security;
alter table public.notebook_template_sections enable row level security;

grant select, insert, update, delete on table public.notebooks to authenticated;
grant select, insert, update, delete on table public.notebook_sections to authenticated;
grant select, insert, update, delete on table public.notebook_templates to authenticated;
grant select, insert, update, delete on table public.notebook_template_tabs to authenticated;
grant select, insert, update, delete on table public.notebook_template_sections to authenticated;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'notebooks',
        'notebook_sections',
        'notebook_templates',
        'notebook_template_tabs',
        'notebook_template_sections'
      )
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end;
$$;

create policy notebooks_select_members
  on public.notebooks for select to authenticated
  using (private.is_team_member(team_id));

create policy notebooks_insert_members
  on public.notebooks for insert to authenticated
  with check (private.is_team_member(team_id));

create policy notebooks_update_members
  on public.notebooks for update to authenticated
  using (private.is_team_member(team_id))
  with check (private.is_team_member(team_id));

create policy notebooks_delete_admin
  on public.notebooks for delete to authenticated
  using (private.can_manage_team_roles(team_id));

create policy notebook_sections_select_members
  on public.notebook_sections for select to authenticated
  using (
    exists (
      select 1
      from public.notebooks as notebook
      where notebook.id = notebook_id
        and private.is_team_member(notebook.team_id)
    )
  );

create policy notebook_sections_insert_members
  on public.notebook_sections for insert to authenticated
  with check (
    exists (
      select 1
      from public.notebooks as notebook
      where notebook.id = notebook_id
        and private.is_team_member(notebook.team_id)
    )
  );

create policy notebook_sections_update_members
  on public.notebook_sections for update to authenticated
  using (
    exists (
      select 1
      from public.notebooks as notebook
      where notebook.id = notebook_id
        and private.is_team_member(notebook.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.notebooks as notebook
      where notebook.id = notebook_id
        and private.is_team_member(notebook.team_id)
    )
  );

create policy notebook_templates_select
  on public.notebook_templates for select to authenticated
  using (team_id is null or private.is_team_member(team_id));

create policy notebook_templates_insert_admin
  on public.notebook_templates for insert to authenticated
  with check (team_id is not null and private.can_manage_team_roles(team_id));

create policy notebook_templates_update_admin
  on public.notebook_templates for update to authenticated
  using (team_id is not null and private.can_manage_team_roles(team_id))
  with check (team_id is not null and private.can_manage_team_roles(team_id));

create policy notebook_templates_delete_admin
  on public.notebook_templates for delete to authenticated
  using (team_id is not null and private.can_manage_team_roles(team_id));

create policy notebook_template_tabs_select
  on public.notebook_template_tabs for select to authenticated
  using (
    exists (
      select 1
      from public.notebook_templates as template
      where template.id = template_id
        and (template.team_id is null or private.is_team_member(template.team_id))
    )
  );

create policy notebook_template_tabs_write_admin
  on public.notebook_template_tabs for all to authenticated
  using (
    exists (
      select 1
      from public.notebook_templates as template
      where template.id = template_id
        and template.team_id is not null
        and private.can_manage_team_roles(template.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.notebook_templates as template
      where template.id = template_id
        and template.team_id is not null
        and private.can_manage_team_roles(template.team_id)
    )
  );

create policy notebook_template_sections_select
  on public.notebook_template_sections for select to authenticated
  using (
    exists (
      select 1
      from public.notebook_template_tabs as tab
      join public.notebook_templates as template on template.id = tab.template_id
      where tab.id = tab_id
        and (template.team_id is null or private.is_team_member(template.team_id))
    )
  );

create policy notebook_template_sections_write_admin
  on public.notebook_template_sections for all to authenticated
  using (
    exists (
      select 1
      from public.notebook_template_tabs as tab
      join public.notebook_templates as template on template.id = tab.template_id
      where tab.id = tab_id
        and template.team_id is not null
        and private.can_manage_team_roles(template.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.notebook_template_tabs as tab
      join public.notebook_templates as template on template.id = tab.template_id
      where tab.id = tab_id
        and template.team_id is not null
        and private.can_manage_team_roles(template.team_id)
    )
  );

create policy notebook_sections_delete_admin
  on public.notebook_sections for delete to authenticated
  using (
    exists (
      select 1
      from public.notebooks as notebook
      where notebook.id = notebook_id
        and private.can_manage_team_roles(notebook.team_id)
    )
  );
