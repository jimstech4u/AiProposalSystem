-- Supabase PostgreSQL schema for the AI-Powered Technical Proposal
-- and Cost Estimation System.
-- Re-runnable reset script. Run this in the Supabase SQL editor after enabling Authentication.

create extension if not exists "pgcrypto";

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.audit_logs cascade;
drop table if exists public.notifications cascade;
drop table if exists public.user_settings cascade;
drop table if exists public.report_configs cascade;
drop table if exists public.integrations cascade;
drop table if exists public.proposal_templates cascade;
drop table if exists public.project_repository cascade;
drop table if exists public.tech_recommendations cascade;
drop table if exists public.timeline_phases cascade;
drop table if exists public.timeline_predictions cascade;
drop table if exists public.cost_estimation_items cascade;
drop table if exists public.cost_estimations cascade;
drop table if exists public.proposal_reviews cascade;
drop table if exists public.proposal_versions cascade;
drop table if exists public.proposals cascade;
drop table if exists public.requirements cascade;
drop table if exists public.projects cascade;
drop table if exists public.clients cascade;
drop table if exists public.user_profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.write_audit_log() cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.current_app_role() cascade;
drop function if exists public.is_admin() cascade;

drop type if exists public.proposal_status cascade;
drop type if exists public.project_status cascade;
drop type if exists public.app_role cascade;

do $$
begin
  create type public.app_role as enum ('engineer', 'project-manager', 'sales', 'admin');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.project_status as enum ('draft', 'analysis', 'proposal', 'approved', 'won', 'lost', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.proposal_status as enum ('draft', 'in_review', 'approved', 'rejected', 'sent', 'accepted', 'declined');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  employee_id text unique,
  company_name text,
  job_title text,
  department text,
  role public.app_role not null default 'engineer',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    id,
    full_name,
    email,
    phone,
    employee_id,
    company_name,
    job_title,
    department,
    role
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    nullif(new.raw_user_meta_data->>'employee_id', ''),
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'job_title',
    new.raw_user_meta_data->>'department',
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'engineer'::public.app_role)
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    employee_id = excluded.employee_id,
    company_name = excluded.company_name,
    job_title = excluded.job_title,
    department = excluded.department,
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  industry text,
  segment text,
  address text,
  notes text,
  rating numeric(3,2) check (rating between 0 and 5),
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  description text,
  industry text,
  project_type text not null,
  status public.project_status not null default 'draft',
  requirements_text text,
  target_users text,
  integration_needs text,
  constraints text,
  complexity_score numeric(5,2) check (complexity_score between 0 and 100),
  confidence_score numeric(5,2) check (confidence_score between 0 and 100),
  submitted_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null,
  title text not null,
  description text not null,
  priority text not null default 'medium',
  requirement_type text not null default 'functional',
  complexity numeric(5,2) check (complexity between 0 and 100),
  is_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid references public.user_profiles(id) on delete set null,
  title text not null,
  template_name text,
  tone text default 'professional',
  detail_level text default 'standard',
  executive_summary text,
  technical_approach text,
  architecture_description text,
  deliverables jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  status public.proposal_status not null default 'draft',
  version integer not null default 1,
  generated_content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version integer not null,
  content jsonb not null,
  change_summary text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (proposal_id, version)
);

create table if not exists public.proposal_reviews (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  reviewer_id uuid references public.user_profiles(id) on delete set null,
  decision text not null check (decision in ('pending', 'approved', 'rejected', 'revision_requested')),
  checklist jsonb not null default '{}'::jsonb,
  comments text,
  reviewed_at timestamptz default now()
);

create table if not exists public.cost_estimations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete set null,
  created_by uuid references public.user_profiles(id) on delete set null,
  currency text not null default 'USD',
  development_cost numeric(14,2) not null default 0,
  infrastructure_cost numeric(14,2) not null default 0,
  third_party_cost numeric(14,2) not null default 0,
  contingency_percent numeric(5,2) not null default 10,
  contingency_amount numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  min_cost numeric(14,2),
  max_cost numeric(14,2),
  confidence_score numeric(5,2) check (confidence_score between 0 and 100),
  assumptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cost_estimation_items (
  id uuid primary key default gen_random_uuid(),
  estimation_id uuid not null references public.cost_estimations(id) on delete cascade,
  module_name text not null,
  resource_role text,
  hours numeric(10,2) not null default 0,
  hourly_rate numeric(10,2) not null default 0,
  multiplier numeric(8,2) not null default 1,
  amount numeric(14,2) generated always as (hours * hourly_rate * multiplier) stored
);

