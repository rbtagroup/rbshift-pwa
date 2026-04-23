export const ROLE_LABEL = {
  admin: 'Admin',
  dispatcher: 'Dispečer',
  driver: 'Řidič',
}

export const SHIFT_TYPE_LABEL = {
  R: 'Ranní',
  O: 'Odpolední',
  N: 'Noční',
  custom: 'Vlastní',
}

export const STATUS_LABEL = {
  planned: 'Plánováno',
  confirmed: 'Potvrzeno',
  completed: 'Odjeto',
  cancelled: 'Zrušeno',
  replacement_needed: 'Potřebuje záskok',
}

export const RESPONSE_LABEL = {
  pending: 'Čeká na potvrzení',
  accepted: 'Přijato',
  declined: 'Odmítnuto',
}

export const AVAILABILITY_LABEL = {
  available: 'Dostupný',
  unavailable: 'Nedostupný',
  vacation: 'Dovolená',
  sick: 'Nemoc',
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function formatDate(value, opts = {}) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...opts,
  }).format(new Date(value))
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function addDays(date, amount) {
  const d = new Date(date)
  d.setDate(d.getDate() + amount)
  return d
}

export function isBetween(target, start, end) {
  const value = new Date(target).getTime()
  return value >= new Date(start).getTime() && value <= new Date(end).getTime()
}

export function overlaps(startA, endA, startB, endB) {
  return new Date(startA).getTime() < new Date(endB).getTime() && new Date(endA).getTime() > new Date(startB).getTime()
}

export function makeShiftTitle(shiftType) {
  return SHIFT_TYPE_LABEL[shiftType] ?? 'Směna'
}

export function shiftTypeFromRange(startAt, endAt) {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const duration = (end - start) / 3600000
  if (start.getHours() === 6 && duration === 8) return 'R'
  if (start.getHours() === 14 && duration === 8) return 'O'
  if (start.getHours() === 22 && duration === 8) return 'N'
  return 'custom'
}

export function driverStats(shifts, drivers) {
  return drivers.map((driver) => {
    const items = shifts.filter((shift) => shift.driver_id === driver.id)
    const hours = items.reduce((acc, item) => acc + (new Date(item.end_at) - new Date(item.start_at)) / 3600000, 0)
    const nights = items.filter((item) => item.shift_type === 'N').length
    const weekends = items.filter((item) => {
      const day = new Date(item.start_at).getDay()
      return day === 0 || day === 6
    }).length

    return {
      driver,
      count: items.length,
      hours,
      nights,
      weekends,
    }
  })
}

export function getProblems(shifts) {
  return shifts.filter((shift) => shift.status === 'replacement_needed' || shift.driver_response === 'pending' || shift.driver_response === 'declined' || !shift.driver_id || !shift.vehicle_id)
}

export function normalizeDateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 16) : ''
}

export function toInputValue(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
