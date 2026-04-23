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

export function loadDemoState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState
    const parsed = JSON.parse(raw)
    return {
      ...emptyState,
      ...parsed,
    }
  } catch {
    return emptyState
  }
}

export function persistDemoState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