create table if not exists public.timeline_predictions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid references public.user_profiles(id) on delete set null,
  duration_weeks integer not null,
  min_weeks integer,
  max_weeks integer,
  risk_level text not null default 'medium',
  confidence_score numeric(5,2) check (confidence_score between 0 and 100),
  critical_path jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.timeline_phases (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references public.timeline_predictions(id) on delete cascade,
  phase_name text not null,
  start_week integer not null,
  end_week integer not null,
  milestone text,
  dependencies jsonb not null default '[]'::jsonb,
  status text not null default 'planned'
);

create table if not exists public.tech_recommendations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid references public.user_profiles(id) on delete set null,
  stack_name text not null,
  frontend text,
  backend text,
  database_name text,
  hosting text,
  match_score numeric(5,2) check (match_score between 0 and 100),
  rationale text,
  pros jsonb not null default '[]'::jsonb,
  cons jsonb not null default '[]'::jsonb,
  alternatives jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_repository (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  project_title text not null,
  project_type text,
  technologies jsonb not null default '[]'::jsonb,
  estimated_cost numeric(14,2),
  actual_cost numeric(14,2),
  estimated_weeks integer,
  actual_weeks integer,
  outcome text,
  lessons_learned text,
  archived_at timestamptz not null default now()
);

create table if not exists public.proposal_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  sections jsonb not null default '[]'::jsonb,
  placeholders jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  is_default boolean not null default false,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  category text not null,
  status text not null default 'disconnected',
  config jsonb not null default '{}'::jsonb,
  sync_schedule text,
  last_sync_at timestamptz,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.report_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  report_type text not null,
  filters jsonb not null default '{}'::jsonb,
  schedule text,
  recipients text[] not null default '{}'::text[],
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.user_profiles(id) on delete cascade,
  email_notifications boolean not null default true,
  proposal_updates boolean not null default true,
  language text not null default 'English',
  theme text not null default 'light' check (theme in ('light', 'dark')),
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

do $$
declare
  admin_user_id uuid;
