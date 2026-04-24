import {
  AVAILABILITY_LABEL,
  RESPONSE_LABEL,
  ROLE_LABEL,
  SHIFT_TYPE_LABEL,
  STATUS_LABEL,
  cx,
  formatDate,
  formatDateTime,
  formatTime,
} from '../utils'

export function DriverView({
  activeTab,
  currentDriver,
  dataLoading,
  inboxNotifications,
  notifications,
  notificationPreferences,
  onEnablePush,
  onNotificationAction,
  onNotificationPreferenceSave,
  onNotificationRead,
  upcomingShift,
  visibleShifts,
  replacementOffers,
  availability,
  onRespond,
  onTakeoverShift,
  availabilityForm,
  setAvailabilityForm,
  onSaveAvailability,
  vehiclesMap,
  busy,
}) {
  const myAvailability = availability.filter((item) => item.driver_id === currentDriver?.id)

  if (!currentDriver) {
    return <div className="panel">{dataLoading ? 'Načítám řidičská data…' : 'K tomuto profilu zatím není přiřazen řidičský záznam.'}</div>
  }

  if (activeTab === 'today') {
    return (
      <div className="stack-xl">
        <div className="hero-card">
          <div>
            <div className="eyebrow">Moje dnešní směna</div>
            <h2>{upcomingShift ? SHIFT_TYPE_LABEL[upcomingShift.shift_type] : 'Dnes bez směny'}</h2>
            <p>
              {upcomingShift
                ? `${formatDate(upcomingShift.start_at, { weekday: 'long' })} · ${formatTime(upcomingShift.start_at)}–${formatTime(upcomingShift.end_at)}`
                : 'Aktuálně nemáš přiřazenou směnu.'}
            </p>
          </div>
          {upcomingShift && <StatusPill tone={upcomingShift.driver_response === 'accepted' ? 'success' : upcomingShift.driver_response === 'declined' ? 'danger' : 'warning'}>{RESPONSE_LABEL[upcomingShift.driver_response]}</StatusPill>}
        </div>

        {upcomingShift ? (
          <div className="grid-2">
            <section className="panel">
              <h3>Detail směny</h3>
              <InfoRow label="Auto" value={`${upcomingShift.vehicle?.name ?? '—'} · ${upcomingShift.vehicle?.plate ?? '—'}`} />
              <InfoRow label="Stav směny" value={STATUS_LABEL[upcomingShift.status]} />
              <InfoRow label="Poznámka" value={upcomingShift.note || 'Bez poznámky'} />
              {upcomingShift.driver_response === 'pending' ? (
                <div className="button-row">
                  <button className="primary-button" disabled={busy} onClick={() => onRespond(upcomingShift, 'accepted')}>Potvrdit směnu</button>
                  <button className="danger-button" disabled={busy} onClick={() => onRespond(upcomingShift, 'declined')}>Odmítnout</button>
                </div>
              ) : upcomingShift.driver_response === 'accepted' && upcomingShift.status === 'confirmed' ? (
                <div className="button-row">
                  <button className="ghost-button" disabled={busy} onClick={() => onRespond(upcomingShift, 'offer')}>Nabídnout kolegům</button>
                  <button className="danger-button" disabled={busy} onClick={() => onRespond(upcomingShift, 'release')}>Zrušit účast</button>
                </div>
              ) : (
                <p className="muted">
                  {upcomingShift.driver_response === 'accepted'
                    ? 'Tato směna už je potvrzená.'
                    : upcomingShift.driver_response === 'declined'
                      ? 'Tato směna byla odmítnutá a čeká na další řešení.'
                      : 'Na této směně není potřeba další akce.'}
                </p>
              )}
            </section>
            <section className="panel">
              <h3>Další směny</h3>
              <div className="stack-md">
                {visibleShifts.slice(0, 4).map((shift) => (
                  <ShiftListItem key={shift.id} shift={shift} compact />
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    )
  }

  if (activeTab === 'notifications') {
    return (
      <NotificationsSection
        inboxNotifications={inboxNotifications}
        notifications={notifications}
        notificationPreferences={notificationPreferences}
        onEnablePush={onEnablePush}
        onNotificationAction={onNotificationAction}
        onNotificationPreferenceSave={onNotificationPreferenceSave}
        onNotificationRead={onNotificationRead}
      />
    )
  }

  if (activeTab === 'availability') {
    return (
      <div className="grid-2">
        <section className="panel">
          <h3>Moje dostupnost</h3>
          <form className="form-grid" onSubmit={onSaveAvailability}>
            <input type="hidden" value={availabilityForm.id ?? ''} />
            <label>
              Řidič
              <input value={currentDriver.display_name} disabled />
            </label>
            <label>
              Typ
              <select value={availabilityForm.availability_type} onChange={(event) => setAvailabilityForm((current) => ({ ...current, driver_id: currentDriver.id, availability_type: event.target.value }))}>
                {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Od
              <input type="datetime-local" value={availabilityForm.from_date} onChange={(event) => setAvailabilityForm((current) => ({ ...current, driver_id: currentDriver.id, from_date: event.target.value }))} />
            </label>
            <label>
              Do
              <input type="datetime-local" value={availabilityForm.to_date} onChange={(event) => setAvailabilityForm((current) => ({ ...current, driver_id: currentDriver.id, to_date: event.target.value }))} />
            </label>
            <label className="full-width">
              Poznámka
              <textarea rows="3" value={availabilityForm.note} onChange={(event) => setAvailabilityForm((current) => ({ ...current, driver_id: currentDriver.id, note: event.target.value }))} />
            </label>
            <button className="primary-button" disabled={busy}>Uložit dostupnost</button>
          </form>
        </section>
        <section className="panel">
          <h3>Moje blokace</h3>
          <div className="stack-md">
            {myAvailability.length === 0 ? <EmptyState text="Zatím nemáš žádnou zadanou nepřítomnost." /> : myAvailability.map((item) => (
              <div className="list-card" key={item.id}>
                <div>
                  <strong>{AVAILABILITY_LABEL[item.availability_type]}</strong>
                  <p>{formatDateTime(item.from_date)} — {formatDateTime(item.to_date)}</p>
                  <p className="muted">{item.note || 'Bez poznámky'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="stack-xl">
      <section className="panel">
      <div className="panel-header">
        <div>
          <h3>Moje směny</h3>
        </div>
      </div>
      <div className="stack-md">
        {visibleShifts.length === 0 ? <EmptyState text="Zatím nemáš žádné směny." /> : visibleShifts.map((shift) => (
          <div className="list-card" key={shift.id}>
            <div>
              <strong>{SHIFT_TYPE_LABEL[shift.shift_type]} · {formatDate(shift.start_at, { weekday: 'long' })}</strong>
              <p>{formatTime(shift.start_at)}–{formatTime(shift.end_at)} · {vehiclesMap[shift.vehicle_id]?.plate ?? 'Bez auta'}</p>
              <p className="muted">{shift.note || 'Bez poznámky'}</p>
              {shift.driver_response === 'pending' ? (
                <div className="button-row">
                  <button className="primary-button" disabled={busy} onClick={() => onRespond(shift, 'accepted')}>Potvrdit směnu</button>
                  <button className="danger-button" disabled={busy} onClick={() => onRespond(shift, 'declined')}>Odmítnout</button>
                </div>
              ) : shift.driver_response === 'accepted' && shift.status === 'confirmed' ? (
                <div className="button-row">
                  <button className="ghost-button" disabled={busy} onClick={() => onRespond(shift, 'offer')}>Nabídnout kolegům</button>
                  <button className="danger-button" disabled={busy} onClick={() => onRespond(shift, 'release')}>Zrušit účast</button>
                </div>
              ) : null}
            </div>
            <StatusPill tone={shift.driver_response === 'accepted' ? 'success' : shift.driver_response === 'declined' ? 'danger' : 'warning'}>{RESPONSE_LABEL[shift.driver_response]}</StatusPill>
          </div>
        ))}
      </div>
      </section>

      {replacementOffers.length > 0 ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Směny k převzetí</h3>
            </div>
          </div>
          <div className="stack-md">
            {replacementOffers.map((shift) => (
              <div className="list-card" key={shift.id}>
                <div>
                  <strong>{SHIFT_TYPE_LABEL[shift.shift_type]} · {formatDate(shift.start_at, { weekday: 'long' })}</strong>
                  <p>{formatTime(shift.start_at)}–{formatTime(shift.end_at)} · {shift.vehicle?.plate ?? vehiclesMap[shift.vehicle_id]?.plate ?? 'Bez auta'}</p>
                  <p className="muted">{shift.note || 'Nabídnutá směna čeká na převzetí.'}</p>
                </div>
                <div className="button-row wrap">
                  <StatusPill tone="danger">Záskok</StatusPill>
                  <button className="primary-button" disabled={busy} onClick={() => onTakeoverShift(shift)}>Převzít směnu</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export function DispatcherView(props) {
  const {
    activeTab,
    shifts,
    todayShifts,
    problems,
    stats,
    thisWeekShifts,
    onboardingItems,
    notifications,
    notificationPreferences,
    inboxNotifications,
    onEnablePush,
    onNotificationAction,
    onNotificationPreferenceSave,
    onNotificationRead,
    drivers,
    vehicles,
    availability,
    changeLog,
    filters,
    setFilters,
    calendarView,
    setCalendarView,
    groupedCalendar,
    shiftForm,
    setShiftForm,
    onSaveShift,
    onExportShifts,
    onDeleteShift,
    onEditShift,
    availabilityForm,
    setAvailabilityForm,
    onSaveAvailability,
    onAvailabilityEdit,
    vehicleForm,
    setVehicleForm,
    onSaveVehicle,
    onVehicleEdit,
    profileForm,
    setProfileForm,
    onSaveProfile,
    onProfileEdit,
    onProfileDelete,
    onProfileToggleActive,
    driverForm,
    setDriverForm,
    onSaveDriver,
    onDriverEdit,
    onDriverDelete,
    onDriverToggleActive,
    profiles,
    busy,
    createDefaultShiftForm,
    dataLoading,
  } = props

  if (activeTab === 'dashboard') {
    return (
      <DashboardSection
        shifts={shifts}
        stats={stats}
        thisWeekShifts={thisWeekShifts}
        todayShifts={todayShifts}
        vehicles={vehicles}
        onboardingItems={onboardingItems}
        onExportShifts={onExportShifts}
      />
    )
  }

  if (activeTab === 'notifications') {
    return (
      <NotificationsSection
        inboxNotifications={inboxNotifications}
        notifications={notifications}
        notificationPreferences={notificationPreferences}
        onEnablePush={onEnablePush}
        onNotificationAction={onNotificationAction}
        onNotificationPreferenceSave={onNotificationPreferenceSave}
        onNotificationRead={onNotificationRead}
      />
    )
  }

  if (activeTab === 'shifts') {
    return (
      <ShiftsSection
        busy={busy}
        calendarView={calendarView}
        createDefaultShiftForm={createDefaultShiftForm}
        dataLoading={dataLoading}
        drivers={drivers}
        filters={filters}
        groupedCalendar={groupedCalendar}
        onDeleteShift={onDeleteShift}
        onExportShifts={onExportShifts}
        onEditShift={onEditShift}
        onSaveShift={onSaveShift}
        setCalendarView={setCalendarView}
        setFilters={setFilters}
        setShiftForm={setShiftForm}
        shiftForm={shiftForm}
        vehicles={vehicles}
      />
    )
  }

  if (activeTab === 'problems') {
    return <ProblemsSection onEditShift={onEditShift} problems={problems} />
  }

  if (activeTab === 'drivers') {
    return (
      <DriversSection
        busy={busy}
        onDriverDelete={onDriverDelete}
        driverForm={driverForm}
        drivers={drivers}
        onDriverEdit={onDriverEdit}
        onSaveDriver={onSaveDriver}
        onToggleDriverActive={onDriverToggleActive}
        profiles={profiles}
        setDriverForm={setDriverForm}
      />
    )
  }

  if (activeTab === 'users') {
    return (
      <ProfilesSection
        busy={busy}
        onProfileDelete={onProfileDelete}
        onProfileEdit={onProfileEdit}
        onProfileToggleActive={onProfileToggleActive}
        onSaveProfile={onSaveProfile}
        profileForm={profileForm}
        profiles={profiles}
        setProfileForm={setProfileForm}
      />
    )
  }

  if (activeTab === 'vehicles') {
    return (
      <VehiclesSection
        busy={busy}
        onSaveVehicle={onSaveVehicle}
        onVehicleEdit={onVehicleEdit}
        setVehicleForm={setVehicleForm}
        vehicleForm={vehicleForm}
        vehicles={vehicles}
      />
    )
  }

  if (activeTab === 'availability') {
    return (
      <AvailabilitySection
        availability={availability}
        availabilityForm={availabilityForm}
        busy={busy}
        drivers={drivers}
        onAvailabilityEdit={onAvailabilityEdit}
        onSaveAvailability={onSaveAvailability}
        setAvailabilityForm={setAvailabilityForm}
      />
    )
  }

  return <HistorySection changeLog={changeLog} profiles={profiles} />
}

function DashboardSection({ shifts, stats, thisWeekShifts, todayShifts, vehicles, onboardingItems, onExportShifts }) {
  return (
    <div className="stack-xl">
      <section className="stats-grid">
        <StatCard label="Dnešní směny" value={todayShifts.length} />
        <StatCard label="Nepotvrzené" value={shifts.filter((item) => item.driver_response === 'pending').length} tone="warning" />
        <StatCard label="Potřeba záskoku" value={shifts.filter((item) => item.status === 'replacement_needed').length} tone="danger" />
        <StatCard label="Auta v servisu" value={vehicles.filter((item) => item.status === 'service').length} tone="info" />
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Rychlý start</h3>
              <p className="muted">Krátký checklist, ať je onboarding nového dispečera i ostrý provoz přehledný.</p>
            </div>
            <StatusPill tone={onboardingItems.every((item) => item.done) ? 'success' : 'warning'}>
              {onboardingItems.filter((item) => item.done).length}/{onboardingItems.length}
            </StatusPill>
          </div>
          <div className="stack-md">
            {onboardingItems.map((item) => (
              <div className="list-card" key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                </div>
                <StatusPill tone={item.done ? 'success' : 'warning'}>{item.done ? 'Hotovo' : 'Chybí'}</StatusPill>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Dnešní provoz</h3>
              <p className="muted">Rychlý přehled směn, které běží dnes.</p>
            </div>
          </div>
          <div className="stack-md">
            {todayShifts.length === 0 ? <EmptyState text="Pro dnešek zatím nejsou žádné směny." /> : todayShifts.map((shift) => <ShiftListItem key={shift.id} shift={shift} />)}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Týdenní report</h3>
              <p className="muted">Souhrn nejbližšího týdne a rychlý export pro sdílení.</p>
            </div>
            <button className="ghost-button" onClick={onExportShifts}>Export CSV</button>
          </div>
          <div className="report-grid">
            <div className="stat-card">
              <span className="muted">Směny na 7 dní</span>
              <strong>{thisWeekShifts.length}</strong>
            </div>
            <div className="stat-card">
              <span className="muted">Plánované hodiny</span>
              <strong>{thisWeekShifts.reduce((acc, item) => acc + (new Date(item.end_at) - new Date(item.start_at)) / 3600000, 0).toFixed(1)} h</strong>
            </div>
            <div className="stat-card">
              <span className="muted">Aktivní řidiči</span>
              <strong>{stats.filter((item) => item.count > 0).length}</strong>
            </div>
            <div className="stat-card">
              <span className="muted">Nepotvrzené směny</span>
              <strong>{thisWeekShifts.filter((item) => item.driver_response === 'pending').length}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Vytížení řidičů</h3>
            <p className="muted">Souhrn podle počtu směn a hodin.</p>
          </div>
        </div>
        <div className="stack-md">
          {stats.map((item) => (
            <div className="list-card" key={item.driver.id}>
              <div>
                <strong>{item.driver.display_name}</strong>
                <p>{item.count} směn · {item.hours.toFixed(1)} h · noční {item.nights}×</p>
              </div>
              <StatusPill>{item.weekends} víkendy</StatusPill>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ShiftsSection({
  busy,
  calendarView,
  createDefaultShiftForm,
  drivers,
  filters,
  groupedCalendar,
  onDeleteShift,
  onExportShifts,
  onEditShift,
  onSaveShift,
  setCalendarView,
  setFilters,
  setShiftForm,
  shiftForm,
  vehicles,
}) {
  return (
    <div className="grid-main">
      <ShiftFormPanel
        busy={busy}
        createDefaultShiftForm={createDefaultShiftForm}
        drivers={drivers}
        onSaveShift={onSaveShift}
        setShiftForm={setShiftForm}
        shiftForm={shiftForm}
        vehicles={vehicles}
      />
      <ShiftCalendarPanel
        calendarView={calendarView}
        drivers={drivers}
        filters={filters}
        groupedCalendar={groupedCalendar}
        onDeleteShift={onDeleteShift}
        onExportShifts={onExportShifts}
        onEditShift={onEditShift}
        setCalendarView={setCalendarView}
        setFilters={setFilters}
        vehicles={vehicles}
      />
    </div>
  )
}

function ShiftFormPanel({ busy, createDefaultShiftForm, dataLoading, drivers, onSaveShift, setShiftForm, shiftForm, vehicles }) {
  const hasDrivers = drivers.length > 0
  const hasVehicles = vehicles.length > 0

  return (
    <section className="panel sticky-panel">
      <div className="panel-header">
        <div>
          <h3>{shiftForm.id ? 'Upravit směnu' : 'Nová směna'}</h3>
        </div>
      </div>
      <form className="form-grid" onSubmit={onSaveShift}>
        <label>
          Řidič
          <select value={shiftForm.driver_id} onChange={(event) => setShiftForm((current) => ({ ...current, driver_id: event.target.value }))}>
            <option value="">Vyber řidiče</option>
            {drivers.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
          </select>
          {!hasDrivers ? <p className="muted">{dataLoading ? 'Načítám seznam řidičů…' : 'Zatím nemáš žádného řidiče. Nejdřív ho přidej v záložce Řidiči.'}</p> : null}
        </label>
        <label>
          Vozidlo
          <select value={shiftForm.vehicle_id} onChange={(event) => setShiftForm((current) => ({ ...current, vehicle_id: event.target.value }))}>
            <option value="">Vyber auto</option>
            {vehicles.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.plate}</option>)}
          </select>
          {!hasVehicles ? <p className="muted">{dataLoading ? 'Načítám seznam vozidel…' : 'Zatím nemáš žádné vozidlo. Nejdřív ho přidej v záložce Auta.'}</p> : null}
        </label>
        <label>
          Začátek
          <input type="datetime-local" value={shiftForm.start_at} onChange={(event) => setShiftForm((current) => ({ ...current, start_at: event.target.value }))} />
        </label>
        <label>
          Konec
          <input type="datetime-local" value={shiftForm.end_at} onChange={(event) => setShiftForm((current) => ({ ...current, end_at: event.target.value }))} />
        </label>
        <label>
          Typ směny
          <select value={shiftForm.shift_type} onChange={(event) => setShiftForm((current) => ({ ...current, shift_type: event.target.value }))}>
            {Object.entries(SHIFT_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Stav
          <select value={shiftForm.status} onChange={(event) => setShiftForm((current) => ({ ...current, status: event.target.value }))}>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Reakce řidiče
          <select value={shiftForm.driver_response} onChange={(event) => setShiftForm((current) => ({ ...current, driver_response: event.target.value }))}>
            {Object.entries(RESPONSE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="full-width">
          Poznámka
          <textarea rows="4" value={shiftForm.note} onChange={(event) => setShiftForm((current) => ({ ...current, note: event.target.value }))} />
        </label>
        <div className="button-row full-width">
          <button className="primary-button" disabled={busy || !hasDrivers || !hasVehicles}>{shiftForm.id ? 'Uložit změny' : 'Vytvořit směnu'}</button>
          {shiftForm.id && <button className="ghost-button" type="button" onClick={() => setShiftForm(createDefaultShiftForm())}>Nová směna</button>}
        </div>
      </form>
    </section>
  )
}

function ShiftCalendarPanel({
  calendarView,
  drivers,
  filters,
  groupedCalendar,
  onDeleteShift,
  onExportShifts,
  onEditShift,
  setCalendarView,
  setFilters,
  vehicles,
}) {
  return (
    <section className="stack-xl">
      <section className="panel">
        <div className="panel-header wrap">
          <div>
            <h3>Kalendář směn</h3>
            <p className="muted">Denní, týdenní nebo měsíční pohled s filtry.</p>
          </div>
          <div className="button-row wrap">
            {['day', 'week', 'month'].map((view) => (
              <button key={view} className={cx('ghost-button', calendarView === view && 'active-pill')} onClick={() => setCalendarView(view)}>{view === 'day' ? 'Den' : view === 'week' ? 'Týden' : 'Měsíc'}</button>
            ))}
            <button className="ghost-button" onClick={onExportShifts}>Export CSV</button>
          </div>
        </div>

        <div className="filters-grid">
          <select value={filters.driverId} onChange={(event) => setFilters((current) => ({ ...current, driverId: event.target.value }))}>
            <option value="">Všichni řidiči</option>
            {drivers.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
          </select>
          <select value={filters.vehicleId} onChange={(event) => setFilters((current) => ({ ...current, vehicleId: event.target.value }))}>
            <option value="">Všechna auta</option>
            {vehicles.map((item) => <option key={item.id} value={item.id}>{item.plate}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Všechny stavy</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.response} onChange={(event) => setFilters((current) => ({ ...current, response: event.target.value }))}>
            <option value="">Všechny reakce</option>
            {Object.entries(RESPONSE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="stack-lg">
          {groupedCalendar.length === 0 ? <EmptyState text="Pro vybrané období nejsou žádné směny." /> : groupedCalendar.map(([day, items]) => (
            <div key={day} className="day-group">
              <div className="day-title">{day}</div>
              <div className="stack-md">
                {items.map((shift) => (
                  <div className="list-card" key={shift.id}>
                    <div>
                      <strong>{shift.driver?.display_name ?? 'Bez řidiče'} · {shift.vehicle?.plate ?? 'Bez auta'}</strong>
                      <p>{formatTime(shift.start_at)}–{formatTime(shift.end_at)} · {SHIFT_TYPE_LABEL[shift.shift_type]}</p>
                      <p className="muted">{shift.note || 'Bez poznámky'}</p>
                    </div>
                    <div className="button-row wrap">
                      <StatusPill tone={shift.driver_response === 'accepted' ? 'success' : shift.driver_response === 'declined' ? 'danger' : 'warning'}>{RESPONSE_LABEL[shift.driver_response]}</StatusPill>
                      <button className="ghost-button" onClick={() => onEditShift(shift)}>Upravit</button>
                      <button className="danger-button" onClick={() => onDeleteShift(shift.id)}>Smazat</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  )
}

function ProblemsSection({ onEditShift, problems }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>Problémové směny</h3>
        </div>
      </div>
      <div className="stack-md">
        {problems.length === 0 ? <EmptyState text="Skvělé, momentálně nejsou evidované žádné problémové směny." /> : problems.map((shift) => (
          <div className="list-card" key={shift.id}>
            <div>
              <strong>{shift.driver?.display_name ?? 'Bez řidiče'} · {formatDate(shift.start_at, { weekday: 'long' })}</strong>
              <p>{formatTime(shift.start_at)}–{formatTime(shift.end_at)} · {shift.vehicle?.plate ?? 'Bez auta'}</p>
              <p className="muted">{shift.note || 'Bez poznámky'}</p>
            </div>
            <div className="button-row wrap">
              <StatusPill tone={shift.status === 'replacement_needed' || shift.driver_response === 'declined' ? 'danger' : 'warning'}>
                {shift.status === 'replacement_needed' ? 'Záskok' : RESPONSE_LABEL[shift.driver_response]}
              </StatusPill>
              <button className="ghost-button" onClick={() => onEditShift(shift)}>Otevřít</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function NotificationsSection({
  inboxNotifications,
  notifications,
  notificationPreferences,
  onEnablePush,
  onNotificationAction,
  onNotificationPreferenceSave,
  onNotificationRead,
}) {
  return (
    <div className="grid-2">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Kanály a preference</h3>
            <p className="muted">Nastav, jestli chceš push, e-mail nebo SMS. Kritické události můžeš omezit jen na důležité změny.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={notificationPreferences.push_enabled}
              onChange={(event) => onNotificationPreferenceSave({ ...notificationPreferences, push_enabled: event.target.checked })}
            />
            Push notifikace
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={notificationPreferences.email_enabled}
              onChange={(event) => onNotificationPreferenceSave({ ...notificationPreferences, email_enabled: event.target.checked })}
            />
            E-mail notifikace
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={notificationPreferences.sms_enabled}
              onChange={(event) => onNotificationPreferenceSave({ ...notificationPreferences, sms_enabled: event.target.checked })}
            />
            SMS fallback
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={notificationPreferences.critical_only}
              onChange={(event) => onNotificationPreferenceSave({ ...notificationPreferences, critical_only: event.target.checked })}
            />
            Jen kritické externí notifikace
          </label>
          <label className="full-width">
            Telefon pro SMS fallback
            <input
              value={notificationPreferences.phone_override ?? ''}
              placeholder="např. +420777123456"
              onChange={(event) => onNotificationPreferenceSave({ ...notificationPreferences, phone_override: event.target.value })}
            />
          </label>
          <div className="button-row full-width">
            <button className="primary-button" type="button" onClick={onEnablePush}>Povolit push v prohlížeči</button>
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Živé upozornění</h3>
            <p className="muted">Přehled akcí, upozornění a připomínek pro dnešní provoz.</p>
          </div>
        </div>
        <div className="stack-md">
          {notifications.length === 0 ? <EmptyState text="Momentálně tu nejsou žádné nové notifikace." /> : notifications.map((item) => (
            <div className="list-card" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
              <div className="button-row wrap">
                <StatusPill tone={item.tone}>{item.tone === 'danger' ? 'Vysoká priorita' : item.tone === 'warning' ? 'Pozor' : 'Info'}</StatusPill>
                {item.actionLabel ? <button className="ghost-button" onClick={() => onNotificationAction(item)}>{item.actionLabel}</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel full-span">
        <div className="panel-header">
          <div>
            <h3>Doručené události</h3>
            <p className="muted">Historie push/e-mail/SMS a interních notifikací pro tvůj účet.</p>
          </div>
        </div>
        <div className="stack-md">
          {inboxNotifications.length === 0 ? <EmptyState text="Zatím tu nejsou žádné doručené události." /> : inboxNotifications.map((item) => (
            <div className="list-card" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <p className="muted">{formatDateTime(item.created_at)}</p>
              </div>
              <div className="button-row wrap">
                <StatusPill tone={item.priority === 'critical' ? 'danger' : 'info'}>{item.priority === 'critical' ? 'Kritické' : 'Běžné'}</StatusPill>
                {!item.read_at ? <button className="ghost-button" onClick={() => onNotificationRead(item.id)}>Označit jako přečtené</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function DriversSection({ busy, driverForm, drivers, onDriverDelete, onDriverEdit, onSaveDriver, onToggleDriverActive, profiles, setDriverForm }) {
  return (
    <div className="grid-2">
      <section className="panel">
        <h3>{driverForm.id ? 'Upravit řidiče' : 'Nový řidič'}</h3>
        <form className="form-grid" onSubmit={onSaveDriver}>
          <label>
            Jméno
            <input value={driverForm.display_name} onChange={(event) => setDriverForm((current) => ({ ...current, display_name: event.target.value }))} />
          </label>
          <label>
            Napojení na profil
            <select value={driverForm.profile_id} onChange={(event) => setDriverForm((current) => ({ ...current, profile_id: event.target.value }))}>
              <option value="">Bez vazby</option>
              {profiles.filter((item) => item.role === 'driver').map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
            </select>
          </label>
          <label className="full-width">
            Preferované směny
            <div className="checkbox-row">
              {Object.entries(SHIFT_TYPE_LABEL).filter(([key]) => key !== 'custom').map(([value, label]) => (
                <label key={value} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={driverForm.preferred_shift_types.includes(value)}
                    onChange={(event) => setDriverForm((current) => ({
                      ...current,
                      preferred_shift_types: event.target.checked
                        ? [...current.preferred_shift_types, value]
                        : current.preferred_shift_types.filter((item) => item !== value),
                    }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </label>
          <label className="full-width">
            Poznámka
            <textarea rows="3" value={driverForm.note} onChange={(event) => setDriverForm((current) => ({ ...current, note: event.target.value }))} />
          </label>
          <button className="primary-button" disabled={busy}>Uložit řidiče</button>
        </form>
      </section>
      <section className="panel">
        <h3>Seznam řidičů</h3>
        <div className="stack-md">
          {drivers.length === 0 ? <EmptyState text="Zatím tu není žádný řidič. Nejprve vytvoř řidičský záznam vlevo." /> : null}
          {drivers.map((item) => (
            <div className="list-card" key={item.id}>
              <div>
                <strong>{item.display_name}</strong>
                <p>{(item.preferred_shift_types ?? []).map((value) => SHIFT_TYPE_LABEL[value]).join(', ') || 'Bez preferencí'}</p>
                <p className="muted">{item.note || 'Bez poznámky'}</p>
                <p className="muted">{item.active ? 'Aktivní' : 'Neaktivní'}{item.profile_id ? ' · Napojen na profil' : ''}</p>
              </div>
              <div className="button-row wrap">
                <button className="ghost-button" onClick={() => onDriverEdit(item)}>Upravit</button>
                <button className="ghost-button" onClick={() => onToggleDriverActive(item)}>{item.active ? 'Deaktivovat' : 'Aktivovat'}</button>
                <button className="danger-button" onClick={() => onDriverDelete(item)}>Smazat</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ProfilesSection({ busy, onProfileDelete, onProfileEdit, onProfileToggleActive, onSaveProfile, profileForm, profiles, setProfileForm }) {
  return (
    <div className="grid-2">
      <section className="panel">
        <h3>{profiles.some((item) => item.id === profileForm.id) ? 'Upravit uživatele' : 'Nový uživatel'}</h3>
        <p className="muted">Když necháš UUID prázdné a vyplníš dočasné heslo, aplikace vytvoří auth účet i aplikační profil sama. U role řidič navíc rovnou založí i navázaný řidičský záznam.</p>
        <form className="form-grid" onSubmit={onSaveProfile}>
          <label>
            UUID uživatele
            <input
              value={profileForm.id}
              onChange={(event) => setProfileForm((current) => ({ ...current, id: event.target.value }))}
              placeholder="např. 6f4cea4e-ec28-49c3-b774-a19360085e5f"
            />
          </label>
          <label>
            Jméno
            <input value={profileForm.full_name} onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))} />
          </label>
          <label>
            E-mail
            <input type="email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Role
            <select value={profileForm.role} onChange={(event) => setProfileForm((current) => ({ ...current, role: event.target.value }))}>
              <option value="admin">Admin</option>
              <option value="dispatcher">Dispečer</option>
              <option value="driver">Řidič</option>
            </select>
          </label>
          <label>
            Telefon
            <input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          {!profileForm.id ? (
            <label>
              Dočasné heslo pro auth účet
              <input type="password" value={profileForm.auth_password} onChange={(event) => setProfileForm((current) => ({ ...current, auth_password: event.target.value }))} placeholder="vyplň jen když chceš vytvořit i Auth účet" />
            </label>
          ) : null}
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={profileForm.active}
              onChange={(event) => setProfileForm((current) => ({ ...current, active: event.target.checked }))}
            />
            Aktivní uživatel
          </label>
          <div className="button-row full-width">
            <button className="primary-button" disabled={busy}>Uložit uživatele</button>
            <button className="ghost-button" type="button" onClick={() => setProfileForm({ id: '', full_name: '', email: '', role: 'dispatcher', phone: '', active: true, auth_password: '' })}>Nový uživatel</button>
          </div>
        </form>
      </section>
      <section className="panel">
        <h3>Seznam uživatelů</h3>
        <div className="stack-md">
          {profiles.length === 0 ? <EmptyState text="Zatím tu nejsou žádné profily." /> : profiles.map((item) => (
            <div className="list-card" key={item.id}>
              <div>
                <strong>{item.full_name}</strong>
                <p>{item.email}</p>
                <p className="muted">{ROLE_LABEL[item.role] ?? item.role} · {item.active ? 'Aktivní' : 'Neaktivní'}</p>
              </div>
              <div className="button-row wrap">
                <button className="ghost-button" onClick={() => onProfileEdit(item)}>Upravit</button>
                <button className="ghost-button" onClick={() => onProfileToggleActive(item)}>{item.active ? 'Deaktivovat' : 'Aktivovat'}</button>
                <button className="danger-button" onClick={() => onProfileDelete(item)}>Smazat</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function VehiclesSection({ busy, onSaveVehicle, onVehicleEdit, setVehicleForm, vehicleForm, vehicles }) {
  return (
    <div className="grid-2">
      <section className="panel">
        <h3>{vehicleForm.id ? 'Upravit vozidlo' : 'Nové vozidlo'}</h3>
        <form className="form-grid" onSubmit={onSaveVehicle}>
          <label>
            Název vozu
            <input value={vehicleForm.name} onChange={(event) => setVehicleForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            SPZ
            <input value={vehicleForm.plate} onChange={(event) => setVehicleForm((current) => ({ ...current, plate: event.target.value }))} />
          </label>
          <label>
            Stav
            <select value={vehicleForm.status} onChange={(event) => setVehicleForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="active">Aktivní</option>
              <option value="service">V servisu</option>
              <option value="inactive">Mimo provoz</option>
            </select>
          </label>
          <label>
            Servis od
            <input type="datetime-local" value={vehicleForm.service_from} onChange={(event) => setVehicleForm((current) => ({ ...current, service_from: event.target.value }))} />
          </label>
          <label>
            Servis do
            <input type="datetime-local" value={vehicleForm.service_to} onChange={(event) => setVehicleForm((current) => ({ ...current, service_to: event.target.value }))} />
          </label>
          <label className="full-width">
            Poznámka
            <textarea rows="3" value={vehicleForm.note} onChange={(event) => setVehicleForm((current) => ({ ...current, note: event.target.value }))} />
          </label>
          <button className="primary-button" disabled={busy}>Uložit vozidlo</button>
        </form>
      </section>
      <section className="panel">
        <h3>Vozový park</h3>
        <div className="stack-md">
          {vehicles.map((item) => (
            <div className="list-card" key={item.id}>
              <div>
                <strong>{item.name} · {item.plate}</strong>
                <p>{item.status === 'service' ? 'V servisu' : item.status === 'inactive' ? 'Mimo provoz' : 'Aktivní'}</p>
                <p className="muted">{item.note || 'Bez poznámky'}</p>
              </div>
              <button className="ghost-button" onClick={() => onVehicleEdit(item)}>Upravit</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function AvailabilitySection({ availability, availabilityForm, busy, drivers, onAvailabilityEdit, onSaveAvailability, setAvailabilityForm }) {
  return (
    <div className="grid-2">
      <section className="panel">
        <h3>{availabilityForm.id ? 'Upravit nepřítomnost' : 'Nová nepřítomnost'}</h3>
        <form className="form-grid" onSubmit={onSaveAvailability}>
          <label>
            Řidič
            <select value={availabilityForm.driver_id} onChange={(event) => setAvailabilityForm((current) => ({ ...current, driver_id: event.target.value }))}>
              <option value="">Vyber řidiče</option>
              {drivers.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
            </select>
          </label>
          <label>
            Typ
            <select value={availabilityForm.availability_type} onChange={(event) => setAvailabilityForm((current) => ({ ...current, availability_type: event.target.value }))}>
              {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Od
            <input type="datetime-local" value={availabilityForm.from_date} onChange={(event) => setAvailabilityForm((current) => ({ ...current, from_date: event.target.value }))} />
          </label>
          <label>
            Do
            <input type="datetime-local" value={availabilityForm.to_date} onChange={(event) => setAvailabilityForm((current) => ({ ...current, to_date: event.target.value }))} />
          </label>
          <label className="full-width">
            Poznámka
            <textarea rows="3" value={availabilityForm.note} onChange={(event) => setAvailabilityForm((current) => ({ ...current, note: event.target.value }))} />
          </label>
          <button className="primary-button" disabled={busy}>Uložit nepřítomnost</button>
        </form>
      </section>
      <section className="panel">
        <h3>Evidence nepřítomností</h3>
        <div className="stack-md">
          {availability.length === 0 ? <EmptyState text="Zatím nejsou zadané žádné nepřítomnosti." /> : availability.map((item) => (
            <div className="list-card" key={item.id}>
              <div>
                <strong>{drivers.find((driver) => driver.id === item.driver_id)?.display_name ?? 'Neznámý řidič'}</strong>
                <p>{AVAILABILITY_LABEL[item.availability_type]} · {formatDateTime(item.from_date)} — {formatDateTime(item.to_date)}</p>
                <p className="muted">{item.note || 'Bez poznámky'}</p>
              </div>
              <button className="ghost-button" onClick={() => onAvailabilityEdit(item)}>Upravit</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function HistorySection({ changeLog, profiles }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>Historie změn</h3>
          <p className="muted">Audit log pro dohledání změn ve směnách, autech a dostupnosti.</p>
        </div>
      </div>
      <div className="stack-md">
        {changeLog.length === 0 ? <EmptyState text="Zatím nebyly zaznamenány žádné změny." /> : changeLog.map((item) => (
          <div className="list-card" key={item.id}>
            <div>
              <strong>{item.entity_type} · {item.action}</strong>
              <p>{formatDateTime(item.created_at)}</p>
              <p className="muted">Uživatel: {profiles.find((profile) => profile.id === item.user_id)?.full_name ?? item.user_id ?? '—'}</p>
            </div>
            <StatusPill>{item.entity_type}</StatusPill>
          </div>
        ))}
      </div>
    </section>
  )
}

function ShiftListItem({ shift, compact = false }) {
  return (
    <div className={cx('list-card', compact && 'compact')}>
      <div>
        <strong>{shift.driver?.display_name ?? 'Bez řidiče'} · {SHIFT_TYPE_LABEL[shift.shift_type]}</strong>
        <p>{formatDate(shift.start_at, { weekday: 'long' })} · {formatTime(shift.start_at)}–{formatTime(shift.end_at)}</p>
        <p className="muted">{shift.vehicle?.name ?? 'Bez auta'} · {shift.vehicle?.plate ?? '—'}</p>
      </div>
      <StatusPill tone={shift.driver_response === 'accepted' ? 'success' : shift.driver_response === 'declined' ? 'danger' : 'warning'}>{RESPONSE_LABEL[shift.driver_response]}</StatusPill>
    </div>
  )
}

export function StatusPill({ children, tone = 'neutral' }) {
  return <span className={cx('pill', `pill-${tone}`)}>{children}</span>
}

function StatCard({ label, value, tone = 'neutral' }) {
  return (
    <div className="stat-card">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      <span className={cx('stat-dot', `stat-dot-${tone}`)} />
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>
}
