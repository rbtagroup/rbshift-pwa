import { emptyState } from './demoData'
import { toInputValue } from './utils'

export const STORAGE_KEY = 'rbshift-demo-state-v1'
export const DEMO_USER_KEY = 'rbshift-demo-user-v1'

export const DEFAULT_SHIFT_FORM = () => {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(6)
  const end = new Date(start)
  end.setHours(14)

  return {
    id: null,
    driver_id: '',
    vehicle_id: '',
    start_at: toInputValue(start),
    end_at: toInputValue(end),
    shift_type: 'R',
    status: 'planned',
    driver_response: 'pending',
    note: '',
  }
}

export const DEFAULT_AVAILABILITY_FORM = () => {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setHours(23, 59, 0, 0)
  return {
    id: null,
    driver_id: '',
    from_date: toInputValue(from),
    to_date: toInputValue(to),
    availability_type: 'vacation',
    note: '',
  }
}

export const DEFAULT_VEHICLE_FORM = {
  id: null,
  name: '',
  plate: '',
  status: 'active',
  service_from: '',
  service_to: '',
  note: '',
}

export const DEFAULT_DRIVER_FORM = {
  id: null,
  profile_id: '',
  display_name: '',
  note: '',
  preferred_shift_types: [],
  active: true,
}

export const DEFAULT_PROFILE_FORM = {
  id: '',
  full_name: '',
  email: '',
  role: 'dispatcher',
  phone: '',
  active: true,
  auth_password: '',
}

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  push_enabled: false,
  email_enabled: true,
  sms_enabled: false,
  critical_only: false,
  phone_override: '',
}

export function loadDemoState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState
    const parsed = JSON.parse(raw)
    const merged = {
      ...emptyState,
      ...parsed,
    }
    if ((parsed.demo_seed_version ?? 1) < emptyState.demo_seed_version) {
      const hasOpenShift = (merged.shifts ?? []).some((shift) => (
        !shift.driver_id &&
        shift.status === 'planned' &&
        new Date(shift.end_at).getTime() >= Date.now()
      ))
      const seedOpenShift = emptyState.shifts.find((shift) => shift.id === 'shift-open-1')
      if (!hasOpenShift && seedOpenShift) {
        merged.shifts = [seedOpenShift, ...(merged.shifts ?? [])]
      }
      merged.demo_seed_version = emptyState.demo_seed_version
    }
    return merged
  } catch {
    return emptyState
  }
}

export function persistDemoState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
