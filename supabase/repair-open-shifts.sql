-- One-time repair for historical free shifts saved with an incompatible status.
-- Free shifts must be unassigned, active, and in the future so drivers can see and apply for them.

update public.shifts
set
  status = 'planned',
  driver_response = 'pending',
  updated_at = now()
where driver_id is null
  and status not in ('planned', 'cancelled', 'completed');

drop policy if exists "shifts_driver_select_open" on public.shifts;

create policy "shifts_driver_select_open" on public.shifts
for select using (
  public.current_role() = 'driver'
  and driver_id is null
  and status not in ('cancelled', 'completed')
  and end_at >= now()
);
