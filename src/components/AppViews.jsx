import { useState } from 'react'
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

function getLocalDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function getLocalDateTimeInputValue(value) {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function overlaps(startA, endA, startB, endB) {
  return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB)
}

function getDriverShiftTone(shift) {
  if (shift.status === 'replacement_needed') return 'offered'
  if (shift.driver_response === 'accepted') return 'accepted'
  if (shift.driver_response === 'declined') return 'declined'
  return 'pending'
}

function getDriverShiftStatusText(shift) {
  if (shift.status === 'replacement_needed') return 'Nabídnuto k přeobsazení'
  if (shift.status === 'cancelled') return 'Zrušeno'
  if (shift.driver_response === 'pending') return 'Čeká na tvoje potvrzení'
  if (shift.driver_response === 'accepted') return 'Potvrzeno'
  if (shift.driver_response === 'declined') return 'Odmítnuto'
  return STATUS_LABEL[shift.status] ?? 'Bez stavu'
}

export function DriverView({
  activeTab,
  currentDriver,
  dataLoading,
  inboxNotifications,
  visibleInboxNotifications,
  notifications,
  notificationHistoryFilter,
  notificationPreferences,
  onEnablePush,
  onNotificationAction,
  onNotificationHistoryFilterChange,
  onNotificationPreferenceSave,
  onNotificationRead,
  onTestPush,
  myShiftApplications,
  openShifts,
  onApplyOpenShift,
  onOfferShiftToDriver,
  onRejectHandoverRequest,
  upcomingShift,
  visibleShifts,
  replacementOffers,
  pendingHandoverByShiftId = {},
  drivers = [],
  availability,
  onRespond,
  onTakeoverShift,
  availabilityForm,
  setAvailabilityForm,
  onSaveAvailability,
  driversMap,
  vehiclesMap,
  busy,
}) {
  const [handoverTargets, setHandoverTargets] = useState({})
  const [shiftTimeline, setShiftTimeline] = useState('upcoming')
  const [shiftFilter, setShiftFilter] = useState('week')
  const [selectedShiftDay, setSelectedShiftDay] = useState(() => getLocalDateKey(new Date()))
  const myAvailability = availability.filter((item) => item.driver_id === currentDriver?.id)
  const handoverCandidates = drivers.filter((driver) => driver.active && driver.id !== currentDriver?.id)
  const pendingShiftCount = visibleShifts.filter((shift) => shift.driver_response === 'pending').length
  const offeredByMeCount = visibleShifts.filter((shift) => shift.driver_response === 'accepted' && shift.status === 'replacement_needed').length
  const actionCount = pendingShiftCount + replacementOffers.length + notifications.filter((item) => item.tone !== 'info').length
  const nextShiftDate = visibleShifts[1]?.start_at ? formatDate(visibleShifts[1].start_at, { weekday: 'long' }) : 'žádná další směna'
  const now = new Date()
  const todayKey = getLocalDateKey(now)
  const weekEndKey = getLocalDateKey(addDays(now, 6))
  const nextSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(now, index)
    const key = getLocalDateKey(date)
    const shifts = visibleShifts.filter((shift) => getLocalDateKey(shift.start_at) === key)
    return {
      key,
      date,
      shifts,
      label: index === 0 ? 'Dnes' : index === 1 ? 'Zítra' : formatDate(date, { weekday: 'short' }),
      hasPending: shifts.some((shift) => shift.driver_response === 'pending'),
    }
  })
  const upcomingDriverShifts = visibleShifts.filter((shift) => new Date(shift.end_at) >= now)
  const historyDriverShifts = visibleShifts.filter((shift) => new Date(shift.end_at) < now)
  const baseDriverShifts = shiftTimeline === 'history' ? historyDriverShifts : upcomingDriverShifts
  const filteredDriverShifts = baseDriverShifts.filter((shift) => {
    const shiftKey = getLocalDateKey(shift.start_at)
    if (shiftFilter === 'today') return shiftKey === todayKey
    if (shiftFilter === 'week') return shiftKey >= todayKey && shiftKey <= weekEndKey
    if (shiftFilter === 'night') return shift.shift_type === 'N'
    if (shiftFilter === 'pending') return shift.driver_response === 'pending'
    if (shiftFilter === 'day') return shiftKey === selectedShiftDay
    return true
  })
  const groupedDriverShifts = filteredDriverShifts.reduce((acc, shift) => {
    const key = getLocalDateKey(shift.start_at)
    acc[key] = [...(acc[key] ?? []), shift]
    return acc
  }, {})
  const groupedDriverShiftKeys = Object.keys(groupedDriverShifts).sort()
  const weekShiftCount = visibleShifts.filter((shift) => {
    const shiftKey = getLocalDateKey(shift.start_at)
    return shiftKey >= todayKey && shiftKey <= weekEndKey
  }).length
  const weekPendingCount = visibleShifts.filter((shift) => {
    const shiftKey = getLocalDateKey(shift.start_at)
    return shiftKey >= todayKey && shiftKey <= weekEndKey && shift.driver_response === 'pending'
  }).length
  const weekAcceptedCount = visibleShifts.filter((shift) => {
    const shiftKey = getLocalDateKey(shift.start_at)
    return shiftKey >= todayKey && shiftKey <= weekEndKey && shift.driver_response === 'accepted'
  }).length
  const weekNightCount = visibleShifts.filter((shift) => {
    const shiftKey = getLocalDateKey(shift.start_at)
    return shiftKey >= todayKey && shiftKey <= weekEndKey && shift.shift_type === 'N'
  }).length
  const weekSummaryText = weekShiftCount
    ? `${weekAcceptedCount} potvrzeno · ${weekPendingCount ? `${weekPendingCount} čeká` : 'vše vyřízené'} · ${weekNightCount} noční`
    : 'Tento týden zatím nemáš naplánovanou směnu.'
  const todayDriverShifts = visibleShifts.filter((shift) => getLocalDateKey(shift.start_at) === todayKey)
  const nextPendingShift = visibleShifts.find((shift) => shift.driver_response === 'pending')
  const daySelectValue = shiftFilter === 'day'
    ? selectedShiftDay
    : shiftFilter === 'today'
      ? todayKey
      : shiftFilter === 'week'
        ? 'week'
      : 'week'

  const applyAvailabilityPreset = (preset) => {
    const start = new Date()
    const end = new Date()

    if (preset === 'today') {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 0, 0)
    }

    if (preset === 'tomorrow') {
      start.setDate(start.getDate() + 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() + 1)
      end.setHours(23, 59, 0, 0)
    }

    if (preset === 'weekend') {
      const day = start.getDay()
      const daysUntilSaturday = (6 - day + 7) % 7
      start.setDate(start.getDate() + daysUntilSaturday)
      start.setHours(0, 0, 0, 0)
      end.setTime(start.getTime())
      end.setDate(end.getDate() + 1)
      end.setHours(23, 59, 0, 0)
    }

    setAvailabilityForm((current) => ({
      ...current,
      driver_id: currentDriver.id,
      availability_type: 'unavailable',
      from_date: getLocalDateTimeInputValue(start),
      to_date: getLocalDateTimeInputValue(end),
    }))
  }

  const renderTargetedHandover = (shift) => {
    const pendingRequest = pendingHandoverByShiftId[shift.id]
    const selectedTarget = handoverTargets[shift.id] ?? ''

    return (
      <div className="handover-box">
        {pendingRequest ? (
          <p className="muted">
            Nabídnuto konkrétně: {driversMap[pendingRequest.target_driver_id]?.display_name ?? 'vybraný kolega'}.
          </p>
        ) : null}
        {handoverCandidates.length === 0 ? (
          <p className="muted">Konkrétní kolegové zatím nejsou dostupní. Zkontroluj, že existují aktivní řidiči a že je v Supabase spuštěné aktuální SQL schéma.</p>
        ) : (
          <div className="form-grid compact-form-grid">
            <label>
              Poslat konkrétnímu kolegovi
              <select
                value={selectedTarget}
                onChange={(event) => setHandoverTargets((current) => ({ ...current, [shift.id]: event.target.value }))}
              >
                <option value="">Vyber kolegu</option>
                {handoverCandidates.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.display_name}</option>
                ))}
              </select>
            </label>
            <button
              className="ghost-button"
              disabled={busy || !selectedTarget}
              onClick={() => onOfferShiftToDriver(shift, selectedTarget)}
            >
              Poslat nabídku
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderOwnShiftActions = (shift) => {
    if (shift.driver_response === 'pending') {
      return (
        <div className="button-row">
          <button className="primary-button" disabled={busy} onClick={() => onRespond(shift, 'accepted')}>Potvrdit směnu</button>
          <button
            className="danger-button"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Opravdu chceš směnu odmítnout? Dispečer uvidí, že je potřeba ji řešit.')) onRespond(shift, 'declined')
            }}
          >
            Odmítnout
          </button>
        </div>
      )
    }

    if (shift.driver_response === 'accepted' && ['confirmed', 'replacement_needed'].includes(shift.status)) {
      return (
        <div className="stack-md">
          {shift.status === 'replacement_needed' ? (
            <p className="muted">Směna je nabídnutá k přeobsazení, ale zatím zůstává přiřazená tobě.</p>
          ) : null}
          <details className="driver-inline-details">
            <summary>Potřebuji změnu</summary>
            <div className="stack-md">
              {shift.status === 'confirmed' ? (
                <div className="button-row">
                  <button
                    className="ghost-button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Nabídnout tuto směnu všem kolegům? Dokud ji někdo nepřevezme, zůstává přiřazená tobě.')) onRespond(shift, 'offer')
                    }}
                  >
                    Nabídnout všem
                  </button>
                  <button
                    className="danger-button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Opravdu chceš zrušit účast na této směně?')) onRespond(shift, 'release')
                    }}
                  >
                    Zrušit účast
                  </button>
                </div>
              ) : null}
              {renderTargetedHandover(shift)}
            </div>
          </details>
        </div>
      )
    }

    return (
      <p className="muted">
        {shift.driver_response === 'accepted'
          ? 'Tato směna je potvrzená.'
          : shift.driver_response === 'declined'
            ? 'Tato směna byla odmítnutá a čeká na další řešení.'
            : 'Na této směně není potřeba další akce.'}
      </p>
    )
  }

  if (!currentDriver) {
    return <div className="panel">{dataLoading ? 'Načítám řidičská data…' : 'K tomuto profilu zatím není přiřazen řidičský záznam.'}</div>
  }

  if (activeTab === 'today') {
    return (
      <div className="stack-xl">
        <div className={cx('hero-card', 'driver-hero-card', upcomingShift?.driver_response === 'pending' && 'driver-hero-attention')}>
          <div>
            <div className="eyebrow">Řidičský kokpit</div>
            <h2>{upcomingShift ? 'Nejbližší směna' : 'Všechno vyřízeno'}</h2>
            {upcomingShift ? (
              <>
                <p className="driver-hero-time">{formatTime(upcomingShift.start_at)}–{formatTime(upcomingShift.end_at)}</p>
                <p>{formatDate(upcomingShift.start_at, { weekday: 'long' })} · {SHIFT_TYPE_LABEL[upcomingShift.shift_type]} · {upcomingShift.vehicle?.plate ?? 'Bez auta'}</p>
              </>
            ) : (
              <p>Na dnešek ani nejbližší dobu tu nevidím žádnou akci, která by po tobě něco chtěla.</p>
            )}
          </div>
          {upcomingShift && <StatusPill tone={upcomingShift.driver_response === 'accepted' ? 'success' : upcomingShift.driver_response === 'declined' ? 'danger' : 'warning'}>{getDriverShiftStatusText(upcomingShift)}</StatusPill>}
          {upcomingShift ? (
            <div className="driver-hero-actions">
              {renderOwnShiftActions(upcomingShift)}
            </div>
          ) : null}
        </div>

        <div className="driver-today-brief">
          <div className={cx('driver-brief-card', actionCount > 0 && 'driver-brief-attention')}>
            <span>Co vyžaduje akci</span>
            <strong>{actionCount}</strong>
            <p>{nextPendingShift ? `${formatDate(nextPendingShift.start_at, { weekday: 'long' })} čeká na potvrzení` : actionCount ? 'Mrkni na Úkoly' : 'Všechno je vyřízené'}</p>
          </div>
          <div className="driver-brief-card">
            <span>Dnes</span>
            <strong>{todayDriverShifts.length}</strong>
            <p>{todayDriverShifts.length ? todayDriverShifts.map((shift) => `${formatTime(shift.start_at)}–${formatTime(shift.end_at)}`).join(', ') : 'Bez směny'}</p>
          </div>
          <div className="driver-brief-card">
            <span>Další směna</span>
            <strong>{upcomingShift ? formatTime(upcomingShift.start_at) : '—'}</strong>
            <p>{upcomingShift ? `${nextShiftDate} · ${upcomingShift.vehicle?.plate ?? 'Bez auta'}` : 'Zatím není naplánovaná'}</p>
          </div>
          {replacementOffers.length || offeredByMeCount ? (
            <div className="driver-brief-card">
              <span>Záskoky</span>
              <strong>{replacementOffers.length + offeredByMeCount}</strong>
              <p>{replacementOffers.length ? `${replacementOffers.length} k převzetí` : `${offeredByMeCount} nabídnuté mnou`}</p>
            </div>
          ) : null}
        </div>

        {upcomingShift ? (
          <div className="driver-next-detail">
            <div>
              <span>Auto</span>
              <strong>{upcomingShift.vehicle?.plate ?? 'Bez auta'}</strong>
              <p>{upcomingShift.vehicle?.name ?? 'Vozidlo není doplněné'}</p>
            </div>
            <div>
              <span>Stav</span>
              <strong>{getDriverShiftStatusText(upcomingShift)}</strong>
              <p>{SHIFT_TYPE_LABEL[upcomingShift.shift_type]}</p>
            </div>
            <details>
              <summary>Poznámka směny</summary>
              <p>{upcomingShift.note || 'Bez poznámky'}</p>
            </details>
          </div>
        ) : (
          <section className="panel">
            <EmptyState
              actionLabel="Zobrazit volné směny"
              onAction={() => onNotificationAction({ targetTab: 'open-shifts' })}
              text="Nemáš žádnou nejbližší směnu. Pokud chceš, mrkni na volné směny."
            />
          </section>
        )}
      </div>
    )
  }

  if (activeTab === 'notifications') {
    return (
      <DriverTasksSection
        inboxNotifications={inboxNotifications}
        replacementOffers={replacementOffers}
        visibleInboxNotifications={visibleInboxNotifications}
        notifications={notifications}
        notificationHistoryFilter={notificationHistoryFilter}
        notificationPreferences={notificationPreferences}
        onEnablePush={onEnablePush}
        onNotificationAction={onNotificationAction}
        onNotificationHistoryFilterChange={onNotificationHistoryFilterChange}
        onNotificationPreferenceSave={onNotificationPreferenceSave}
        onNotificationRead={onNotificationRead}
        onTestPush={onTestPush}
        onRejectHandoverRequest={onRejectHandoverRequest}
        onTakeoverShift={onTakeoverShift}
        pendingHandoverByShiftId={pendingHandoverByShiftId}
        currentDriver={currentDriver}
        vehiclesMap={vehiclesMap}
        busy={busy}
      />
    )
  }

  if (activeTab === 'open-shifts') {
    return (
      <OpenShiftsSection
        applications={myShiftApplications}
        availability={availability}
        busy={busy}
        currentDriver={currentDriver}
        onApplyOpenShift={onApplyOpenShift}
        openShifts={openShifts}
        visibleShifts={visibleShifts}
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
            <div className="availability-presets full-width">
              <button type="button" className="ghost-button" onClick={() => applyAvailabilityPreset('today')}>Nemůžu dnes</button>
              <button type="button" className="ghost-button" onClick={() => applyAvailabilityPreset('tomorrow')}>Nemůžu zítra</button>
              <button type="button" className="ghost-button" onClick={() => applyAvailabilityPreset('weekend')}>Blokovat víkend</button>
            </div>
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
            <p className="muted">Rychlý týdenní přehled a akce jen tam, kde dávají smysl.</p>
          </div>
        </div>

        <div className="driver-shift-summary">
          <strong>{weekShiftCount} směn tento týden</strong>
          <span>{weekPendingCount ? `${weekPendingCount} čeká na potvrzení` : 'nic nečeká na potvrzení'}</span>
          <span>nejbližší: {upcomingShift ? `${formatDate(upcomingShift.start_at, { weekday: 'long' })} ${formatTime(upcomingShift.start_at)}` : 'žádná'}</span>
        </div>
        <p className="driver-week-copy">{weekSummaryText}</p>

        <div className="driver-shift-controls">
          <div className="driver-week-strip" aria-label="Týdenní přehled směn">
            {nextSevenDays.map((day) => (
              <button
                className={cx('driver-day-button', selectedShiftDay === day.key && shiftFilter === 'day' && 'active', day.hasPending && 'has-alert')}
                key={day.key}
                type="button"
                onClick={() => {
                  setSelectedShiftDay(day.key)
                  setShiftTimeline('upcoming')
                  setShiftFilter('day')
                }}
              >
                <span>{day.label}</span>
                <strong>{day.shifts.length}</strong>
                {day.hasPending ? <i aria-label="Čeká na potvrzení" /> : null}
              </button>
            ))}
          </div>

          <div className="driver-filter-row">
            <button className={cx('driver-filter-button', shiftTimeline === 'upcoming' && 'active')} type="button" onClick={() => { setShiftTimeline('upcoming'); setShiftFilter('week') }}>Nadcházející</button>
            <button className={cx('driver-filter-button', shiftTimeline === 'history' && 'active')} type="button" onClick={() => { setShiftTimeline('history'); setShiftFilter('all') }}>Historie</button>
            <button className={cx('driver-filter-button', 'driver-desktop-filter', shiftFilter === 'all' && 'active')} type="button" onClick={() => setShiftFilter('all')}>Vše</button>
            <button className={cx('driver-filter-button', 'driver-desktop-filter', shiftFilter === 'today' && 'active')} type="button" onClick={() => { setShiftTimeline('upcoming'); setShiftFilter('today') }}>Dnes</button>
            <button className={cx('driver-filter-button', 'driver-desktop-filter', shiftFilter === 'week' && 'active')} type="button" onClick={() => { setShiftTimeline('upcoming'); setShiftFilter('week') }}>Týden</button>
            <button className={cx('driver-filter-button', shiftFilter === 'night' && 'active')} type="button" onClick={() => setShiftFilter('night')}>Noční</button>
            <button className={cx('driver-filter-button', shiftFilter === 'pending' && 'active')} type="button" onClick={() => { setShiftTimeline('upcoming'); setShiftFilter('pending') }}>Čeká</button>
          </div>

          {shiftTimeline === 'upcoming' ? (
            <label className="driver-day-select-wrap">
              Den
              <select
                value={daySelectValue}
                onChange={(event) => {
                  const value = event.target.value
                  if (value === 'week') {
                    setShiftFilter(value)
                    return
                  }
                  setSelectedShiftDay(value)
                  setShiftFilter('day')
                }}
              >
                <option value="week">Celý týden ({weekShiftCount})</option>
                {nextSevenDays.map((day) => (
                  <option key={day.key} value={day.key}>
                    {day.label} · {formatDate(day.date)} · {day.shifts.length} směn
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="stack-lg driver-timeline-list">
          {visibleShifts.length === 0 ? (
            <EmptyState
              actionLabel="Zobrazit volné směny"
              onAction={() => onNotificationAction({ targetTab: 'open-shifts' })}
              text="Zatím nemáš žádné směny."
            />
          ) : null}
          {visibleShifts.length > 0 && groupedDriverShiftKeys.length === 0 ? (
            <EmptyState
              actionLabel={shiftTimeline === 'history' ? undefined : 'Zobrazit volné směny'}
              onAction={shiftTimeline === 'history' ? undefined : () => onNotificationAction({ targetTab: 'open-shifts' })}
              text="Pro vybraný filtr tu není žádná směna."
            />
          ) : null}
          {groupedDriverShiftKeys.map((dayKey) => {
            const dayShifts = groupedDriverShifts[dayKey]
            const dayDate = new Date(`${dayKey}T12:00:00`)
            const pendingCount = dayShifts.filter((shift) => shift.driver_response === 'pending').length

            return (
              <div className="driver-day-card driver-timeline-day" key={dayKey}>
                <div className="driver-day-card-header">
                  <div>
                    <strong>{formatDate(dayDate, { weekday: 'long' })}</strong>
                    <span>{formatDate(dayDate)}</span>
                  </div>
                  <StatusPill tone={pendingCount ? 'warning' : 'info'}>
                    {pendingCount ? `${pendingCount} čeká` : `${dayShifts.length} směn`}
                  </StatusPill>
                </div>
                <div className="stack-md">
                  {dayShifts.map((shift) => {
                    const tone = getDriverShiftTone(shift)
                    const showActions = shift.driver_response === 'pending' || (shift.driver_response === 'accepted' && ['confirmed', 'replacement_needed'].includes(shift.status))

                    return (
                      <details className={cx('list-card', 'driver-shift-card', 'driver-shift-details', `driver-shift-card-${tone}`)} key={shift.id}>
                        <span className="driver-shift-status-bar" aria-hidden="true" />
                        <summary>
                          <span className="driver-shift-timebox">
                            <strong>{formatTime(shift.start_at)}</strong>
                            <small>{formatTime(shift.end_at)}</small>
                          </span>
                          <div>
                            <strong>{SHIFT_TYPE_LABEL[shift.shift_type]}</strong>
                            <p>{vehiclesMap[shift.vehicle_id]?.plate ?? 'Bez auta'} · {getDriverShiftStatusText(shift)}</p>
                          </div>
                          <StatusPill tone={shift.driver_response === 'accepted' ? 'success' : shift.driver_response === 'declined' ? 'danger' : 'warning'}>{getDriverShiftStatusText(shift)}</StatusPill>
                        </summary>
                        <div className="driver-shift-expanded">
                          <InfoRow label="Poznámka" value={shift.note || 'Bez poznámky'} />
                          {showActions ? (
                            shift.driver_response === 'pending'
                              ? renderOwnShiftActions(shift)
                              : <details className="driver-inline-details compact"><summary>Možnosti směny</summary><div className="driver-details-body">{renderOwnShiftActions(shift)}</div></details>
                          ) : null}
                        </div>
                      </details>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {replacementOffers.length > 0 ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Směny k převzetí</h3>
              <p className="muted">Nabídky od kolegů najdeš také v Úkolech.</p>
            </div>
          </div>
          <div className="stack-md">
            {replacementOffers.map((shift) => (
              <div className="list-card driver-shift-card" key={shift.id}>
                <div>
                  <strong>{formatTime(shift.start_at)}–{formatTime(shift.end_at)} · {formatDate(shift.start_at, { weekday: 'long' })}</strong>
                  <p>{SHIFT_TYPE_LABEL[shift.shift_type]} · {shift.vehicle?.plate ?? vehiclesMap[shift.vehicle_id]?.plate ?? 'Bez auta'}</p>
                  <p className="muted">{shift.note || 'Nabídnutá směna čeká na převzetí.'}</p>
                </div>
                <div className="button-row wrap">
                  <StatusPill tone={pendingHandoverByShiftId[shift.id]?.target_driver_id === currentDriver.id ? 'warning' : 'danger'}>
                    {pendingHandoverByShiftId[shift.id]?.target_driver_id === currentDriver.id ? 'Nabídnuto tobě' : 'Záskok'}
                  </StatusPill>
                  <button className="primary-button" disabled={busy} onClick={() => onTakeoverShift(shift)}>Převzít</button>
                  {pendingHandoverByShiftId[shift.id]?.target_driver_id === currentDriver.id ? (
                    <button className="ghost-button" disabled={busy} onClick={() => onRejectHandoverRequest(pendingHandoverByShiftId[shift.id])}>Odmítnout</button>
                  ) : null}
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
    weeklyCoverage,
    shiftApplicationsByShiftId,
    onboardingItems,
    notifications,
    notificationHistoryFilter,
    notificationPreferences,
    visibleInboxNotifications,
    inboxNotifications,
    onEnablePush,
    onNotificationAction,
    onNotificationHistoryFilterChange,
    onNotificationPreferenceSave,
    onNotificationRead,
    onTestPush,
    onApproveShiftApplication,
    drivers,
    driversMap,
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
        visibleInboxNotifications={visibleInboxNotifications}
        notifications={notifications}
        notificationHistoryFilter={notificationHistoryFilter}
        notificationPreferences={notificationPreferences}
        onEnablePush={onEnablePush}
        onNotificationAction={onNotificationAction}
        onNotificationHistoryFilterChange={onNotificationHistoryFilterChange}
        onNotificationPreferenceSave={onNotificationPreferenceSave}
        onNotificationRead={onNotificationRead}
        onTestPush={onTestPush}
      />
    )
  }

  if (activeTab === 'coverage') {
    return (
      <WeeklyCoverageSection
        applicationsByShiftId={shiftApplicationsByShiftId}
        busy={busy}
        driversMap={driversMap}
        onApproveShiftApplication={onApproveShiftApplication}
        onEditShift={onEditShift}
        weeklyCoverage={weeklyCoverage}
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

function CoverageMeter({ assigned, capacity, open }) {
  const ratio = capacity > 0 ? assigned / capacity : 0
  const tone = assigned >= capacity ? 'success' : assigned + open >= capacity ? 'warning' : 'danger'
  return (
    <div className="coverage-meter">
      <div className="coverage-meter-head">
        <strong>{assigned}/{capacity}</strong>
        {open > 0 ? <span className="muted">+{open} volné</span> : <span className="muted">bez volných</span>}
      </div>
      <div className="coverage-track">
        <span className={cx('coverage-fill', `coverage-${tone}`)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  )
}

function WeeklyCoverageSection({ applicationsByShiftId, busy, driversMap, onApproveShiftApplication, onEditShift, weeklyCoverage }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>Týdenní obsazenost</h3>
          <p className="muted">Kapacita: Po-Čt 2 denní/2 noční, Pá-So 2 denní/5 nočních, Ne 1 denní/1 noční.</p>
        </div>
      </div>
      <div className="coverage-grid">
        {weeklyCoverage.map((day) => (
          <div className="coverage-card" key={day.label}>
            <div>
              <strong>{day.label}</strong>
              <p className="muted">{formatDate(day.date)}</p>
            </div>
            <div className="coverage-row">
              <span>Denní</span>
              <CoverageMeter assigned={day.day.assigned} capacity={day.day.capacity} open={day.day.open} />
            </div>
            <div className="coverage-row">
              <span>Noční</span>
              <CoverageMeter assigned={day.night.assigned} capacity={day.night.capacity} open={day.night.open} />
            </div>
            <div className="stack-md">
              {[...day.day.shifts, ...day.night.shifts].length === 0 ? <p className="muted">Bez směn.</p> : [...day.day.shifts, ...day.night.shifts].map((shift) => {
                const applications = applicationsByShiftId[shift.id] ?? []
                return (
                  <div className="coverage-shift" key={shift.id}>
                    <div>
                      <strong>{formatTime(shift.start_at)}–{formatTime(shift.end_at)}</strong>
                      <p className="muted">{shift.driver?.display_name ?? 'Volná směna'} · {shift.vehicle?.plate ?? 'Bez auta'}</p>
                    </div>
                    <div className="button-row wrap">
                      <StatusPill tone={shift.driver_id ? 'success' : applications.length ? 'warning' : 'danger'}>
                        {shift.driver_id ? 'Obsazeno' : `${applications.filter((item) => item.status === 'pending').length} zájemci`}
                      </StatusPill>
                      <button className="ghost-button" onClick={() => onEditShift(shift)}>Otevřít</button>
                    </div>
                    {!shift.driver_id && applications.filter((item) => item.status === 'pending').length > 0 ? (
                      <div className="application-list">
                        {applications.filter((item) => item.status === 'pending').map((application) => (
                          <div className="application-row" key={application.id}>
                            <span>{driversMap[application.driver_id]?.display_name ?? 'Řidič'}</span>
                            <button className="primary-button" disabled={busy} onClick={() => onApproveShiftApplication(application)}>Schválit</button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function DriverTasksSection({
  busy,
  currentDriver,
  inboxNotifications,
  notificationHistoryFilter,
  notificationPreferences,
  notifications,
  onEnablePush,
  onNotificationAction,
  onNotificationHistoryFilterChange,
  onNotificationPreferenceSave,
  onNotificationRead,
  onRejectHandoverRequest,
  onTestPush,
  onTakeoverShift,
  pendingHandoverByShiftId,
  replacementOffers,
  vehiclesMap,
  visibleInboxNotifications,
}) {
  const hasPrimaryTasks = notifications.length > 0 || replacementOffers.length > 0
  const pushPreferenceEnabled = Boolean(notificationPreferences.push_enabled)

  return (
    <div className="stack-xl">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Úkoly</h3>
            <p className="muted">Všechno, co po tobě aplikace právě chce. Když je prázdno, máš klid.</p>
          </div>
          <StatusPill tone={hasPrimaryTasks ? 'warning' : 'success'}>{hasPrimaryTasks ? 'Vyžaduje akci' : 'Hotovo'}</StatusPill>
        </div>
        <div className="driver-inbox-summary">
          <div>
            <span>Nové úkoly</span>
            <strong>{notifications.length}</strong>
          </div>
          <div>
            <span>Nabídky směn</span>
            <strong>{replacementOffers.length}</strong>
          </div>
          <div>
            <span>Historie</span>
            <strong>{inboxNotifications.length}</strong>
          </div>
        </div>
        <div className="driver-task-list">
          {!hasPrimaryTasks ? <EmptyState text="Teď tu není nic k vyřízení." /> : null}
          {notifications.map((item) => (
            <div className={cx('driver-task-card', 'driver-inbox-card', `driver-task-${item.tone ?? 'info'}`)} key={item.id}>
              <span className="driver-inbox-dot" aria-hidden="true" />
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
              <div className="button-row wrap">
                <StatusPill tone={item.tone}>{item.tone === 'danger' ? 'Důležité' : item.tone === 'warning' ? 'Akce' : 'Info'}</StatusPill>
                {item.actionLabel ? <button className="primary-button" onClick={() => onNotificationAction(item)}>{item.actionLabel}</button> : null}
              </div>
            </div>
          ))}
          {replacementOffers.map((shift) => {
            const handoverRequest = pendingHandoverByShiftId[shift.id]
            const targetedToMe = handoverRequest?.target_driver_id === currentDriver.id

            return (
              <div className={cx('driver-task-card', 'driver-inbox-card', targetedToMe ? 'driver-task-warning' : 'driver-task-danger')} key={shift.id}>
                <span className="driver-inbox-dot" aria-hidden="true" />
                <div>
                  <strong>{targetedToMe ? 'Kolega ti nabízí směnu' : 'Směna k převzetí'}</strong>
                  <p>{formatDate(shift.start_at, { weekday: 'long' })} · {formatTime(shift.start_at)}–{formatTime(shift.end_at)} · {shift.vehicle?.plate ?? vehiclesMap[shift.vehicle_id]?.plate ?? 'Bez auta'}</p>
                  {shift.note ? (
                    <details className="driver-inline-details compact"><summary>Poznámka</summary><div className="driver-details-body">{shift.note}</div></details>
                  ) : <p className="muted">Nabídnutá směna čeká na převzetí.</p>}
                </div>
                <div className="button-row wrap">
                  <button className="primary-button" disabled={busy} onClick={() => onTakeoverShift(shift)}>Převzít směnu</button>
                  {targetedToMe ? (
                    <button className="ghost-button" disabled={busy} onClick={() => onRejectHandoverRequest(handoverRequest)}>Odmítnout</button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <details className="panel driver-preferences">
        <summary>Historie upozornění ({inboxNotifications.length})</summary>
        <div className="stack-md driver-details-body">
          <div className="button-row wrap">
            {[
              ['recent', 'Týden'],
              ['unread', 'Nepřečtené'],
              ['all', 'Vše'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={cx('ghost-button', notificationHistoryFilter === value && 'active-pill')}
                onClick={() => onNotificationHistoryFilterChange(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {visibleInboxNotifications.length === 0 ? <EmptyState text="Pro vybraný filtr tu nejsou žádné doručené události." /> : visibleInboxNotifications.slice(0, 8).map((item) => (
            <div className="list-card compact" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <p className="muted">{formatDateTime(item.created_at)}</p>
              </div>
              <div className="button-row wrap">
                {item.shift_id ? <button className="ghost-button" onClick={() => onNotificationAction(item)}>Otevřít</button> : null}
                {!item.read_at ? <button className="ghost-button" onClick={() => onNotificationRead(item.id)}>Přečteno</button> : null}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="panel driver-preferences">
        <summary>Nastavení upozornění</summary>
        <div className={cx('notification-health', pushPreferenceEnabled ? 'notification-health-on' : 'notification-health-off')}>
          <strong>{pushPreferenceEnabled ? 'Push notifikace jsou v aplikaci zapnuté' : 'Push notifikace nejsou zapnuté'}</strong>
          <p>
            {pushPreferenceEnabled
              ? 'Pro upozornění mimo otevřenou aplikaci musí být push povolený i v prohlížeči a aplikace musí být nainstalovaná.'
              : 'Zapni push a povol ho v prohlížeči, aby řidič dostal upozornění i mimo otevřenou aplikaci.'}
          </p>
        </div>
        <div className="form-grid">
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={notificationPreferences.push_enabled}
              onChange={(event) => onNotificationPreferenceSave({ ...notificationPreferences, push_enabled: event.target.checked })}
            />
            Push
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={notificationPreferences.email_enabled}
              onChange={(event) => onNotificationPreferenceSave({ ...notificationPreferences, email_enabled: event.target.checked })}
            />
            E-mail
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={notificationPreferences.sms_enabled}
              onChange={(event) => onNotificationPreferenceSave({ ...notificationPreferences, sms_enabled: event.target.checked })}
            />
            SMS
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={notificationPreferences.critical_only}
              onChange={(event) => onNotificationPreferenceSave({ ...notificationPreferences, critical_only: event.target.checked })}
            />
            Jen kritické externě
          </label>
          <label className="full-width">
            Telefon pro SMS
            <input
              value={notificationPreferences.phone_override ?? ''}
              placeholder="např. +420777123456"
              onChange={(event) => onNotificationPreferenceSave({ ...notificationPreferences, phone_override: event.target.value })}
            />
          </label>
          <div className="button-row full-width">
            <button className="primary-button" type="button" onClick={onEnablePush}>Povolit push v prohlížeči</button>
            <button className="ghost-button" type="button" onClick={onTestPush}>Odeslat test push</button>
          </div>
        </div>
      </details>
    </div>
  )
}

function OpenShiftsSection({ applications, availability, busy, currentDriver, onApplyOpenShift, openShifts, visibleShifts }) {
  const applicationsByShiftId = applications.reduce((acc, item) => {
    acc[item.shift_id] = item
    return acc
  }, {})

  const getSuitability = (shift) => {
    if (!currentDriver) return { tone: 'info', label: 'Volná směna' }
    const hasShiftConflict = visibleShifts.some((item) => overlaps(item.start_at, item.end_at, shift.start_at, shift.end_at))
    if (hasShiftConflict) return { tone: 'danger', label: 'Kolize s tvojí směnou' }
    const hasAvailabilityConflict = availability.some((item) => (
      item.driver_id === currentDriver.id &&
      item.availability_type !== 'available' &&
      overlaps(item.from_date, item.to_date, shift.start_at, shift.end_at)
    ))
    if (hasAvailabilityConflict) return { tone: 'warning', label: 'Máš zadanou blokaci' }
    if ((currentDriver.preferred_shift_types ?? []).includes(shift.shift_type)) return { tone: 'success', label: 'Sedí na tvoji preferenci' }
    return { tone: 'info', label: 'Bez kolize' }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>Volné směny</h3>
          <p className="muted">Na tyto směny se můžeš přihlásit. Dispečer potom vybere řidiče a směna ti přijde k potvrzení.</p>
        </div>
      </div>
      <div className="open-shift-grid">
        {openShifts.length === 0 ? <EmptyState text="Momentálně nejsou vypsané žádné volné směny. Jakmile dispečer uvolní směnu, objeví se tady a půjde se na ni přihlásit." /> : openShifts.map((shift) => {
          const application = applicationsByShiftId[shift.id]
          const suitability = getSuitability(shift)
          return (
            <div className="open-shift-card" key={shift.id}>
              <div>
                <span className="eyebrow">{formatDate(shift.start_at, { weekday: 'long' })}</span>
                <strong>{formatTime(shift.start_at)}–{formatTime(shift.end_at)}</strong>
                <p>{SHIFT_TYPE_LABEL[shift.shift_type]} · {shift.vehicle?.plate ?? 'Bez auta'}</p>
                <div className="button-row wrap">
                  <StatusPill tone={suitability.tone}>{suitability.label}</StatusPill>
                </div>
                {shift.note ? <details className="driver-inline-details compact"><summary>Poznámka</summary><div className="driver-details-body">{shift.note}</div></details> : null}
              </div>
              <div className="button-row wrap">
                {application ? <StatusPill tone={application.status === 'approved' ? 'success' : 'warning'}>{application.status === 'approved' ? 'Schváleno' : 'Přihlášeno'}</StatusPill> : null}
                <button className="primary-button" disabled={busy || Boolean(application)} onClick={() => onApplyOpenShift(shift)}>
                  {application ? 'Čeká na dispečera' : 'Chci směnu'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
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
  const selectableDrivers = drivers.filter((item) => item.active || item.id === shiftForm.driver_id)
  const selectableVehicles = vehicles.filter((item) => item.status === 'active' || item.id === shiftForm.vehicle_id)
  const hasDrivers = selectableDrivers.length > 0
  const hasVehicles = selectableVehicles.length > 0

  return (
    <section className="panel sticky-panel">
      <div className="panel-header">
        <div>
          <h3>{shiftForm.id ? 'Upravit směnu' : 'Nová směna'}</h3>
        </div>
      </div>
      <form className="form-grid" onSubmit={onSaveShift}>
        <label>
          Řidič / volná směna
          <select value={shiftForm.driver_id} onChange={(event) => setShiftForm((current) => ({ ...current, driver_id: event.target.value }))}>
            <option value="">Volná směna bez řidiče</option>
            {selectableDrivers.map((item) => <option key={item.id} value={item.id}>{item.display_name}{item.active ? '' : ' (neaktivní)'}</option>)}
          </select>
          {!hasDrivers ? <p className="muted">{dataLoading ? 'Načítám seznam řidičů…' : 'Zatím nemáš žádného aktivního řidiče.'}</p> : null}
        </label>
        <label>
          Vozidlo
          <select value={shiftForm.vehicle_id} onChange={(event) => setShiftForm((current) => ({ ...current, vehicle_id: event.target.value }))}>
            <option value="">Vyber auto</option>
            {selectableVehicles.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.plate}{item.status === 'active' ? '' : ' (neaktivní)'}</option>)}
          </select>
          {!hasVehicles ? <p className="muted">{dataLoading ? 'Načítám seznam vozidel…' : 'Zatím nemáš žádné aktivní vozidlo.'}</p> : null}
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
          <button className="primary-button" disabled={busy || !hasVehicles}>{shiftForm.id ? 'Uložit změny' : 'Vytvořit směnu'}</button>
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
  visibleInboxNotifications,
  notifications,
  notificationHistoryFilter,
  notificationPreferences,
  onEnablePush,
  onNotificationAction,
  onNotificationHistoryFilterChange,
  onNotificationPreferenceSave,
  onNotificationRead,
  onTestPush,
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
            <button className="ghost-button" type="button" onClick={onTestPush}>Odeslat test push</button>
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
            <p className="muted">{inboxNotifications.length} uložených událostí</p>
          </div>
          <div className="button-row wrap">
            {[
              ['recent', 'Poslední týden'],
              ['unread', 'Nepřečtené'],
              ['all', 'Vše'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={cx('ghost-button', notificationHistoryFilter === value && 'active-pill')}
                onClick={() => onNotificationHistoryFilterChange(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="stack-md">
          {visibleInboxNotifications.length === 0 ? <EmptyState text="Pro vybraný filtr tu nejsou žádné doručené události." /> : visibleInboxNotifications.map((item) => (
            <div className="list-card" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <p className="muted">{formatDateTime(item.created_at)}</p>
              </div>
              <div className="button-row wrap">
                <StatusPill tone={item.priority === 'critical' ? 'danger' : 'info'}>{item.priority === 'critical' ? 'Kritické' : 'Běžné'}</StatusPill>
                {item.shift_id ? <button className="ghost-button" onClick={() => onNotificationAction(item)}>Otevřít</button> : null}
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

function EmptyState({ actionLabel, onAction, text }) {
  return (
    <div className="empty-state">
      <p>{text}</p>
      {actionLabel && onAction ? (
        <button className="ghost-button" type="button" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  )
}
