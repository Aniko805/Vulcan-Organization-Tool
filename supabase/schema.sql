-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  first_name text,
  last_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  username text NOT NULL UNIQUE,
  avatar_image text,
  bio text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team_number text UNIQUE,
  owner_id uuid,
  invite_code text NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'::text) UNIQUE,
  created_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  ai_provider text,
  ai_model text,
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.team_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  name text,
  is_admin boolean NOT NULL DEFAULT false,
  can_manage_members boolean NOT NULL DEFAULT false,
  can_manage_tasks boolean NOT NULL DEFAULT false,
  can_manage_inventory boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT team_roles_pkey PRIMARY KEY (id),
  CONSTRAINT team_roles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.member_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  role_id uuid NOT NULL,
  CONSTRAINT member_roles_pkey PRIMARY KEY (id),
  CONSTRAINT member_roles_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.team_members(id),
  CONSTRAINT member_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.team_roles(id)
);
CREATE TABLE public.parts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  part_catalog_id uuid,
  CONSTRAINT parts_pkey PRIMARY KEY (id),
  CONSTRAINT parts_part_catalog_id_fkey FOREIGN KEY (part_catalog_id) REFERENCES public.part_catalog(id),
  CONSTRAINT parts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT parts_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo'::text CHECK (status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text, 'blocked'::text])),
  importance text NOT NULL DEFAULT 'medium'::text CHECK (importance = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
  category text,
  competition_status text,
  due_date date,
  is_personal boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  parent_id uuid,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT tasks_parent_same_team_fk FOREIGN KEY (parent_id) REFERENCES public.tasks(id),
  CONSTRAINT tasks_parent_same_team_fk FOREIGN KEY (team_id) REFERENCES public.tasks(team_id),
  CONSTRAINT tasks_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.task_assignees (
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT task_assignees_pkey PRIMARY KEY (user_id, task_id),
  CONSTRAINT task_assignees_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.task_role_assignees (
  task_id uuid NOT NULL,
  role_id uuid NOT NULL,
  CONSTRAINT task_role_assignees_pkey PRIMARY KEY (task_id, role_id),
  CONSTRAINT task_role_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT task_role_assignees_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.team_roles(id)
);
CREATE TABLE public.task_parts (
  task_id uuid NOT NULL,
  part_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  CONSTRAINT task_parts_pkey PRIMARY KEY (task_id, part_id),
  CONSTRAINT task_parts_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT task_parts_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id)
);
CREATE TABLE public.part_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  description text,
  manufacturer text,
  team_id uuid,
  is_official boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  product_url text,
  image_url text,
  category text,
  source text,
  CONSTRAINT part_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT part_catalog_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT part_catalog_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.status_list (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  team_id uuid,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT status_list_pkey PRIMARY KEY (id),
  CONSTRAINT status_list_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT status_list_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.part_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status_id uuid,
  part_id uuid,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT part_status_pkey PRIMARY KEY (id),
  CONSTRAINT part_status_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT part_status_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.status_list(id),
  CONSTRAINT part_status_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id)
);
CREATE TABLE public.eng_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  note_date date NOT NULL,
  author_id uuid,
  title text CHECK (title IS NULL OR char_length(title) <= 200),
  body text NOT NULL DEFAULT ''::text CHECK (char_length(body) <= 16000),
  subteam text CHECK (subteam IS NULL OR char_length(subteam) <= 80),
  task_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT eng_notes_pkey PRIMARY KEY (id),
  CONSTRAINT eng_notes_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT eng_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id),
  CONSTRAINT eng_notes_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.eng_note_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  note_id uuid,
  team_id uuid NOT NULL,
  storage_path text NOT NULL,
  mime_type text CHECK (mime_type = ANY (ARRAY['image/png'::text, 'image/jpeg'::text, 'image/webp'::text, 'image/heic'::text])),
  byte_size integer CHECK (byte_size > 0),
  caption text CHECK (caption IS NULL OR char_length(caption) <= 500),
  position integer NOT NULL DEFAULT 0 CHECK ("position" >= 0),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT eng_note_images_pkey PRIMARY KEY (id),
  CONSTRAINT eng_note_images_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.eng_notes(id),
  CONSTRAINT eng_note_images_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT eng_note_images_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.notebook_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notebook_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notebook_template_tabs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  CONSTRAINT notebook_template_tabs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notebook_template_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  prompt_hint text,
  CONSTRAINT notebook_template_sections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notebooks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  notebook_date date NOT NULL,
  template_id uuid,
  title text,
  status text NOT NULL DEFAULT 'draft'::text,
  generated_at timestamp with time zone,
  generated_by uuid,
  provider text,
  model text,
  source_note_count integer NOT NULL DEFAULT 0,
  source_max_updated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notebooks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notebook_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL,
  tab_name text NOT NULL,
  tab_position integer NOT NULL DEFAULT 0,
  section_name text NOT NULL,
  section_position integer NOT NULL DEFAULT 0,
  content text NOT NULL DEFAULT ''::text,
  is_user_edited boolean NOT NULL DEFAULT false,
  edited_by uuid,
  edited_at timestamp with time zone,
  CONSTRAINT notebook_sections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notebook_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL,
  team_id uuid NOT NULL,
  provider text,
  model text,
  status text NOT NULL DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'succeeded'::text, 'failed'::text])),
  requested_by uuid,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  error text,
  note_count integer,
  prompt_tokens integer,
  completion_tokens integer,
  CONSTRAINT notebook_runs_pkey PRIMARY KEY (id),
  CONSTRAINT notebook_runs_notebook_id_fkey FOREIGN KEY (notebook_id) REFERENCES public.notebooks(id),
  CONSTRAINT notebook_runs_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT notebook_runs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.notebook_run_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  level text NOT NULL DEFAULT 'info'::text CHECK (level = ANY (ARRAY['info'::text, 'warn'::text, 'error'::text])),
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notebook_run_events_pkey PRIMARY KEY (id),
  CONSTRAINT notebook_run_events_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.notebook_runs(id)
);
CREATE TABLE public.notebook_section_refs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  kind text NOT NULL,
  note_id uuid,
  task_id uuid,
  image_id uuid,
  CONSTRAINT notebook_section_refs_pkey PRIMARY KEY (id),
  CONSTRAINT notebook_section_refs_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.notebook_sections(id),
  CONSTRAINT notebook_section_refs_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.eng_notes(id),
  CONSTRAINT notebook_section_refs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT notebook_section_refs_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.eng_note_images(id)
);