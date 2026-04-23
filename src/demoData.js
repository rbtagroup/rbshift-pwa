export const demoProfiles = [
  {
    id: 'profile-admin',
    full_name: 'RB Admin',
    email: 'admin@demo.cz',
    role: 'admin',
    phone: '+420 777 000 001',
    active: true,
  },
  {
    id: 'profile-dispatcher',
    full_name: 'Dispečink Hodonín',
    email: 'dispecink@demo.cz',
    role: 'dispatcher',
    phone: '+420 777 000 002',
    active: true,
  },
  {
    id: 'profile-driver-1',
    full_name: 'Marek Novák',
    email: 'marek@demo.cz',
    role: 'driver',
    phone: '+420 777 111 111',
    active: true,
  },
  {
    id: 'profile-driver-2',
    full_name: 'Pavel Dvořák',
    email: 'pavel@demo.cz',
    role: 'driver',
    phone: '+420 777 222 222',
    active: true,
  },
  {
    id: 'profile-driver-3',
    full_name: 'Jan Blaha',
    email: 'jan@demo.cz',
    role: 'driver',
    phone: '+420 777 333 333',
    active: true,
  },
]

export const demoDrivers = [
  {
    id: 'driver-1',
    profile_id: 'profile-driver-1',
    display_name: 'Marek Novák',
    note: 'Preferuje ranní směny.',
    preferred_shift_types: ['R'],
    active: true,
  },
  {
    id: 'driver-2',
    profile_id: 'profile-driver-2',
    display_name: 'Pavel Dvořák',
    note: 'Flexibilní záskoky.',
    preferred_shift_types: ['O', 'N'],
    active: true,
  },
  {
    id: 'driver-3',
    profile_id: 'profile-driver-3',
    display_name: 'Jan Blaha',
    note: 'Více víkendových směn.',
    preferred_shift_types: ['R', 'O'],
    active: true,
  },
]

export const demoVehicles = [
  {
    id: 'vehicle-1',
    name: 'Škoda Superb',
    plate: '7B7 2020',
    status: 'active',
    service_from: null,
    service_to: null,
    note: 'Hlavní sedan',
  },
  {
    id: 'vehicle-2',
    name: 'Tesla Model 3',
    plate: '9T9 3030',
    status: 'active',
    service_from: null,
    service_to: null,
    note: 'VIP vůz',
  },
  {
    id: 'vehicle-3',
    name: 'VW Passat',
    plate: '4H4 4040',
    status: 'service',
    service_from: new Date(Date.now() + 2 * 86400000).toISOString(),
    service_to: new Date(Date.now() + 4 * 86400000).toISOString(),
    note: 'Servis brzd',
  },
]

function isoFor(dayOffset, hours, minutes = 0) {
  const d = new Date()
  d.setHours(hours, minutes, 0, 0)
  d.setDate(d.getDate() + dayOffset)
  return d.toISOString()
}

export const demoShifts = [
  {
    id: 'shift-1',
    driver_id: 'driver-1',
    vehicle_id: 'vehicle-1',
    start_at: isoFor(0, 6, 0),
    end_at: isoFor(0, 14, 0),
    shift_type: 'R',
    status: 'confirmed',
    driver_response: 'accepted',
    note: 'Ranní centrum + nemocnice.',
    created_by: 'profile-dispatcher',
    updated_by: 'profile-dispatcher',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'shift-2',
    driver_id: 'driver-2',
    vehicle_id: 'vehicle-2',
    start_at: isoFor(0, 14, 0),
    end_at: isoFor(0, 22, 0),
    shift_type: 'O',
    status: 'planned',
    driver_response: 'pending',
    note: 'Odpolední město + vlakové příjezdy.',
    created_by: 'profile-dispatcher',
    updated_by: 'profile-dispatcher',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'shift-3',
    driver_id: 'driver-3',
    vehicle_id: 'vehicle-1',
    start_at: isoFor(1, 6, 0),
    end_at: isoFor(1, 14, 0),
    shift_type: 'R',
    status: 'planned',
    driver_response: 'pending',
    note: 'Připravenost na ranní objednávky.',
    created_by: 'profile-dispatcher',
    updated_by: 'profile-dispatcher',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'shift-4',
    driver_id: 'driver-2',
    vehicle_id: 'vehicle-2',
    start_at: isoFor(1, 22, 0),
    end_at: isoFor(2, 6, 0),
    shift_type: 'N',
    status: 'replacement_needed',
    driver_response: 'declined',
    note: 'Potřeba záskoku po odmítnutí.',
    created_by: 'profile-dispatcher',
    updated_by: 'profile-dispatcher',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

export const demoAvailability = [
  {
    id: 'availability-1',
    driver_id: 'driver-1',
    from_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    to_date: new Date(Date.now() + 10 * 86400000).toISOString(),
    availability_type: 'vacation',
    note: 'Dovolená',
  },
  {
    id: 'availability-2',
    driver_id: 'driver-3',
    from_date: new Date(Date.now() + 2 * 86400000).toISOString(),
    to_date: new Date(Date.now() + 2 * 86400000 + 6 * 3600000).toISOString(),
    availability_type: 'unavailable',
    note: 'Nemůže dopoledne',
  },
]

export const demoChangeLog = [
  {
    id: 'log-1',
    entity_type: 'shift',
    entity_id: 'shift-4',
    action: 'updated',
    old_data: { driver_response: 'pending' },
    new_data: { driver_response: 'declined', status: 'replacement_needed' },
    user_id: 'profile-driver-2',
    created_at: new Date().toISOString(),
  },
]

export const demoUsers = [
  {
    label: 'Admin',
    email: 'admin@demo.cz',
    profileId: 'profile-admin',
  },
  {
    label: 'Dispečer',
    email: 'dispecink@demo.cz',
    profileId: 'profile-dispatcher',
  },
  {
    label: 'Řidič Marek',
    email: 'marek@demo.cz',
    profileId: 'profile-driver-1',
  },
  {
    label: 'Řidič Pavel',
    email: 'pavel@demo.cz',
    profileId: 'profile-driver-2',
  },
]

export const emptyState = {
  profiles: demoProfiles,
  drivers: demoDrivers,
  vehicles: demoVehicles,
  shifts: demoShifts,
  availability: demoAvailability,
  changeLog: demoChangeLog,
}
