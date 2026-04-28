import { useState } from 'react'
import {
  AVAILABILITY_LABEL,
  RESPONSE_LABEL,
  SHIFT_TYPE_LABEL,
  STATUS_LABEL,
  cx,
  formatDate,
  formatDateTime,
  formatTime,
  overlaps,
  toInputValue,
} from '../utils'
import { StatusPill } from './StatusPill'

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
  onAvailabilityEdit,
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

  const createDriverAvailabilityForm = () => {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from)
    to.setHours(23, 59, 0, 0)

    return {
      id: null,
      driver_id: currentDriver.id,
      availability_type: 'unavailable',
      from_date: toInputValue(from),
      to_date: toInputValue(to),
      note: '',
    }
  }

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
      const isWeekend = day === 0 || day === 6
      const daysUntilSaturday = isWeekend ? (day === 6 ? 7 : 6) : (6 - day + 7) % 7
      start.setDate(start.getDate() + daysUntilSaturday)
      start.setHours(0, 0, 0, 0)
      end.setTime(start.getTime())
      end.setDate(end.getDate() + 1)
      end.setHours(23, 59, 0, 0)
    }

    setAvailabilityForm((current) => ({
      ...current,
      id: null,
      driver_id: currentDriver.id,
      availability_type: 'unavailable',
      from_date: toInputValue(start),
      to_date: toInputValue(end),
      note: '',
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
        onShowAvailability={() => onNotificationAction({ targetTab: 'availability' })}
        openShifts={openShifts}
        visibleShifts={visibleShifts}
      />
    )
  }

  if (activeTab === 'availability') {
    return (
      <div className="grid-2">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>{availabilityForm.id ? 'Upravit dostupnost' : 'Moje dostupnost'}</h3>
            </div>
            {availabilityForm.id ? (
              <button type="button" className="ghost-button" onClick={() => setAvailabilityForm(createDriverAvailabilityForm())}>
                Nová blokace
              </button>
            ) : null}
          </div>
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
            <button className="primary-button" disabled={busy}>{availabilityForm.id ? 'Uložit změnu' : 'Uložit dostupnost'}</button>
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
                <button type="button" className="ghost-button" onClick={() => onAvailabilityEdit(item)}>
                  Upravit
                </button>
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

function OpenShiftsSection({ applications, availability, busy, currentDriver, onApplyOpenShift, onShowAvailability, openShifts, visibleShifts }) {
  const activeApplicationStatuses = new Set(['pending', 'approved'])
  const applicationsByShiftId = applications.reduce((acc, item) => {
    if (activeApplicationStatuses.has(item.status)) {
      acc[item.shift_id] = item
    }
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
        {openShifts.length === 0 ? (
          <EmptyState
            actionLabel="Zadat dostupnost"
            onAction={onShowAvailability}
            text="Momentálně nejsou vypsané žádné volné směny. Jakmile dispečer uvolní směnu, objeví se tady a půjde se na ni přihlásit."
          />
        ) : openShifts.map((shift) => {
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
