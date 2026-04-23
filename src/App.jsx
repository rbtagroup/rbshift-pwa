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
    dataLoading,
    driverForm,
    drivers,
    driversMap,
    enablePushNotifications,
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
    handleSaveNotificationPreferences,
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
    inboxNotifications,
    markNotificationRead,
    notifications,
    notificationPreferences,
    openAvailabilityForEdit,
    openDriverForEdit,
    openProfileForEdit,
    openShiftForEdit,
    openVehicleForEdit,
    problems,
    profile,
    profileForm,
    profiles,
    popupNotifications,
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
    upcomingShift,
    unreadNotificationCount,
    vehicleForm,
    vehicles,
    vehiclesMap,
    visibleShifts,
    onboardingItems,
    dismissPopup,
  } = useShiftApp()

  const nav = profile?.role === 'driver'
    ? [
        { id: 'today', label: 'Dnes' },
        { id: 'notifications', label: `Notifikace${unreadNotificationCount ? ` (${unreadNotificationCount})` : ''}` },
        { id: 'my-shifts', label: 'Moje směny' },
        { id: 'availability', label: 'Dostupnost' },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'notifications', label: `Notifikace${unreadNotificationCount ? ` (${unreadNotificationCount})` : ''}` },
        { id: 'shifts', label: 'Směny' },
        { id: 'problems', label: 'Problémy' },
        { id: 'users', label: 'Uživatelé' },
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
          {dataLoading && <div className="banner">Synchronizuji data ze Supabase…</div>}
          {popupNotifications.length > 0 ? (
            <div className="toast-stack" aria-live="polite">
              {popupNotifications.map((item) => (
                <div key={item.id} className={cx('toast-card', `toast-${item.tone ?? 'info'}`)}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <button className="toast-close" onClick={() => dismissPopup(item.id)}>Zavřít</button>
                </div>
              ))}
            </div>
          ) : null}

          {profile.role === 'driver' ? (
            <DriverView
              activeTab={activeTab}
              currentDriver={currentDriver}
              dataLoading={dataLoading}
              inboxNotifications={inboxNotifications}
              notifications={notifications}
              notificationPreferences={notificationPreferences}
              onEnablePush={enablePushNotifications}
              onNotificationAction={handleNotificationAction}
              onNotificationPreferenceSave={handleSaveNotificationPreferences}
              onNotificationRead={markNotificationRead}
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
              inboxNotifications={inboxNotifications}
              notifications={notifications}
              notificationPreferences={notificationPreferences}
              onEnablePush={enablePushNotifications}
              onNotificationAction={handleNotificationAction}
              onNotificationPreferenceSave={handleSaveNotificationPreferences}
              onNotificationRead={markNotificationRead}
              todayShifts={todayShifts}
              problems={problems}
              stats={stats}
              thisWeekShifts={thisWeekShifts}
              onboardingItems={onboardingItems}
              drivers={drivers}
              vehicles={vehicles}
              availability={availability}
              changeLog={changeLog}
              filters={filters}
              setFilters={setFilters}
              calendarView={calendarView}
              setCalendarView={setCalendarView}
              dataLoading={dataLoading}
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
              profileForm={profileForm}
              setProfileForm={setProfileForm}
              onSaveProfile={handleSaveProfile}
              onProfileEdit={openProfileForEdit}
              onProfileDelete={handleDeleteProfile}
              onProfileToggleActive={handleToggleProfileActive}
              driverForm={driverForm}
              setDriverForm={setDriverForm}
              onSaveDriver={handleSaveDriver}
              onDriverEdit={openDriverForEdit}
              onDriverDelete={handleDeleteDriver}
              onDriverToggleActive={handleToggleDriverActive}
              onExportShifts={handleExportShifts}
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
