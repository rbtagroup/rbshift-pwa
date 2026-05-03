import { lazy, Suspense, useState } from 'react'
import { ROLE_LABEL, cx } from './utils'
import { AuthScreen } from './components/AuthScreen'
import { StatusPill } from './components/StatusPill'
import { useShiftApp } from './hooks/useShiftApp'

const DriverView = lazy(() => import('./components/DriverView').then((module) => ({ default: module.DriverView })))
const DispatcherView = lazy(() => import('./components/AppViews').then((module) => ({ default: module.DispatcherView })))
const APP_BUILD_LABEL = '2026-04-25.2'

function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const {
    activeTab,
    availability,
    availabilityForm,
    busy,
    calendarView,
    changeLog,
    clearReadNotifications,
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
    handleApplyOpenShift,
    handleApproveShiftApplication,
    handleDeleteShift,
    handleDeleteDriver,
    handleDeleteProfile,
    handleExportShifts,
    handleLogin,
    handleLogout,
    handleNotificationAction,
    handleOfferShiftToDriver,
    handleSaveNotificationPreferences,
    handleSaveAvailability,
    handleSaveDriver,
    handleSaveProfile,
    handleSaveShift,
    handleSaveVehicle,
    handleShiftResponse,
    handleTakeoverShift,
    handleRejectHandoverRequest,
    handleToggleDriverActive,
    handleToggleProfileActive,
    loading,
    loginAsDemoUser,
    loginEmail,
    loginPassword,
    message,
    mode,
    myShiftApplications,
    inboxNotifications,
    notificationHistoryFilter,
    markNotificationRead,
    notifications,
    notificationPreferences,
    openShifts,
    pendingHandoverByShiftId,
    openAvailabilityForEdit,
    openDriverForEdit,
    openProfileForEdit,
    openShiftForEdit,
    openVehicleForEdit,
    problems,
    profile,
    profileForm,
    profiles,
    replacementOffers,
    shiftApplications,
    shiftApplicationsByShiftId,
    shiftHandoverRequests,
    popupNotifications,
    retrySupabaseSession,
    session,
    setActiveTab,
    setAvailabilityForm,
    setCalendarView,
    setDriverForm,
    setFilters,
    setLoginEmail,
    setLoginPassword,
    setNotificationHistoryFilter,
    sendTestPushNotification,
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
    visibleInboxNotifications,
    weeklyCoverage,
    onboardingItems,
    dismissPopup,
  } = useShiftApp()

  const driverActionCount = notifications.filter((item) => item.tone !== 'info').length
  const nav = profile?.role === 'driver'
    ? [
        { id: 'today', label: 'Dnes' },
        { id: 'notifications', label: `Úkoly${driverActionCount ? ` (${driverActionCount})` : ''}` },
        { id: 'my-shifts', label: 'Směny' },
        { id: 'open-shifts', label: 'Volné' },
        { id: 'availability', label: 'Dostupnost' },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'month', label: 'Měsíc' },
        { id: 'coverage', label: 'Týden' },
        { id: 'notifications', label: `Notifikace${unreadNotificationCount ? ` (${unreadNotificationCount})` : ''}` },
        { id: 'shifts', label: 'Směny' },
        { id: 'problems', label: 'Problémy' },
        { id: 'users', label: 'Uživatelé' },
        { id: 'drivers', label: 'Řidiči' },
        { id: 'vehicles', label: 'Auta' },
        { id: 'availability', label: 'Nepřítomnosti' },
        { id: 'history', label: 'Historie' },
      ]

  const mobilePrimaryIds = profile?.role === 'driver'
    ? ['today', 'notifications', 'my-shifts', 'open-shifts', 'availability']
    : ['dashboard', 'month', 'notifications', 'shifts']
  const mobilePrimaryNav = nav.filter((item) => mobilePrimaryIds.includes(item.id))
  const mobileOverflowNav = nav.filter((item) => !mobilePrimaryIds.includes(item.id))

  function handleTabChange(nextTab) {
    setActiveTab(nextTab)
    setMobileNavOpen(false)
  }

  if (loading) {
    return <div className="app-shell center-screen"><div className="loader-card">Načítám RBSHIFT…</div></div>
  }

  if (!profile && session?.user?.id) {
    return (
      <div className="app-shell center-screen">
        <div className="loader-card auth-recovery-card">
          <strong>Obnovuji přihlášení…</strong>
          {error ? <p className="muted">{error}</p> : <p className="muted">Relace je aktivní, čekám jen na uživatelský profil.</p>}
          <button className="primary-button" type="button" onClick={retrySupabaseSession}>Zkusit znovu</button>
        </div>
      </div>
    )
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
          <h1>RBSHIFT</h1>
        </div>
        <div className="topbar-actions">
          <span className="build-badge">Build {APP_BUILD_LABEL}</span>
          <StatusPill tone={mode === 'demo' ? 'warning' : 'success'}>{mode === 'demo' ? 'Demo' : 'Supabase'}</StatusPill>
          <StatusPill>{ROLE_LABEL[profile.role]}</StatusPill>
          <button className="ghost-button" onClick={handleLogout}>Odhlásit</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="profile-card">
            <strong>{profile.full_name}</strong>
            <span className="profile-email">{profile.email}</span>
            <span className="muted">{ROLE_LABEL[profile.role]}</span>
          </div>

          <nav className="nav-list">
            {nav.map((item) => (
              <button key={item.id} className={cx('nav-button', activeTab === item.id && 'active')} onClick={() => handleTabChange(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="content">
          <nav className="mobile-nav" aria-label="Mobilní navigace">
            {mobilePrimaryNav.map((item) => (
              <button
                key={item.id}
                className={cx('mobile-nav-button', activeTab === item.id && 'active')}
                onClick={() => handleTabChange(item.id)}
              >
                {item.label}
              </button>
            ))}
            {mobileOverflowNav.length > 0 ? (
              <div className="mobile-nav-more">
                <button
                  className={cx(
                    'mobile-nav-button',
                    (mobileNavOpen || mobileOverflowNav.some((item) => item.id === activeTab)) && 'active',
                  )}
                  onClick={() => setMobileNavOpen((current) => !current)}
                  aria-expanded={mobileNavOpen}
                  aria-haspopup="menu"
                >
                  {mobileOverflowNav.some((item) => item.id === activeTab) ? nav.find((item) => item.id === activeTab)?.label : 'Více'}
                </button>
                {mobileNavOpen ? (
                  <div className="mobile-nav-menu" role="menu">
                    {mobileOverflowNav.map((item) => (
                      <button
                        key={item.id}
                        className={cx('mobile-nav-menu-button', activeTab === item.id && 'active')}
                        onClick={() => handleTabChange(item.id)}
                        role="menuitem"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>

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

          <Suspense fallback={<div className="loader-card">Načítám prostředí…</div>}>
            {profile.role === 'driver' ? (
              <DriverView
                activeTab={activeTab}
                currentDriver={currentDriver}
                dataLoading={dataLoading}
                inboxNotifications={inboxNotifications}
                myShiftApplications={myShiftApplications}
                openShifts={openShifts}
                visibleInboxNotifications={visibleInboxNotifications}
                notifications={notifications}
                notificationHistoryFilter={notificationHistoryFilter}
                notificationPreferences={notificationPreferences}
                onEnablePush={enablePushNotifications}
                onNotificationAction={handleNotificationAction}
                onNotificationHistoryFilterChange={setNotificationHistoryFilter}
                onNotificationPreferenceSave={handleSaveNotificationPreferences}
                onNotificationRead={markNotificationRead}
                onReadNotificationsClear={clearReadNotifications}
                onTestPush={sendTestPushNotification}
                onApplyOpenShift={handleApplyOpenShift}
                onOfferShiftToDriver={handleOfferShiftToDriver}
                onRejectHandoverRequest={handleRejectHandoverRequest}
                upcomingShift={upcomingShift}
                visibleShifts={visibleShifts}
                drivers={drivers}
                availability={availability}
                onRespond={handleShiftResponse}
                onTakeoverShift={handleTakeoverShift}
                onAvailabilityEdit={openAvailabilityForEdit}
                availabilityForm={availabilityForm}
                setAvailabilityForm={setAvailabilityForm}
                onSaveAvailability={handleSaveAvailability}
                driversMap={driversMap}
                vehiclesMap={vehiclesMap}
                replacementOffers={replacementOffers}
                pendingHandoverByShiftId={pendingHandoverByShiftId}
                shiftHandoverRequests={shiftHandoverRequests}
                busy={busy}
              />
            ) : (
              <DispatcherView
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                shifts={enrichedShifts}
                weeklyCoverage={weeklyCoverage}
                shiftApplicationsByShiftId={shiftApplicationsByShiftId}
                inboxNotifications={inboxNotifications}
                visibleInboxNotifications={visibleInboxNotifications}
                notifications={notifications}
                notificationHistoryFilter={notificationHistoryFilter}
                notificationPreferences={notificationPreferences}
                onEnablePush={enablePushNotifications}
                onNotificationAction={handleNotificationAction}
                onNotificationHistoryFilterChange={setNotificationHistoryFilter}
                onNotificationPreferenceSave={handleSaveNotificationPreferences}
                onNotificationRead={markNotificationRead}
                onReadNotificationsClear={clearReadNotifications}
                onTestPush={sendTestPushNotification}
                onApproveShiftApplication={handleApproveShiftApplication}
                todayShifts={todayShifts}
                problems={problems}
                stats={stats}
                thisWeekShifts={thisWeekShifts}
                onboardingItems={onboardingItems}
                drivers={drivers}
                driversMap={driversMap}
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
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default App
