create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'dispatcher', 'driver')),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  note text,
  preferred_shift_types text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate text not null unique,
  status text not null default 'active' check (status in ('active', 'service', 'inactive')),
  service_from timestamptz,
  service_to timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references public.drivers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  shift_type text not null default 'custom' check (shift_type in ('R', 'O', 'N', 'custom')),
  status text not null default 'planned' check (status in ('planned', 'confirmed', 'completed', 'cancelled', 'replacement_needed')),
  driver_response text not null default 'pending' check (driver_response in ('pending', 'accepted', 'declined')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_time_check check (end_at > start_at)
);

create table if not exists public.driver_availability (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  from_date timestamptz not null,
  to_date timestamptz not null,
  availability_type text not null check (availability_type in ('available', 'unavailable', 'vacation', 'sick')),
  note text,
  created_at timestamptz not null default now(),
  constraint driver_availability_time_check check (to_date >= from_date)
);

create table if not exists public.shift_applications (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, driver_id)
);

create table if not exists public.shift_handover_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  from_driver_id uuid not null references public.drivers(id) on delete cascade,
  target_driver_id uuid not null references public.drivers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_handover_not_self_check check (from_driver_id <> target_driver_id)
);

create table if not exists public.change_log (
  id text primary key,
  entity_type text not null,
  entity_id text,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default false,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  critical_only boolean not null default false,
  phone_override text,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.notification_events (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  kind text not null,
  priority text not null default 'normal' check (priority in ('normal', 'critical')),
  title text not null,
  body text not null,
  delivery_channels jsonb not null default '[]'::jsonb,
  delivery_results jsonb not null default '{}'::jsonb,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select drivers.id
  from public.drivers
  join public.profiles on profiles.id = drivers.profile_id
  where drivers.profile_id = auth.uid()
    and drivers.active = true
    and profiles.active = true
  limit 1;
$$;

revoke all on function public.current_role() from public;
revoke all on function public.current_driver_id() from public;
grant execute on function public.current_role() to authenticated;
grant execute on function public.current_driver_id() to authenticated;

alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.shifts enable row level security;
alter table public.driver_availability enable row level security;
alter table public.shift_applications enable row level security;
alter table public.shift_handover_requests enable row level security;
alter table public.change_log enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_events enable row level security;

drop policy if exists "profiles_self_or_staff_select" on public.profiles;
drop policy if exists "profiles_staff_insert" on public.profiles;
drop policy if exists "profiles_staff_update" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
drop policy if exists "drivers_staff_all" on public.drivers;
drop policy if exists "drivers_driver_select_self" on public.drivers;
drop policy if exists "vehicles_staff_all" on public.vehicles;
drop policy if exists "vehicles_all_select" on public.vehicles;
drop policy if exists "shifts_staff_all" on public.shifts;
drop policy if exists "shifts_driver_select_self" on public.shifts;
drop policy if exists "shifts_driver_select_replacement" on public.shifts;
drop policy if exists "shifts_driver_select_open" on public.shifts;
drop policy if exists "shifts_driver_update_response" on public.shifts;
drop policy if exists "shifts_driver_takeover_replacement" on public.shifts;
drop policy if exists "availability_staff_all" on public.driver_availability;
drop policy if exists "availability_driver_select_self" on public.driver_availability;
drop policy if exists "availability_driver_insert_self" on public.driver_availability;
drop policy if exists "availability_driver_update_self" on public.driver_availability;
drop policy if exists "shift_applications_staff_all" on public.shift_applications;
drop policy if exists "shift_applications_driver_select_self" on public.shift_applications;
drop policy if exists "shift_applications_driver_insert_self" on public.shift_applications;
drop policy if exists "shift_handover_staff_all" on public.shift_handover_requests;
drop policy if exists "shift_handover_driver_select_related" on public.shift_handover_requests;
drop policy if exists "change_log_staff_all" on public.change_log;
drop policy if exists "notification_preferences_self_select" on public.notification_preferences;
drop policy if exists "notification_preferences_self_insert" on public.notification_preferences;
drop policy if exists "notification_preferences_self_update" on public.notification_preferences;
drop policy if exists "push_subscriptions_self_select" on public.push_subscriptions;
drop policy if exists "push_subscriptions_self_insert" on public.push_subscriptions;
drop policy if exists "push_subscriptions_self_update" on public.push_subscriptions;
drop policy if exists "push_subscriptions_self_delete" on public.push_subscriptions;
drop policy if exists "notification_events_self_select" on public.notification_events;
drop policy if exists "notification_events_self_update" on public.notification_events;

create policy "profiles_self_or_staff_select" on public.profiles
for select using (
  auth.uid() = id or public.current_role() in ('admin', 'dispatcher')
);

create policy "profiles_staff_insert" on public.profiles
for insert with check (public.current_role() in ('admin', 'dispatcher'));

create policy "profiles_staff_update" on public.profiles
for update using (public.current_role() in ('admin', 'dispatcher'))
with check (public.current_role() in ('admin', 'dispatcher'));

create policy "profiles_self_update" on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy "drivers_staff_all" on public.drivers
for all using (public.current_role() in ('admin', 'dispatcher'))
with check (public.current_role() in ('admin', 'dispatcher'));

create policy "drivers_driver_select_self" on public.drivers
for select using (profile_id = auth.uid());

create policy "vehicles_staff_all" on public.vehicles
for all using (public.current_role() in ('admin', 'dispatcher'))
with check (public.current_role() in ('admin', 'dispatcher'));

create policy "vehicles_all_select" on public.vehicles
for select using (auth.role() = 'authenticated');

create policy "shifts_staff_all" on public.shifts
for all using (public.current_role() in ('admin', 'dispatcher'))
with check (public.current_role() in ('admin', 'dispatcher'));

create policy "shifts_driver_select_self" on public.shifts
for select using (driver_id = public.current_driver_id());

create policy "shifts_driver_select_replacement" on public.shifts
for select using (
  public.current_role() = 'driver'
  and status = 'replacement_needed'
  and driver_id is distinct from public.current_driver_id()
  and (
    not exists (
      select 1
      from public.shift_handover_requests request
      where request.shift_id = shifts.id
        and request.status = 'pending'
    )
    or exists (
      select 1
      from public.shift_handover_requests request
      where request.shift_id = shifts.id
        and request.status = 'pending'
        and request.target_driver_id = public.current_driver_id()
    )
  )
);

create policy "shifts_driver_select_open" on public.shifts
for select using (
  public.current_role() = 'driver'
  and driver_id is null
  and status = 'planned'
);

create policy "availability_staff_all" on public.driver_availability
for all using (public.current_role() in ('admin', 'dispatcher'))
with check (public.current_role() in ('admin', 'dispatcher'));

create policy "availability_driver_select_self" on public.driver_availability
for select using (driver_id = public.current_driver_id());

create policy "availability_driver_insert_self" on public.driver_availability
for insert with check (driver_id = public.current_driver_id());

create policy "availability_driver_update_self" on public.driver_availability
for update using (driver_id = public.current_driver_id())
with check (driver_id = public.current_driver_id());

create policy "shift_applications_staff_all" on public.shift_applications
for all using (public.current_role() in ('admin', 'dispatcher'))
with check (public.current_role() in ('admin', 'dispatcher'));

create policy "shift_applications_driver_select_self" on public.shift_applications
for select using (driver_id = public.current_driver_id());

create policy "shift_applications_driver_insert_self" on public.shift_applications
for insert with check (driver_id = public.current_driver_id());

create policy "shift_handover_staff_all" on public.shift_handover_requests
for all using (public.current_role() in ('admin', 'dispatcher'))
with check (public.current_role() in ('admin', 'dispatcher'));

create policy "shift_handover_driver_select_related" on public.shift_handover_requests
for select using (
  public.current_role() = 'driver'
  and (from_driver_id = public.current_driver_id() or target_driver_id = public.current_driver_id())
);

create policy "change_log_staff_all" on public.change_log
for all using (public.current_role() in ('admin', 'dispatcher'))
with check (public.current_role() in ('admin', 'dispatcher'));

create policy "notification_preferences_self_select" on public.notification_preferences
for select using (user_id = auth.uid());

create policy "notification_preferences_self_insert" on public.notification_preferences
for insert with check (user_id = auth.uid());

create policy "notification_preferences_self_update" on public.notification_preferences
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_subscriptions_self_select" on public.push_subscriptions
for select using (user_id = auth.uid());

create policy "push_subscriptions_self_insert" on public.push_subscriptions
for insert with check (user_id = auth.uid());

create policy "push_subscriptions_self_update" on public.push_subscriptions
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_subscriptions_self_delete" on public.push_subscriptions
for delete using (user_id = auth.uid());

create policy "notification_events_self_select" on public.notification_events
for select using (user_id = auth.uid());

create policy "notification_events_self_update" on public.notification_events
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists shifts_driver_time_idx on public.shifts(driver_id, start_at, end_at);
create index if not exists shifts_vehicle_time_idx on public.shifts(vehicle_id, start_at, end_at);
create index if not exists availability_driver_time_idx on public.driver_availability(driver_id, from_date, to_date);
create index if not exists shift_applications_shift_idx on public.shift_applications(shift_id, status);
create index if not exists shift_applications_driver_idx on public.shift_applications(driver_id, status);
create index if not exists shift_handover_shift_idx on public.shift_handover_requests(shift_id, status);
create index if not exists shift_handover_target_idx on public.shift_handover_requests(target_driver_id, status);
create unique index if not exists shift_handover_pending_shift_idx
on public.shift_handover_requests(shift_id)
where status = 'pending';
create index if not exists notification_events_user_created_idx on public.notification_events(user_id, created_at desc);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