begin
  select id into admin_user_id
  from auth.users
  where email = 'jimstech4u@gmail.com'
  limit 1;

  admin_user_id := coalesce(admin_user_id, gen_random_uuid());

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  values (
    admin_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'jimstech4u@gmail.com',
    crypt('Admin@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"System Administrator","role":"admin","company_name":"JimsTech4U","job_title":"Administrator","department":"Administration"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  delete from auth.identities
  where provider = 'email'
    and provider_id = admin_user_id::text;

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    admin_user_id::text,
    admin_user_id,
    jsonb_build_object(
      'sub', admin_user_id::text,
      'email', 'jimstech4u@gmail.com',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  insert into public.user_profiles (
    id,
    full_name,
    email,
    company_name,
    job_title,
    department,
    role,
    is_active
  )
  values (
    admin_user_id,
    'System Administrator',
    'jimstech4u@gmail.com',
    'JimsTech4U',
    'Administrator',
    'Administration',
    'admin',
    true
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    company_name = excluded.company_name,
    job_title = excluded.job_title,
    department = excluded.department,
    role = excluded.role,
    is_active = true,
    updated_at = now();
end $$;

create index if not exists idx_projects_client_id on public.projects(client_id);
create index if not exists idx_projects_submitted_by on public.projects(submitted_by);
create index if not exists idx_requirements_project_id on public.requirements(project_id);
create index if not exists idx_proposals_project_id on public.proposals(project_id);
create index if not exists idx_cost_estimations_project_id on public.cost_estimations(project_id);
create index if not exists idx_timeline_predictions_project_id on public.timeline_predictions(project_id);
create index if not exists idx_tech_recommendations_project_id on public.tech_recommendations(project_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index if not exists idx_report_configs_created_by on public.report_configs(created_by);
create index if not exists idx_user_settings_user_id on public.user_settings(user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_user_profiles_updated_at on public.user_profiles;
create trigger touch_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_clients_updated_at on public.clients;
create trigger touch_clients_updated_at
before update on public.clients
for each row execute function public.touch_updated_at();

drop trigger if exists touch_projects_updated_at on public.projects;
create trigger touch_projects_updated_at
before update on public.projects
for each row execute function public.touch_updated_at();

drop trigger if exists touch_proposals_updated_at on public.proposals;
create trigger touch_proposals_updated_at
before update on public.proposals
for each row execute function public.touch_updated_at();

drop trigger if exists touch_proposal_templates_updated_at on public.proposal_templates;
create trigger touch_proposal_templates_updated_at
before update on public.proposal_templates
for each row execute function public.touch_updated_at();

drop trigger if exists touch_report_configs_updated_at on public.report_configs;
create trigger touch_report_configs_updated_at
before update on public.report_configs
for each row execute function public.touch_updated_at();

drop trigger if exists touch_user_settings_updated_at on public.user_settings;
create trigger touch_user_settings_updated_at
before update on public.user_settings
for each row execute function public.touch_updated_at();

alter table public.user_profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.requirements enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_versions enable row level security;
alter table public.proposal_reviews enable row level security;
alter table public.cost_estimations enable row level security;
alter table public.cost_estimation_items enable row level security;
alter table public.timeline_predictions enable row level security;
alter table public.timeline_phases enable row level security;
alter table public.tech_recommendations enable row level security;
alter table public.project_repository enable row level security;
alter table public.proposal_templates enable row level security;
alter table public.integrations enable row level security;
alter table public.report_configs enable row level security;
alter table public.user_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin'
$$;

create policy "profiles_select_own_or_admin" on public.user_profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin" on public.user_profiles
  for update using (id = auth.uid() or public.is_admin());

create policy "authenticated_read_clients" on public.clients
  for select using (auth.role() = 'authenticated');

create policy "pm_sales_admin_manage_clients" on public.clients
  for all using (public.current_app_role() in ('project-manager', 'sales', 'admin'));

create policy "authenticated_read_projects" on public.projects
  for select using (auth.role() = 'authenticated');

create policy "engineer_pm_sales_manage_projects" on public.projects
  for all using (public.current_app_role() in ('engineer', 'project-manager', 'sales', 'admin'));

create policy "authenticated_read_project_children" on public.requirements
  for select using (auth.role() = 'authenticated');

create policy "engineer_pm_sales_manage_requirements" on public.requirements
  for all using (public.current_app_role() in ('engineer', 'project-manager', 'sales', 'admin'));

create policy "authenticated_read_proposals" on public.proposals
  for select using (auth.role() = 'authenticated');

create policy "engineer_pm_sales_admin_create_proposals" on public.proposals
  for insert with check (public.current_app_role() in ('engineer', 'project-manager', 'sales', 'admin'));

create policy "engineer_pm_sales_admin_update_proposals" on public.proposals
  for update using (public.current_app_role() in ('engineer', 'project-manager', 'sales', 'admin'))
  with check (public.current_app_role() in ('engineer', 'project-manager', 'sales', 'admin'));

create policy "pm_admin_delete_proposals" on public.proposals
  for delete using (public.current_app_role() in ('project-manager', 'admin'));

create policy "authenticated_read_proposal_versions" on public.proposal_versions
  for select using (auth.role() = 'authenticated');

create policy "engineer_pm_sales_admin_create_proposal_versions" on public.proposal_versions
  for insert with check (public.current_app_role() in ('engineer', 'project-manager', 'sales', 'admin'));

create policy "engineer_pm_sales_admin_update_proposal_versions" on public.proposal_versions
  for update using (public.current_app_role() in ('engineer', 'project-manager', 'sales', 'admin'))
  with check (public.current_app_role() in ('engineer', 'project-manager', 'sales', 'admin'));

create policy "pm_admin_delete_proposal_versions" on public.proposal_versions
  for delete using (public.current_app_role() in ('project-manager', 'admin'));

create policy "pm_admin_manage_reviews" on public.proposal_reviews
  for all using (public.current_app_role() in ('project-manager', 'admin'));

create policy "authenticated_read_estimates" on public.cost_estimations
  for select using (auth.role() = 'authenticated');

create policy "engineer_pm_sales_manage_estimates" on public.cost_estimations
  for all using (public.current_app_role() in ('engineer', 'project-manager', 'sales', 'admin'));

create policy "authenticated_read_estimate_items" on public.cost_estimation_items
  for select using (auth.role() = 'authenticated');

create policy "engineer_pm_sales_manage_estimate_items" on public.cost_estimation_items
  for all using (public.current_app_role() in ('engineer', 'project-manager', 'sales', 'admin'));

create policy "authenticated_read_timelines" on public.timeline_predictions
  for select using (auth.role() = 'authenticated');

create policy "engineer_pm_manage_timelines" on public.timeline_predictions
  for all using (public.current_app_role() in ('engineer', 'project-manager', 'admin'));

create policy "authenticated_read_timeline_phases" on public.timeline_phases
  for select using (auth.role() = 'authenticated');

create policy "engineer_pm_manage_timeline_phases" on public.timeline_phases
  for all using (public.current_app_role() in ('engineer', 'project-manager', 'admin'));

create policy "authenticated_read_tech_recommendations" on public.tech_recommendations
  for select using (auth.role() = 'authenticated');

create policy "engineer_pm_manage_tech_recommendations" on public.tech_recommendations
  for all using (public.current_app_role() in ('engineer', 'project-manager', 'admin'));

create policy "authenticated_read_repository" on public.project_repository
  for select using (auth.role() = 'authenticated');

create policy "pm_admin_manage_repository" on public.project_repository
  for all using (public.current_app_role() in ('project-manager', 'admin'));

create policy "pm_admin_manage_templates" on public.proposal_templates
  for all using (public.current_app_role() in ('project-manager', 'admin'));

create policy "admin_manage_integrations" on public.integrations
  for all using (public.is_admin());

create policy "pm_sales_admin_read_reports" on public.report_configs
  for select using (public.current_app_role() in ('project-manager', 'sales', 'admin'));

create policy "pm_sales_admin_create_reports" on public.report_configs
  for insert with check (public.current_app_role() in ('project-manager', 'sales', 'admin'));

create policy "pm_sales_admin_update_reports" on public.report_configs
  for update using (public.current_app_role() in ('project-manager', 'sales', 'admin'))
  with check (public.current_app_role() in ('project-manager', 'sales', 'admin'));

create policy "pm_admin_delete_reports" on public.report_configs
  for delete using (public.current_app_role() in ('project-manager', 'admin'));

create policy "settings_own_or_admin" on public.user_settings
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "notifications_own_or_admin" on public.notifications
  for all using (user_id = auth.uid() or public.is_admin());

create policy "admin_read_audit_logs" on public.audit_logs
  for select using (public.is_admin());

create policy "admin_insert_audit_logs" on public.audit_logs
  for insert with check (public.is_admin());

create policy "admin_delete_audit_logs" on public.audit_logs
  for delete using (public.is_admin());

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
begin
  if tg_op = 'DELETE' then
    record_id := old.id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values)
    values (auth.uid(), lower(tg_op), tg_table_name, record_id, to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    record_id := new.id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values)
    values (auth.uid(), lower(tg_op), tg_table_name, record_id, to_jsonb(old), to_jsonb(new));
    return new;
  else
    record_id := new.id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values)
    values (auth.uid(), lower(tg_op), tg_table_name, record_id, null, to_jsonb(new));
    return new;
  end if;
end;
$$;

drop trigger if exists audit_clients_changes on public.clients;
create trigger audit_clients_changes
after insert or update or delete on public.clients
for each row execute function public.write_audit_log();

drop trigger if exists audit_projects_changes on public.projects;
create trigger audit_projects_changes
after insert or update or delete on public.projects
for each row execute function public.write_audit_log();

drop trigger if exists audit_requirements_changes on public.requirements;
create trigger audit_requirements_changes
after insert or update or delete on public.requirements
for each row execute function public.write_audit_log();

drop trigger if exists audit_proposals_changes on public.proposals;
create trigger audit_proposals_changes
after insert or update or delete on public.proposals
for each row execute function public.write_audit_log();

drop trigger if exists audit_proposal_reviews_changes on public.proposal_reviews;
create trigger audit_proposal_reviews_changes
after insert or update or delete on public.proposal_reviews
for each row execute function public.write_audit_log();

drop trigger if exists audit_cost_estimations_changes on public.cost_estimations;
create trigger audit_cost_estimations_changes
after insert or update or delete on public.cost_estimations
for each row execute function public.write_audit_log();

drop trigger if exists audit_timeline_predictions_changes on public.timeline_predictions;
create trigger audit_timeline_predictions_changes
after insert or update or delete on public.timeline_predictions
for each row execute function public.write_audit_log();

drop trigger if exists audit_tech_recommendations_changes on public.tech_recommendations;
create trigger audit_tech_recommendations_changes
after insert or update or delete on public.tech_recommendations
for each row execute function public.write_audit_log();

drop trigger if exists audit_project_repository_changes on public.project_repository;
create trigger audit_project_repository_changes
after insert or update or delete on public.project_repository
for each row execute function public.write_audit_log();

drop trigger if exists audit_proposal_templates_changes on public.proposal_templates;
create trigger audit_proposal_templates_changes
after insert or update or delete on public.proposal_templates
for each row execute function public.write_audit_log();

drop trigger if exists audit_integrations_changes on public.integrations;
create trigger audit_integrations_changes
after insert or update or delete on public.integrations
for each row execute function public.write_audit_log();

drop trigger if exists audit_report_configs_changes on public.report_configs;
create trigger audit_report_configs_changes
after insert or update or delete on public.report_configs
for each row execute function public.write_audit_log();
