import { useEffect, useMemo, useState } from 'react'
import {
  AVAILABILITY_LABEL,
  addDays,
  driverStats,
  endOfDay,
  formatDate,
  generateId,
  getProblems,
  overlaps,
  startOfDay,
  toInputValue,
} from '../utils'
import { hasSupabaseConfig, supabase } from '../supabaseClient'
import {
  DEFAULT_AVAILABILITY_FORM,
  DEFAULT_DRIVER_FORM,
  DEFAULT_SHIFT_FORM,
  DEFAULT_VEHICLE_FORM,
  DEMO_USER_KEY,
  loadDemoState,
  persistDemoState,
} from '../defaults'
import { useFlash } from './useFlash'

export function useShiftApp() {
  const [demoState, setDemoState] = useState(() => loadDemoState())
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const { message, error, setMessage, setError, setFlash } = useFlash()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [calendarView, setCalendarView] = useState('week')
  const [shiftForm, setShiftForm] = useState(DEFAULT_SHIFT_FORM())
  const [availabilityForm, setAvailabilityForm] = useState(DEFAULT_AVAILABILITY_FORM())
  const [vehicleForm, setVehicleForm] = useState(DEFAULT_VEHICLE_FORM)
  const [driverForm, setDriverForm] = useState(DEFAULT_DRIVER_FORM)
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
    const runAuthBootstrap = async () => {
      try {
        const sessionResult = await supabase.auth.getSession()

        if (!mounted) return

        const { data, error: authError } = sessionResult
        if (authError) {
          setError(authError.message)
          setLoading(false)
          return
        }

        setSession(data.session)
        if (data.session) {
          await hydrateSupabaseUser(data.session.user.id)
          return
        }

        setLoading(false)
      } catch (bootstrapError) {
        if (!mounted) return
        setProfile(null)
        setError(bootstrapError.message || 'Nepodařilo se inicializovat přihlášení.')
        setLoading(false)
      }
    }

    runAuthBootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      try {
        setSession(nextSession)
        if (nextSession) {
          await hydrateSupabaseUser(nextSession.user.id)
          return
        }

        setProfile(null)
        setLoading(false)
      } catch (authStateError) {
        setProfile(null)
        setError(authStateError.message || 'Nepodařilo se obnovit přihlášení.')
        setLoading(false)
      }
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

  async function hydrateSupabaseUser(userId) {
    setLoading(true)
    setError('')
    try {
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) {
        setError('Nepodařilo se načíst profil uživatele. Zkontroluj tabulku profiles a RLS politiky.')
        setLoading(false)
        return false
      }

      setProfile(userProfile)
      setActiveTab(userProfile.role === 'driver' ? 'today' : 'dashboard')
      await fetchSupabaseData()
      return true
    } catch (profileLoadError) {
      setProfile(null)
      setError(profileLoadError.message || 'Načtení uživatelského profilu selhalo.')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function fetchSupabaseData() {
    const [profilesRes, driversRes, vehiclesRes, shiftsRes, availabilityRes, changeLogRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('drivers').select('*').order('display_name'),
      supabase.from('vehicles').select('*').order('name'),
      supabase.from('shifts').select('*').order('start_at'),
      supabase.from('driver_availability').select('*').order('from_date'),
      supabase.from('change_log').select('*').order('created_at', { ascending: false }).limit(100),
    ])

    const results = [profilesRes, driversRes, vehiclesRes, shiftsRes, availabilityRes, changeLogRes]
    const firstError = results.find((item) => item.error)?.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    setDemoState({
      profiles: profilesRes.data ?? [],
      drivers: driversRes.data ?? [],
      vehicles: vehiclesRes.data ?? [],
      shifts: shiftsRes.data ?? [],
      availability: availabilityRes.data ?? [],
      changeLog: changeLogRes.data ?? [],
    })
  }

  function resetForms() {
    setShiftForm(DEFAULT_SHIFT_FORM())
    setAvailabilityForm(DEFAULT_AVAILABILITY_FORM())
    setVehicleForm(DEFAULT_VEHICLE_FORM)
    setDriverForm(DEFAULT_DRIVER_FORM)
  }

  function validateShift(form) {
    if (!form.driver_id) return 'Vyber řidiče.'
    if (!form.vehicle_id) return 'Vyber vozidlo.'
    if (!form.start_at || !form.end_at) return 'Vyplň začátek a konec směny.'
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

    await supabase.from('change_log').insert([{ id: generateId('log'), created_at: new Date().toISOString(), ...entry }])
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
      ...shiftForm,
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
      : supabase.from('shifts').insert([{ ...payload, created_by: profile?.id ?? null, created_at: new Date().toISOString() }])

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
    if (new Date(availabilityForm.to_date) < new Date(availabilityForm.from_date)) {
      setFlash('error', 'Konec blokace musí být po začátku.')
      setBusy(false)
      return
    }

    const payload = {
      ...availabilityForm,
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
      : supabase.from('driver_availability').insert([{ ...payload }])

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
    if (!vehicleForm.name || !vehicleForm.plate) {
      setFlash('error', 'Vyplň název i SPZ vozidla.')
      setBusy(false)
      return
    }

    const payload = {
      ...vehicleForm,
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
      : supabase.from('vehicles').insert([{ ...payload }])

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
    if (!driverForm.display_name) {
      setFlash('error', 'Vyplň jméno řidiče.')
      setBusy(false)
      return
    }

    const payload = {
      ...driverForm,
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
      : supabase.from('drivers').insert([{ ...payload }])

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

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
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
      setActiveTab('dashboard')
      resetForms()
      return
    }
    await supabase.auth.signOut()
    setProfile(null)
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

  return {
    activeTab,
    availability,
    availabilityForm,
    busy,
    calendarView,
    changeLog,
    currentDriver,
    driverForm,
    drivers,
    driversMap,
    enrichedShifts,
    error,
    filters,
    groupedCalendar,
    handleDeleteShift,
    handleLogin,
    handleLogout,
    handleSaveAvailability,
    handleSaveDriver,
    handleSaveShift,
    handleSaveVehicle,
    handleShiftResponse,
    loading,
    loginAsDemoUser,
    loginEmail,
    loginPassword,
    message,
    mode,
    openAvailabilityForEdit,
    openDriverForEdit,
    openShiftForEdit,
    openVehicleForEdit,
    problems,
    profile,
    profiles,
    session,
    setActiveTab,
    setAvailabilityForm,
    setCalendarView,
    setDriverForm,
    setFilters,
    setLoginEmail,
    setLoginPassword,
    setShiftForm,
    setVehicleForm,
    shiftForm,
    stats,
    todayShifts,
    upcomingShift,
    vehicleForm,
    vehicles,
    vehiclesMap,
    visibleShifts,
    createDefaultShiftForm: DEFAULT_SHIFT_FORM,
  }
}
