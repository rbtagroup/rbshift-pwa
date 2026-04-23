import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AVAILABILITY_LABEL,
  addDays,
  driverStats,
  endOfDay,
  formatDate,
  formatDateTime,
  generateId,
  generateUuid,
  getProblems,
  overlaps,
  startOfDay,
  toInputValue,
  downloadCsv,
} from '../utils'
import { hasSupabaseConfig, supabase } from '../supabaseClient'
import {
  DEFAULT_AVAILABILITY_FORM,
  DEFAULT_DRIVER_FORM,
  DEFAULT_PROFILE_FORM,
  DEFAULT_SHIFT_FORM,
  DEFAULT_VEHICLE_FORM,
  DEMO_USER_KEY,
  loadDemoState,
  persistDemoState,
} from '../defaults'
import { useFlash } from './useFlash'

const AUTH_BOOTSTRAP_TIMEOUT_MS = 8000

function withTimeout(promise, message) {
  let timeoutId = null

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(message)), AUTH_BOOTSTRAP_TIMEOUT_MS)
    }),
  ]).finally(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId)
    }
  })
}

function isInvalidDate(value) {
  return Number.isNaN(new Date(value).getTime())
}

export function useShiftApp() {
  const hydrationRef = useRef({ userId: null, promise: null })
  const [demoState, setDemoState] = useState(() => loadDemoState())
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const { message, error, setMessage, setError, setFlash } = useFlash()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [calendarView, setCalendarView] = useState('week')
  const [shiftForm, setShiftForm] = useState(DEFAULT_SHIFT_FORM())
  const [availabilityForm, setAvailabilityForm] = useState(DEFAULT_AVAILABILITY_FORM())
  const [vehicleForm, setVehicleForm] = useState(DEFAULT_VEHICLE_FORM)
  const [driverForm, setDriverForm] = useState(DEFAULT_DRIVER_FORM)
  const [profileForm, setProfileForm] = useState(DEFAULT_PROFILE_FORM)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [filters, setFilters] = useState({
    driverId: '',
    vehicleId: '',
    status: '',
    response: '',
  })

  const mode = hasSupabaseConfig ? 'supabase' : 'demo'

  useEffect(() => {
    if (mode === 'demo') {
      const savedProfileId = localStorage.getItem(DEMO_USER_KEY)
      if (savedProfileId) {
        const existing = demoState.profiles.find((item) => item.id === savedProfileId)
        if (existing) {
          setProfile(existing)
          setActiveTab(existing.role === 'driver' ? 'today' : 'dashboard')
        }
      }
      setLoading(false)
      return
    }

    let mounted = true
    let authResolved = false

    const applySession = async (nextSession, { clearError = true } = {}) => {
      if (!mounted) return

      if (clearError) {
        setError('')
      }

      setSession(nextSession ?? null)

      if (!nextSession?.user?.id) {
        setProfile(null)
        setLoading(false)
        authResolved = true
        return
      }

      await hydrateSupabaseUser(nextSession.user.id)
      if (!mounted) return
      authResolved = true
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      try {
        await applySession(nextSession)
      } catch (authStateError) {
        if (!mounted) return
        setProfile(null)
        setError(authStateError.message || 'Nepodařilo se obnovit přihlášení.')
        setLoading(false)
      }
    })

    withTimeout(
      supabase.auth.getSession(),
      'Inicializace přihlášení trvá příliš dlouho. Zkus stránku obnovit.'
    )
      .then(async ({ data, error: authError }) => {
        if (!mounted || authResolved) return

        if (authError) {
          setError(authError.message)
          setLoading(false)
          return
        }

        await applySession(data.session)
      })
      .catch((bootstrapError) => {
        if (!mounted || authResolved) return
        setProfile(null)
        setError(bootstrapError.message || 'Nepodařilo se inicializovat přihlášení.')
        setLoading(false)
      })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode === 'demo') persistDemoState(demoState)
  }, [demoState, mode])

  const state = useMemo(() => demoState, [demoState])
  const drivers = state.drivers ?? []
  const vehicles = state.vehicles ?? []
  const shifts = state.shifts ?? []
  const availability = state.availability ?? []
  const changeLog = state.changeLog ?? []
  const profiles = state.profiles ?? []

  const driversMap = useMemo(() => Object.fromEntries(drivers.map((item) => [item.id, item])), [drivers])
  const vehiclesMap = useMemo(() => Object.fromEntries(vehicles.map((item) => [item.id, item])), [vehicles])
  const driverByProfileId = useMemo(() => Object.fromEntries(drivers.filter((item) => item.profile_id).map((item) => [item.profile_id, item])), [drivers])
  const currentDriver = profile?.role === 'driver' ? driverByProfileId[profile.id] : null

  const enrichedShifts = useMemo(() => {
    return [...shifts]
      .map((shift) => ({
        ...shift,
        driver: driversMap[shift.driver_id],
        vehicle: vehiclesMap[shift.vehicle_id],
      }))
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  }, [shifts, driversMap, vehiclesMap])

  const visibleShifts = useMemo(() => {
    const base = profile?.role === 'driver' && currentDriver
      ? enrichedShifts.filter((shift) => shift.driver_id === currentDriver.id)
      : enrichedShifts

    return base.filter((shift) => {
      if (filters.driverId && shift.driver_id !== filters.driverId) return false
      if (filters.vehicleId && shift.vehicle_id !== filters.vehicleId) return false
      if (filters.status && shift.status !== filters.status) return false
      if (filters.response && shift.driver_response !== filters.response) return false
      return true
    })
  }, [currentDriver, enrichedShifts, filters, profile?.role])

  const todayShifts = useMemo(() => {
    const from = startOfDay(new Date())
    const to = endOfDay(new Date())
    return visibleShifts.filter((shift) => overlaps(shift.start_at, shift.end_at, from, to))
  }, [visibleShifts])

  const upcomingShift = useMemo(() => {
    const now = Date.now()
    return visibleShifts.find((shift) => new Date(shift.end_at).getTime() >= now)
  }, [visibleShifts])

  const problems = useMemo(() => getProblems(enrichedShifts), [enrichedShifts])
  const stats = useMemo(() => driverStats(enrichedShifts, drivers), [enrichedShifts, drivers])

  const groupedCalendar = useMemo(() => {
    const now = new Date()
    let start = startOfDay(now)
    let end = endOfDay(now)

    if (calendarView === 'week') end = endOfDay(addDays(now, 6))
    if (calendarView === 'month') end = endOfDay(addDays(now, 29))

    const items = visibleShifts.filter((shift) => overlaps(shift.start_at, shift.end_at, start, end))
    const groups = new Map()

    for (const shift of items) {
      const key = formatDate(shift.start_at)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(shift)
    }

    return [...groups.entries()]
  }, [calendarView, visibleShifts])

  const thisWeekShifts = useMemo(() => {
    const start = startOfDay(new Date())
    const end = endOfDay(addDays(start, 6))
    return enrichedShifts.filter((shift) => overlaps(shift.start_at, shift.end_at, start, end))
  }, [enrichedShifts])

  const onboardingItems = useMemo(() => {
    return [
      { id: 'profiles', label: 'Máte založené uživatele v Auth i Profiles', done: profiles.length > 0 },
      { id: 'drivers', label: 'Máte aktivní řidiče', done: drivers.some((item) => item.active) },
      { id: 'vehicles', label: 'Máte aktivní vozidla', done: vehicles.some((item) => item.status === 'active') },
      { id: 'shifts', label: 'Máte naplánovanou alespoň jednu směnu', done: shifts.length > 0 },
    ]
  }, [drivers, profiles, shifts.length, vehicles])

  const notifications = useMemo(() => {
    const now = Date.now()

    if (!profile) return []

    if (profile.role === 'driver') {
      const items = []

      if (!currentDriver) {
        items.push({
          id: 'driver-profile-missing',
          tone: 'danger',
          title: 'Chybí řidičský záznam',
          description: 'K tomuto účtu zatím není napojený řidičský profil. Bez něj neuvidíš svoje směny.',
          actionLabel: 'Otevřít směny',
          targetTab: 'my-shifts',
        })
      }

      visibleShifts
        .filter((shift) => new Date(shift.end_at).getTime() >= now)
        .slice(0, 6)
        .forEach((shift) => {
          const startsInMs = new Date(shift.start_at).getTime() - now

          if (shift.driver_response === 'pending') {
            items.push({
              id: `shift-pending-${shift.id}`,
              tone: 'warning',
              title: 'Směna čeká na potvrzení',
              description: `${formatDateTime(shift.start_at)} · ${shift.vehicle?.plate ?? 'bez auta'} · ${shift.note || 'Otevři detail a potvrď nebo odmítni ji.'}`,
              actionLabel: 'Otevřít dnešek',
              targetTab: 'today',
            })
          } else if (startsInMs > 0 && startsInMs <= 24 * 3600000) {
            items.push({
              id: `shift-soon-${shift.id}`,
              tone: 'info',
              title: 'Blíží se tvoje směna',
              description: `${formatDateTime(shift.start_at)} · ${shift.vehicle?.plate ?? 'bez auta'}`,
              actionLabel: 'Moje směny',
              targetTab: 'my-shifts',
            })
          }
        })

      return items
    }

    const items = []

    problems.slice(0, 6).forEach((shift) => {
      items.push({
        id: `problem-${shift.id}`,
        tone: shift.status === 'replacement_needed' || shift.driver_response === 'declined' ? 'danger' : 'warning',
        title: shift.status === 'replacement_needed' || shift.driver_response === 'declined' ? 'Směna potřebuje záskok' : 'Směna čeká na potvrzení',
        description: `${formatDateTime(shift.start_at)} · ${shift.driver?.display_name ?? 'Bez řidiče'} · ${shift.vehicle?.plate ?? 'Bez auta'}`,
        actionLabel: 'Otevřít směnu',
        shiftId: shift.id,
      })
    })

    vehicles
      .filter((vehicle) => vehicle.status === 'service')
      .slice(0, 3)
      .forEach((vehicle) => {
        items.push({
          id: `vehicle-service-${vehicle.id}`,
          tone: 'info',
          title: 'Vozidlo je v servisu',
          description: `${vehicle.name} · ${vehicle.plate}${vehicle.service_to ? ` do ${formatDateTime(vehicle.service_to)}` : ''}`,
          actionLabel: 'Auta',
          targetTab: 'vehicles',
        })
      })

    onboardingItems
      .filter((item) => !item.done)
      .forEach((item) => {
        items.push({
          id: `onboarding-${item.id}`,
          tone: 'warning',
          title: 'Chybí část nastavení',
          description: item.label,
          actionLabel: 'Dashboard',
          targetTab: 'dashboard',
        })
      })

    return items
  }, [currentDriver, onboardingItems, problems, profile, vehicles, visibleShifts])

  const unreadNotificationCount = notifications.filter((item) => item.tone !== 'info').length || notifications.length

  async function hydrateSupabaseUser(userId) {
    if (hydrationRef.current.userId === userId && hydrationRef.current.promise) {
      return hydrationRef.current.promise
    }

    setLoading(true)
    setError('')
    const hydrationPromise = (async () => {
      try {
        const { data: userProfile, error: profileError } = await withTimeout(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single(),
          'Načtení uživatelského profilu trvá příliš dlouho.'
        )

        if (profileError) {
          setError('Nepodařilo se načíst profil uživatele. Zkontroluj tabulku profiles a RLS politiky.')
          return false
        }

        setProfile(userProfile)
        setActiveTab(userProfile.role === 'driver' ? 'today' : 'dashboard')
        void fetchSupabaseData(userProfile)
        return true
      } catch (profileLoadError) {
        setProfile(null)
        setError(profileLoadError.message || 'Načtení uživatelského profilu selhalo.')
        return false
      } finally {
        if (hydrationRef.current.userId === userId) {
          hydrationRef.current = { userId: null, promise: null }
        }
        setLoading(false)
      }
    })()

    hydrationRef.current = { userId, promise: hydrationPromise }
    return hydrationPromise
  }

  async function fetchSupabaseData(currentProfile = profile) {
    setDataLoading(true)
    try {
      const isStaff = ['admin', 'dispatcher'].includes(currentProfile?.role ?? '')
      const [profilesRes, driversRes, vehiclesRes, shiftsRes, availabilityRes, changeLogRes] = await withTimeout(
        Promise.all([
          supabase.from('profiles').select('*').order('full_name'),
          supabase.from('drivers').select('*').order('display_name'),
          supabase.from('vehicles').select('*').order('name'),
          supabase.from('shifts').select('*').order('start_at'),
          supabase.from('driver_availability').select('*').order('from_date'),
          isStaff
            ? supabase.from('change_log').select('*').order('created_at', { ascending: false }).limit(100)
            : Promise.resolve({ data: [], error: null }),
        ]),
        'Načtení provozních dat trvá příliš dlouho.'
      )

      const results = [profilesRes, driversRes, vehiclesRes, shiftsRes, availabilityRes, changeLogRes]
      const firstError = results.find((item) => item.error)?.error
      if (firstError) {
        setError(firstError.message)
        return false
      }

      setDemoState({
        profiles: profilesRes.data ?? [],
        drivers: driversRes.data ?? [],
        vehicles: vehiclesRes.data ?? [],
        shifts: shiftsRes.data ?? [],
        availability: availabilityRes.data ?? [],
        changeLog: changeLogRes.data ?? [],
      })

      return true
    } catch (dataLoadError) {
      setError(dataLoadError.message || 'Načtení provozních dat selhalo.')
      return false
    } finally {
      setDataLoading(false)
    }
  }

  function resetForms() {
    setShiftForm(DEFAULT_SHIFT_FORM())
    setAvailabilityForm(DEFAULT_AVAILABILITY_FORM())
    setVehicleForm(DEFAULT_VEHICLE_FORM)
    setDriverForm(DEFAULT_DRIVER_FORM)
    setProfileForm(DEFAULT_PROFILE_FORM)
  }

  function validateShift(form) {
    if (!form.driver_id) return 'Vyber řidiče.'
    if (!form.vehicle_id) return 'Vyber vozidlo.'
    if (!form.start_at || !form.end_at) return 'Vyplň začátek a konec směny.'
    if (isInvalidDate(form.start_at) || isInvalidDate(form.end_at)) return 'Vyplň platné datum a čas směny.'
    if (new Date(form.end_at) <= new Date(form.start_at)) return 'Konec směny musí být po začátku.'

    const otherShifts = enrichedShifts.filter((item) => item.id !== form.id)
    const driverOverlap = otherShifts.find((item) => item.driver_id === form.driver_id && overlaps(item.start_at, item.end_at, form.start_at, form.end_at))
    if (driverOverlap) return 'Řidič už má v tomto čase jinou směnu.'

    const vehicleOverlap = otherShifts.find((item) => item.vehicle_id === form.vehicle_id && overlaps(item.start_at, item.end_at, form.start_at, form.end_at))
    if (vehicleOverlap) return 'Vozidlo je ve stejný čas už přiřazené jiné směně.'

    const selectedVehicle = vehiclesMap[form.vehicle_id]
    if (selectedVehicle?.status === 'service' && selectedVehicle.service_from && selectedVehicle.service_to) {
      if (overlaps(selectedVehicle.service_from, selectedVehicle.service_to, form.start_at, form.end_at)) {
        return 'Vybrané vozidlo je v servisu.'
      }
    }

    const availabilityConflict = availability.find((item) => item.driver_id === form.driver_id && item.availability_type !== 'available' && overlaps(item.from_date, item.to_date, form.start_at, form.end_at))
    if (availabilityConflict) {
      return `Řidič má v tomto termínu blokaci: ${AVAILABILITY_LABEL[availabilityConflict.availability_type]}.`
    }

    return ''
  }

  async function appendLog(entry) {
    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        changeLog: [{ id: generateId('log'), created_at: new Date().toISOString(), ...entry }, ...current.changeLog].slice(0, 200),
      }))
      return
    }

    const { error: logError } = await supabase.from('change_log').insert([{ id: generateId('log'), created_at: new Date().toISOString(), ...entry }])
    if (logError) {
      console.warn('Nepodařilo se zapsat audit log.', logError)
    }
  }

  async function handleSaveShift(event) {
    event.preventDefault()
    setBusy(true)
    const validation = validateShift(shiftForm)
    if (validation) {
      setFlash('error', validation)
      setBusy(false)
      return
    }

    const payload = {
      driver_id: shiftForm.driver_id,
      vehicle_id: shiftForm.vehicle_id,
      shift_type: shiftForm.shift_type,
      status: shiftForm.status,
      driver_response: shiftForm.driver_response,
      note: shiftForm.note.trim(),
      start_at: new Date(shiftForm.start_at).toISOString(),
      end_at: new Date(shiftForm.end_at).toISOString(),
      updated_by: profile?.id ?? null,
      updated_at: new Date().toISOString(),
    }

    const previous = shiftForm.id ? shifts.find((item) => item.id === shiftForm.id) : null

    if (mode === 'demo') {
      setDemoState((current) => {
        const nextShifts = shiftForm.id
          ? current.shifts.map((item) => (item.id === shiftForm.id ? { ...item, ...payload } : item))
          : [{ ...payload, id: generateId('shift'), created_by: profile?.id ?? null, created_at: new Date().toISOString() }, ...current.shifts]
        return { ...current, shifts: nextShifts }
      })
      await appendLog({
        entity_type: 'shift',
        entity_id: shiftForm.id ?? 'new',
        action: shiftForm.id ? 'updated' : 'created',
        old_data: previous ?? null,
        new_data: payload,
        user_id: profile?.id ?? null,
      })
      setFlash('success', shiftForm.id ? 'Směna byla upravena.' : 'Směna byla vytvořena.')
      setShiftForm(DEFAULT_SHIFT_FORM())
      setBusy(false)
      return
    }

    const query = shiftForm.id
      ? supabase.from('shifts').update(payload).eq('id', shiftForm.id)
      : supabase.from('shifts').insert([{
        id: generateUuid(),
        ...payload,
        created_by: profile?.id ?? null,
        created_at: new Date().toISOString(),
      }])

    const { error: saveError } = await query
    if (saveError) {
      setFlash('error', saveError.message)
      setBusy(false)
      return
    }

    await appendLog({
      entity_type: 'shift',
      entity_id: shiftForm.id ?? 'new',
      action: shiftForm.id ? 'updated' : 'created',
      old_data: previous ?? null,
      new_data: payload,
      user_id: profile?.id ?? null,
    })
    await fetchSupabaseData()
    setShiftForm(DEFAULT_SHIFT_FORM())
    setFlash('success', shiftForm.id ? 'Směna byla upravena.' : 'Směna byla vytvořena.')
    setBusy(false)
  }

  async function handleDeleteShift(id) {
    if (!window.confirm('Opravdu smazat tuto směnu?')) return
    setBusy(true)

    const previous = shifts.find((item) => item.id === id)

    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        shifts: current.shifts.filter((item) => item.id !== id),
      }))
      await appendLog({ entity_type: 'shift', entity_id: id, action: 'deleted', old_data: previous, new_data: null, user_id: profile?.id ?? null })
      setFlash('success', 'Směna byla smazána.')
      setBusy(false)
      return
    }

    const { error: deleteError } = await supabase.from('shifts').delete().eq('id', id)
    if (deleteError) {
      setFlash('error', deleteError.message)
      setBusy(false)
      return
    }
    await appendLog({ entity_type: 'shift', entity_id: id, action: 'deleted', old_data: previous, new_data: null, user_id: profile?.id ?? null })
    await fetchSupabaseData()
    setFlash('success', 'Směna byla smazána.')
    setBusy(false)
  }

  async function handleShiftResponse(shift, response) {
    setBusy(true)
    const nextStatus = response === 'accepted' ? 'confirmed' : 'replacement_needed'
    const patch = {
      driver_response: response,
      status: nextStatus,
      updated_by: profile?.id ?? null,
      updated_at: new Date().toISOString(),
    }

    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        shifts: current.shifts.map((item) => (item.id === shift.id ? { ...item, ...patch } : item)),
      }))
      await appendLog({ entity_type: 'shift', entity_id: shift.id, action: 'response', old_data: shift, new_data: patch, user_id: profile?.id ?? null })
      setFlash('success', response === 'accepted' ? 'Směna potvrzena.' : 'Směna odmítnuta a označena pro záskok.')
      setBusy(false)
      return
    }

    const { error: updateError } = await supabase.from('shifts').update(patch).eq('id', shift.id)
    if (updateError) {
      setFlash('error', updateError.message)
      setBusy(false)
      return
    }
    await appendLog({ entity_type: 'shift', entity_id: shift.id, action: 'response', old_data: shift, new_data: patch, user_id: profile?.id ?? null })
    await fetchSupabaseData()
    setFlash('success', response === 'accepted' ? 'Směna potvrzena.' : 'Směna odmítnuta a označena pro záskok.')
    setBusy(false)
  }

  async function handleSaveAvailability(event) {
    event.preventDefault()
    setBusy(true)

    if (!availabilityForm.driver_id) {
      setFlash('error', 'Vyber řidiče.')
      setBusy(false)
      return
    }
    if (!availabilityForm.from_date || !availabilityForm.to_date || isInvalidDate(availabilityForm.from_date) || isInvalidDate(availabilityForm.to_date)) {
      setFlash('error', 'Vyplň platné datum a čas nepřítomnosti.')
      setBusy(false)
      return
    }
    if (new Date(availabilityForm.to_date) < new Date(availabilityForm.from_date)) {
      setFlash('error', 'Konec blokace musí být po začátku.')
      setBusy(false)
      return
    }

    const payload = {
      driver_id: availabilityForm.driver_id,
      availability_type: availabilityForm.availability_type,
      note: availabilityForm.note.trim(),
      from_date: new Date(availabilityForm.from_date).toISOString(),
      to_date: new Date(availabilityForm.to_date).toISOString(),
    }

    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        availability: availabilityForm.id
          ? current.availability.map((item) => (item.id === availabilityForm.id ? { ...item, ...payload } : item))
          : [{ ...payload, id: generateId('availability') }, ...current.availability],
      }))
      await appendLog({ entity_type: 'availability', entity_id: availabilityForm.id ?? 'new', action: availabilityForm.id ? 'updated' : 'created', old_data: null, new_data: payload, user_id: profile?.id ?? null })
      setAvailabilityForm(DEFAULT_AVAILABILITY_FORM())
      setFlash('success', 'Dostupnost byla uložena.')
      setBusy(false)
      return
    }

    const query = availabilityForm.id
      ? supabase.from('driver_availability').update(payload).eq('id', availabilityForm.id)
      : supabase.from('driver_availability').insert([{ id: generateUuid(), ...payload }])

    const { error: saveError } = await query
    if (saveError) {
      setFlash('error', saveError.message)
      setBusy(false)
      return
    }
    await appendLog({ entity_type: 'availability', entity_id: availabilityForm.id ?? 'new', action: availabilityForm.id ? 'updated' : 'created', old_data: null, new_data: payload, user_id: profile?.id ?? null })
    await fetchSupabaseData()
    setAvailabilityForm(DEFAULT_AVAILABILITY_FORM())
    setFlash('success', 'Dostupnost byla uložena.')
    setBusy(false)
  }

  async function handleSaveVehicle(event) {
    event.preventDefault()
    setBusy(true)
    const normalizedName = vehicleForm.name.trim()
    const normalizedPlate = vehicleForm.plate.trim().toUpperCase()

    if (!normalizedName || !normalizedPlate) {
      setFlash('error', 'Vyplň název i SPZ vozidla.')
      setBusy(false)
      return
    }
    if ((vehicleForm.service_from && isInvalidDate(vehicleForm.service_from)) || (vehicleForm.service_to && isInvalidDate(vehicleForm.service_to))) {
      setFlash('error', 'Vyplň platné datum servisu.')
      setBusy(false)
      return
    }
    if (vehicleForm.service_from && vehicleForm.service_to && new Date(vehicleForm.service_to) < new Date(vehicleForm.service_from)) {
      setFlash('error', 'Konec servisu musí být po začátku.')
      setBusy(false)
      return
    }

    const payload = {
      name: normalizedName,
      plate: normalizedPlate,
      status: vehicleForm.status,
      note: vehicleForm.note.trim(),
      service_from: vehicleForm.service_from ? new Date(vehicleForm.service_from).toISOString() : null,
      service_to: vehicleForm.service_to ? new Date(vehicleForm.service_to).toISOString() : null,
    }

    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        vehicles: vehicleForm.id
          ? current.vehicles.map((item) => (item.id === vehicleForm.id ? { ...item, ...payload } : item))
          : [{ ...payload, id: generateId('vehicle') }, ...current.vehicles],
      }))
      await appendLog({ entity_type: 'vehicle', entity_id: vehicleForm.id ?? 'new', action: vehicleForm.id ? 'updated' : 'created', old_data: null, new_data: payload, user_id: profile?.id ?? null })
      setVehicleForm(DEFAULT_VEHICLE_FORM)
      setFlash('success', 'Vozidlo bylo uloženo.')
      setBusy(false)
      return
    }

    const query = vehicleForm.id
      ? supabase.from('vehicles').update(payload).eq('id', vehicleForm.id)
      : supabase.from('vehicles').insert([{ id: generateUuid(), ...payload }])

    const { error: saveError } = await query
    if (saveError) {
      setFlash('error', saveError.message)
      setBusy(false)
      return
    }
    await appendLog({ entity_type: 'vehicle', entity_id: vehicleForm.id ?? 'new', action: vehicleForm.id ? 'updated' : 'created', old_data: null, new_data: payload, user_id: profile?.id ?? null })
    await fetchSupabaseData()
    setVehicleForm(DEFAULT_VEHICLE_FORM)
    setFlash('success', 'Vozidlo bylo uloženo.')
    setBusy(false)
  }

  async function handleSaveDriver(event) {
    event.preventDefault()
    setBusy(true)
    const normalizedDisplayName = driverForm.display_name.trim()

    if (!normalizedDisplayName) {
      setFlash('error', 'Vyplň jméno řidiče.')
      setBusy(false)
      return
    }

    const payload = {
      display_name: normalizedDisplayName,
      note: driverForm.note.trim(),
      preferred_shift_types: driverForm.preferred_shift_types,
      active: driverForm.active,
      profile_id: driverForm.profile_id || null,
    }

    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        drivers: driverForm.id
          ? current.drivers.map((item) => (item.id === driverForm.id ? { ...item, ...payload } : item))
          : [{ ...payload, id: generateId('driver') }, ...current.drivers],
      }))
      await appendLog({ entity_type: 'driver', entity_id: driverForm.id ?? 'new', action: driverForm.id ? 'updated' : 'created', old_data: null, new_data: payload, user_id: profile?.id ?? null })
      setDriverForm(DEFAULT_DRIVER_FORM)
      setFlash('success', 'Řidič byl uložen.')
      setBusy(false)
      return
    }

    const query = driverForm.id
      ? supabase.from('drivers').update(payload).eq('id', driverForm.id)
      : supabase.from('drivers').insert([{ id: generateUuid(), ...payload }])

    const { error: saveError } = await query
    if (saveError) {
      setFlash('error', saveError.message)
      setBusy(false)
      return
    }
    await appendLog({ entity_type: 'driver', entity_id: driverForm.id ?? 'new', action: driverForm.id ? 'updated' : 'created', old_data: null, new_data: payload, user_id: profile?.id ?? null })
    await fetchSupabaseData()
    setDriverForm(DEFAULT_DRIVER_FORM)
    setFlash('success', 'Řidič byl uložen.')
    setBusy(false)
  }

  async function handleSaveProfile(event) {
    event.preventDefault()
    setBusy(true)

    const normalizedId = profileForm.id.trim()
    const normalizedName = profileForm.full_name.trim()
    const normalizedEmail = profileForm.email.trim().toLowerCase()
    const normalizedPassword = profileForm.auth_password.trim()

    if (!normalizedId && !normalizedPassword) {
      setFlash('error', 'Vyplň UUID uživatele z Auth -> Users, nebo zadej heslo pro vytvoření auth účtu.')
      setBusy(false)
      return
    }
    if (!normalizedName) {
      setFlash('error', 'Vyplň jméno uživatele.')
      setBusy(false)
      return
    }
    if (!normalizedEmail) {
      setFlash('error', 'Vyplň e-mail uživatele.')
      setBusy(false)
      return
    }
    if (!['admin', 'dispatcher', 'driver'].includes(profileForm.role)) {
      setFlash('error', 'Vyber platnou roli uživatele.')
      setBusy(false)
      return
    }

    let profileId = normalizedId
    if (!profileId && mode === 'demo') {
      profileId = generateId('profile')
    }

    if (!profileId) {
      const response = await fetch('/api/admin-auth-user', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          action: 'create',
          email: normalizedEmail,
          password: normalizedPassword,
        }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.user?.id) {
        setFlash('error', result?.error ?? 'Nepodařilo se vytvořit auth účet.')
        setBusy(false)
        return
      }
      profileId = result.user.id
    }

    const payload = {
      id: profileId,
      full_name: normalizedName,
      email: normalizedEmail,
      role: profileForm.role,
      phone: profileForm.phone.trim() || null,
      active: profileForm.active,
    }

    const previous = profiles.find((item) => item.id === profileId) ?? null

    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        profiles: previous
          ? current.profiles.map((item) => (item.id === profileId ? { ...item, ...payload } : item))
          : [{ ...payload, created_at: new Date().toISOString() }, ...current.profiles],
      }))
      if (profileId === profile?.id) {
        setProfile((current) => (current ? { ...current, ...payload } : current))
      }
      await appendLog({
        entity_type: 'profile',
        entity_id: profileId,
        action: previous ? 'updated' : 'created',
        old_data: previous,
        new_data: payload,
        user_id: profile?.id ?? null,
      })
      setProfileForm(DEFAULT_PROFILE_FORM)
      setFlash('success', previous ? 'Uživatel byl upraven.' : 'Uživatel byl vytvořen.')
      setBusy(false)
      return
    }

    const response = await fetch('/api/admin-auth-user', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        action: 'upsert-profile',
        profile: payload,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      setFlash('error', result?.error ?? 'Nepodařilo se uložit profil uživatele.')
      setBusy(false)
      return
    }

    if (profileId === profile?.id) {
      setProfile((current) => (current ? { ...current, ...payload } : current))
    }
    await appendLog({
      entity_type: 'profile',
      entity_id: profileId,
      action: previous ? 'updated' : 'created',
      old_data: previous,
      new_data: payload,
      user_id: profile?.id ?? null,
    })
    await fetchSupabaseData()
    setProfileForm(DEFAULT_PROFILE_FORM)
    setFlash('success', previous ? 'Uživatel byl upraven.' : 'Uživatel byl vytvořen.')
    setBusy(false)
  }

  async function handleToggleProfileActive(item) {
    setBusy(true)
    const nextActive = !item.active

    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        profiles: current.profiles.map((profileItem) => (
          profileItem.id === item.id ? { ...profileItem, active: nextActive } : profileItem
        )),
      }))
      if (item.id === profile?.id) {
        setProfile((current) => (current ? { ...current, active: nextActive } : current))
      }
      await appendLog({ entity_type: 'profile', entity_id: item.id, action: nextActive ? 'reactivated' : 'deactivated', old_data: item, new_data: { ...item, active: nextActive }, user_id: profile?.id ?? null })
      setFlash('success', nextActive ? 'Uživatel byl znovu aktivován.' : 'Uživatel byl deaktivován.')
      setBusy(false)
      return
    }

    const response = await fetch('/api/admin-auth-user', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        action: 'set-profile-active',
        userId: item.id,
        active: nextActive,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      setFlash('error', result?.error ?? 'Nepodařilo se změnit stav uživatele.')
      setBusy(false)
      return
    }
    if (item.id === profile?.id) {
      setProfile((current) => (current ? { ...current, active: nextActive } : current))
    }
    await appendLog({ entity_type: 'profile', entity_id: item.id, action: nextActive ? 'reactivated' : 'deactivated', old_data: item, new_data: { ...item, active: nextActive }, user_id: profile?.id ?? null })
    await fetchSupabaseData()
    setFlash('success', nextActive ? 'Uživatel byl znovu aktivován.' : 'Uživatel byl deaktivován.')
    setBusy(false)
  }

  async function handleDeleteProfile(item) {
    if (item.id === profile?.id) {
      setFlash('error', 'Nelze smazat právě přihlášeného uživatele.')
      return
    }
    if (!window.confirm(`Opravdu smazat uživatele ${item.full_name}?`)) return
    setBusy(true)

    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        profiles: current.profiles.filter((profileItem) => profileItem.id !== item.id),
        drivers: current.drivers.map((driverItem) => (
          driverItem.profile_id === item.id ? { ...driverItem, profile_id: null } : driverItem
        )),
      }))
      await appendLog({ entity_type: 'profile', entity_id: item.id, action: 'deleted', old_data: item, new_data: null, user_id: profile?.id ?? null })
      setFlash('success', 'Uživatel byl smazán.')
      setBusy(false)
      return
    }

    const response = await fetch('/api/admin-auth-user', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        action: 'delete',
        userId: item.id,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      setFlash('error', result?.error ?? 'Nepodařilo se smazat auth účet.')
      setBusy(false)
      return
    }

    await appendLog({ entity_type: 'profile', entity_id: item.id, action: 'deleted', old_data: item, new_data: null, user_id: profile?.id ?? null })
    await fetchSupabaseData()
    setFlash('success', 'Uživatel byl smazán.')
    setBusy(false)
  }

  async function handleToggleDriverActive(item) {
    setBusy(true)
    const nextActive = !item.active

    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        drivers: current.drivers.map((driverItem) => (
          driverItem.id === item.id ? { ...driverItem, active: nextActive } : driverItem
        )),
      }))
      await appendLog({ entity_type: 'driver', entity_id: item.id, action: nextActive ? 'reactivated' : 'deactivated', old_data: item, new_data: { ...item, active: nextActive }, user_id: profile?.id ?? null })
      setFlash('success', nextActive ? 'Řidič byl znovu aktivován.' : 'Řidič byl deaktivován.')
      setBusy(false)
      return
    }

    const { error: saveError } = await supabase.from('drivers').update({ active: nextActive }).eq('id', item.id)
    if (saveError) {
      setFlash('error', saveError.message)
      setBusy(false)
      return
    }
    await appendLog({ entity_type: 'driver', entity_id: item.id, action: nextActive ? 'reactivated' : 'deactivated', old_data: item, new_data: { ...item, active: nextActive }, user_id: profile?.id ?? null })
    await fetchSupabaseData()
    setFlash('success', nextActive ? 'Řidič byl znovu aktivován.' : 'Řidič byl deaktivován.')
    setBusy(false)
  }

  async function handleDeleteDriver(item) {
    if (!window.confirm(`Opravdu smazat řidiče ${item.display_name}?`)) return
    setBusy(true)

    if (mode === 'demo') {
      setDemoState((current) => ({
        ...current,
        drivers: current.drivers.filter((driverItem) => driverItem.id !== item.id),
      }))
      await appendLog({ entity_type: 'driver', entity_id: item.id, action: 'deleted', old_data: item, new_data: null, user_id: profile?.id ?? null })
      setFlash('success', 'Řidič byl smazán.')
      setBusy(false)
      return
    }

    const { error: deleteError } = await supabase.from('drivers').delete().eq('id', item.id)
    if (deleteError) {
      setFlash('error', deleteError.message)
      setBusy(false)
      return
    }
    await appendLog({ entity_type: 'driver', entity_id: item.id, action: 'deleted', old_data: item, new_data: null, user_id: profile?.id ?? null })
    await fetchSupabaseData()
    setFlash('success', 'Řidič byl smazán.')
    setBusy(false)
  }

  function handleExportShifts() {
    const rows = visibleShifts.map((shift) => [
      formatDateTime(shift.start_at),
      formatDateTime(shift.end_at),
      shift.driver?.display_name ?? '',
      shift.vehicle?.plate ?? '',
      shift.shift_type,
      shift.status,
      shift.driver_response,
      shift.note ?? '',
    ])
    downloadCsv(`rbshift-smeny-${new Date().toISOString().slice(0, 10)}.csv`, [
      'Zacatek',
      'Konec',
      'Ridic',
      'Vozidlo',
      'Typ',
      'Stav',
      'Reakce ridice',
      'Poznamka',
    ], rows)
    setFlash('success', 'CSV export směn je připraven.')
  }

  async function handleLogin(event) {
    event.preventDefault()
    if (mode === 'demo') {
      const found = profiles.find((item) => item.email.toLowerCase() === loginEmail.toLowerCase())
      if (!found) {
        setFlash('error', 'Demo uživatel nenalezen. Použij připravené tlačítko níže.')
        return
      }
      setProfile(found)
      setActiveTab(found.role === 'driver' ? 'today' : 'dashboard')
      localStorage.setItem(DEMO_USER_KEY, found.id)
      setFlash('success', 'Přihlášení do demo režimu proběhlo úspěšně.')
      return
    }

    setBusy(true)
    setError('')
    const normalizedEmail = loginEmail.trim()

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: loginPassword,
      })

      if (authError) {
        setFlash('error', authError.message)
        setBusy(false)
        return
      }

      setSession(data.session ?? null)

      if (data.session?.user?.id) {
        const hydrated = await hydrateSupabaseUser(data.session.user.id)
        if (hydrated) {
          setFlash('success', 'Přihlášení proběhlo úspěšně.')
        }
        return
      }

      setFlash('success', 'Přihlášení proběhlo úspěšně.')
    } catch (loginError) {
      setFlash('error', loginError.message || 'Přihlášení selhalo.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    if (mode === 'demo') {
      localStorage.removeItem(DEMO_USER_KEY)
      setProfile(null)
      setSession(null)
      setActiveTab('dashboard')
      setLoginEmail('')
      setLoginPassword('')
      setMessage('')
      setError('')
      resetForms()
      return
    }
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setActiveTab('dashboard')
    setLoginEmail('')
    setLoginPassword('')
    setMessage('')
    setError('')
    resetForms()
  }

  function loginAsDemoUser(profileId, email) {
    setLoginEmail(email)
    const selected = profiles.find((item) => item.id === profileId)
    if (selected) {
      setProfile(selected)
      setActiveTab(selected.role === 'driver' ? 'today' : 'dashboard')
      localStorage.setItem(DEMO_USER_KEY, selected.id)
    }
  }

  function openShiftForEdit(shift) {
    setShiftForm({
      id: shift.id,
      driver_id: shift.driver_id,
      vehicle_id: shift.vehicle_id,
      start_at: toInputValue(shift.start_at),
      end_at: toInputValue(shift.end_at),
      shift_type: shift.shift_type,
      status: shift.status,
      driver_response: shift.driver_response,
      note: shift.note ?? '',
    })
    setActiveTab('shifts')
  }

  function openAvailabilityForEdit(item) {
    setAvailabilityForm({
      id: item.id,
      driver_id: item.driver_id,
      from_date: toInputValue(item.from_date),
      to_date: toInputValue(item.to_date),
      availability_type: item.availability_type,
      note: item.note ?? '',
    })
    setActiveTab('availability')
  }

  function openVehicleForEdit(item) {
    setVehicleForm({
      id: item.id,
      name: item.name,
      plate: item.plate,
      status: item.status,
      service_from: item.service_from ? toInputValue(item.service_from) : '',
      service_to: item.service_to ? toInputValue(item.service_to) : '',
      note: item.note ?? '',
    })
    setActiveTab('vehicles')
  }

  function openDriverForEdit(item) {
    setDriverForm({
      id: item.id,
      profile_id: item.profile_id ?? '',
      display_name: item.display_name,
      note: item.note ?? '',
      preferred_shift_types: item.preferred_shift_types ?? [],
      active: item.active,
    })
    setActiveTab('drivers')
  }

  function openProfileForEdit(item) {
    setProfileForm({
      id: item.id,
      full_name: item.full_name,
      email: item.email,
      role: item.role,
      phone: item.phone ?? '',
      active: item.active,
      auth_password: '',
    })
    setActiveTab('users')
  }

  function handleNotificationAction(notification) {
    if (notification.shiftId) {
      const targetShift = enrichedShifts.find((item) => item.id === notification.shiftId)
      if (targetShift && profile?.role !== 'driver') {
        openShiftForEdit(targetShift)
        return
      }
    }

    if (notification.targetTab) {
      setActiveTab(notification.targetTab)
    }
  }

  return {
    activeTab,
    availability,
    availabilityForm,
    busy,
    calendarView,
    changeLog,
    currentDriver,
    dataLoading,
    driverForm,
    drivers,
    driversMap,
    enrichedShifts,
    error,
    filters,
    groupedCalendar,
    handleDeleteShift,
    handleDeleteDriver,
    handleDeleteProfile,
    handleExportShifts,
    handleLogin,
    handleLogout,
    handleNotificationAction,
    handleSaveAvailability,
    handleSaveDriver,
    handleSaveProfile,
    handleSaveShift,
    handleSaveVehicle,
    handleShiftResponse,
    handleToggleDriverActive,
    handleToggleProfileActive,
    loading,
    loginAsDemoUser,
    loginEmail,
    loginPassword,
    message,
    mode,
    notifications,
    openAvailabilityForEdit,
    openDriverForEdit,
    openProfileForEdit,
    openShiftForEdit,
    openVehicleForEdit,
    problems,
    profile,
    profileForm,
    profiles,
    session,
    setActiveTab,
    setAvailabilityForm,
    setCalendarView,
    setDriverForm,
    setFilters,
    setLoginEmail,
    setLoginPassword,
    setProfileForm,
    setShiftForm,
    setVehicleForm,
    shiftForm,
    stats,
    thisWeekShifts,
    todayShifts,
    onboardingItems,
    upcomingShift,
    unreadNotificationCount,
    vehicleForm,
    vehicles,
    vehiclesMap,
    visibleShifts,
    createDefaultShiftForm: DEFAULT_SHIFT_FORM,
  }
}
