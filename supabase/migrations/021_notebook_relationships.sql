-- The live notebook tables were created without the foreign keys PostgREST
-- uses to expose relationships. Add the missing keys without touching rows.

alter table public.notebook_templates drop constraint if exists notebook_templates_team_id_fkey;
alter table public.notebook_templates
  add constraint notebook_templates_team_id_fkey
  foreign key (team_id) references public.teams (id) on delete cascade;

alter table public.notebook_templates drop constraint if exists notebook_templates_created_by_fkey;
alter table public.notebook_templates
  add constraint notebook_templates_created_by_fkey
  foreign key (created_by) references public.profiles (id);

alter table public.notebook_template_tabs drop constraint if exists notebook_template_tabs_template_id_fkey;
alter table public.notebook_template_tabs
  add constraint notebook_template_tabs_template_id_fkey
  foreign key (template_id) references public.notebook_templates (id) on delete cascade;

alter table public.notebook_template_sections drop constraint if exists notebook_template_sections_tab_id_fkey;
alter table public.notebook_template_sections
  add constraint notebook_template_sections_tab_id_fkey
  foreign key (tab_id) references public.notebook_template_tabs (id) on delete cascade;

alter table public.notebooks drop constraint if exists notebooks_team_id_fkey;
alter table public.notebooks
  add constraint notebooks_team_id_fkey
  foreign key (team_id) references public.teams (id) on delete cascade;

alter table public.notebooks drop constraint if exists notebooks_template_id_fkey;
alter table public.notebooks
  add constraint notebooks_template_id_fkey
  foreign key (template_id) references public.notebook_templates (id) on delete set null;

alter table public.notebooks drop constraint if exists notebooks_generated_by_fkey;
alter table public.notebooks
  add constraint notebooks_generated_by_fkey
  foreign key (generated_by) references public.profiles (id);

alter table public.notebook_sections drop constraint if exists notebook_sections_notebook_id_fkey;
alter table public.notebook_sections
  add constraint notebook_sections_notebook_id_fkey
  foreign key (notebook_id) references public.notebooks (id) on delete cascade;

alter table public.notebook_sections drop constraint if exists notebook_sections_edited_by_fkey;
alter table public.notebook_sections
  add constraint notebook_sections_edited_by_fkey
  foreign key (edited_by) references public.profiles (id);

notify pgrst, 'reload schema';
