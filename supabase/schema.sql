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

create or replace function public.current_role()
returns text
language sql
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_driver_id()
returns uuid
language sql
stable
as $$
  select id from public.drivers where profile_id = auth.uid() limit 1;
$$;

alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.shifts enable row level security;
alter table public.driver_availability enable row level security;
alter table public.change_log enable row level security;

create policy "profiles_self_or_staff_select" on public.profiles
for select using (
  auth.uid() = id or public.current_role() in ('admin', 'dispatcher')
);

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

create policy "shifts_driver_update_response" on public.shifts
for update using (driver_id = public.current_driver_id())
with check (driver_id = public.current_driver_id());

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

create policy "change_log_staff_all" on public.change_log
for all using (public.current_role() in ('admin', 'dispatcher'))
with check (public.current_role() in ('admin', 'dispatcher'));

create index if not exists shifts_driver_time_idx on public.shifts(driver_id, start_at, end_at);
create index if not exists shifts_vehicle_time_idx on public.shifts(vehicle_id, start_at, end_at);
create index if not exists availability_driver_time_idx on public.driver_availability(driver_id, from_date, to_date);
