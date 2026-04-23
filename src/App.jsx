import { ROLE_LABEL, cx } from './utils'
import { DispatcherView, DriverView, StatusPill } from './components/AppViews'
import { AuthScreen } from './components/AuthScreen'
import { useShiftApp } from './hooks/useShiftApp'

function App() {
  const {
    activeTab,
    availability,
    availabilityForm,
    busy,
    calendarView,
    changeLog,
    currentDriver,
    createDefaultShiftForm,
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
  } = useShiftApp()

  const nav = profile?.role === 'driver'
    ? [
        { id: 'today', label: 'Dnes' },
        { id: 'my-shifts', label: 'Moje směny' },
        { id: 'availability', label: 'Dostupnost' },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'shifts', label: 'Směny' },
        { id: 'problems', label: 'Problémy' },
        { id: 'drivers', label: 'Řidiči' },
        { id: 'vehicles', label: 'Auta' },
        { id: 'availability', label: 'Nepřítomnosti' },
        { id: 'history', label: 'Historie' },
      ]

  if (loading) {
    return <div className="app-shell center-screen"><div className="loader-card">Načítám RBSHIFT…</div></div>
  }

  if (!profile) {
    return (
      <AuthScreen
        busy={busy}
        error={error}
        loginEmail={loginEmail}
        loginPassword={loginPassword}
        message={message}
        mode={mode}
        onDemoLogin={loginAsDemoUser}
        onLogin={handleLogin}
        onLoginEmailChange={setLoginEmail}
        onLoginPasswordChange={setLoginPassword}
      />
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Plánovač směn pro řidiče a dispečink</div>
          <h1>RBSHIFT</h1>
        </div>
        <div className="topbar-actions">
          <StatusPill tone={mode === 'demo' ? 'warning' : 'success'}>{mode === 'demo' ? 'Demo' : 'Supabase'}</StatusPill>
          <StatusPill>{ROLE_LABEL[profile.role]}</StatusPill>
          <button className="ghost-button" onClick={handleLogout}>Odhlásit</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="profile-card">
            <strong>{profile.full_name}</strong>
            <span>{profile.email}</span>
            <span className="muted">{ROLE_LABEL[profile.role]}</span>
          </div>

          <nav className="nav-list">
            {nav.map((item) => (
              <button key={item.id} className={cx('nav-button', activeTab === item.id && 'active')} onClick={() => setActiveTab(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-note">
            <strong>PWA poznámka</strong>
            <p>Na mobilu si aplikaci přidej na plochu přes Sdílet → Přidat na plochu.</p>
          </div>
        </aside>

        <main className="content">
          {error && <div className="banner error">{error}</div>}
          {message && <div className="banner success">{message}</div>}

          {profile.role === 'driver' ? (
            <DriverView
              activeTab={activeTab}
              currentDriver={currentDriver}
              upcomingShift={upcomingShift}
              visibleShifts={visibleShifts}
              availability={availability}
              onRespond={handleShiftResponse}
              onAvailabilityEdit={openAvailabilityForEdit}
              availabilityForm={availabilityForm}
              setAvailabilityForm={setAvailabilityForm}
              onSaveAvailability={handleSaveAvailability}
              driversMap={driversMap}
              vehiclesMap={vehiclesMap}
              busy={busy}
            />
          ) : (
            <DispatcherView
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              shifts={enrichedShifts}
              todayShifts={todayShifts}
              problems={problems}
              stats={stats}
              drivers={drivers}
              vehicles={vehicles}
              availability={availability}
              changeLog={changeLog}
              filters={filters}
              setFilters={setFilters}
              calendarView={calendarView}
              setCalendarView={setCalendarView}
              groupedCalendar={groupedCalendar}
              shiftForm={shiftForm}
              setShiftForm={setShiftForm}
              onSaveShift={handleSaveShift}
              onDeleteShift={handleDeleteShift}
              onEditShift={openShiftForEdit}
              availabilityForm={availabilityForm}
              setAvailabilityForm={setAvailabilityForm}
              onSaveAvailability={handleSaveAvailability}
              onAvailabilityEdit={openAvailabilityForEdit}
              vehicleForm={vehicleForm}
              setVehicleForm={setVehicleForm}
              onSaveVehicle={handleSaveVehicle}
              onVehicleEdit={openVehicleForEdit}
              driverForm={driverForm}
              setDriverForm={setDriverForm}
              onSaveDriver={handleSaveDriver}
              onDriverEdit={openDriverForEdit}
              profiles={profiles}
              busy={busy}
              createDefaultShiftForm={createDefaultShiftForm}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
