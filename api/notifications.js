import webpush from 'web-push'
import { getRequester, parseBody, sendJson } from './_lib/supabaseAdmin.js'

const pushPublicKey = process.env.WEB_PUSH_PUBLIC_KEY || process.env.VITE_WEB_PUSH_PUBLIC_KEY
const pushPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY
const pushSubject = process.env.WEB_PUSH_SUBJECT || 'mailto:notifikace@rbshift.local'

if (pushPublicKey && pushPrivateKey) {
  webpush.setVapidDetails(pushSubject, pushPublicKey, pushPrivateKey)
}

function generateId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`
}

function normalizePreferences(input, requester) {
  return {
    user_id: requester.id,
    push_enabled: input?.push_enabled === true,
    email_enabled: input?.email_enabled !== false,
    sms_enabled: input?.sms_enabled === true,
    critical_only: input?.critical_only === true,
    phone_override: input?.phone_override?.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

async function sendEmailIfConfigured(recipient, notification) {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.NOTIFY_FROM_EMAIL
  if (!apiKey || !fromEmail || !recipient.email) {
    return { skipped: true, reason: 'email_not_configured' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipient.email],
      subject: notification.title,
      text: notification.body,
    }),
  })

  if (!response.ok) {
    return { skipped: false, error: `email_${response.status}` }
  }

  return { ok: true }
}

async function sendSmsIfConfigured(recipient, notification) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  const to = recipient.phone_override || recipient.phone

  if (!sid || !token || !from || !to) {
    return { skipped: true, reason: 'sms_not_configured' }
  }

  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: `${notification.title}: ${notification.body}`,
  })

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    return { skipped: false, error: `sms_${response.status}` }
  }

  return { ok: true }
}

async function sendPushIfConfigured(subscriptions, notification) {
  if (!pushPublicKey || !pushPrivateKey || subscriptions.length === 0) {
    return { skipped: true, reason: 'push_not_configured_or_missing_subscription' }
  }

  const payload = JSON.stringify(notification)
  const results = await Promise.allSettled(
    subscriptions.map((subscription) => webpush.sendNotification({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }, payload))
  )

  const ok = results.some((result) => result.status === 'fulfilled')
  return ok ? { ok: true } : { skipped: false, error: 'push_failed' }
}

function createShiftBody(shift, vehicle) {
  const when = shift?.start_at ? new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(shift.start_at)) : 'čas směny'

  return `${when} · ${vehicle?.plate ?? 'bez auta'}`
}

function rangesOverlap(startA, endA, startB, endB) {
  return new Date(startA) < new Date(endB) && new Date(startB) < new Date(endA)
}

function appendShiftNote(note, line) {
  const trimmed = note?.trim()
  return trimmed ? `${trimmed}\n${line}` : line
}

async function loadShiftRelations(adminClient, previousShift, nextShift) {
  const driverIds = [previousShift?.driver_id, nextShift?.driver_id].filter(Boolean)
  const vehicleIds = [previousShift?.vehicle_id, nextShift?.vehicle_id].filter(Boolean)

  const [driversRes, vehiclesRes] = await Promise.all([
    driverIds.length > 0
      ? adminClient.from('drivers').select('id, profile_id, display_name').in('id', [...new Set(driverIds)])
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length > 0
      ? adminClient.from('vehicles').select('id, plate, name').in('id', [...new Set(vehicleIds)])
      : Promise.resolve({ data: [], error: null }),
  ])

  if (driversRes.error) throw new Error(driversRes.error.message)
  if (vehiclesRes.error) throw new Error(vehiclesRes.error.message)

  return {
    driversMap: Object.fromEntries((driversRes.data ?? []).map((item) => [item.id, item])),
    vehiclesMap: Object.fromEntries((vehiclesRes.data ?? []).map((item) => [item.id, item])),
  }
}

async function buildShiftNotifications(adminClient, eventType, requester, previousShift, nextShift) {
  const { driversMap, vehiclesMap } = await loadShiftRelations(adminClient, previousShift, nextShift)
  const previousDriverProfileId = previousShift?.driver_id ? driversMap[previousShift.driver_id]?.profile_id ?? null : null
  const nextDriverProfileId = nextShift?.driver_id ? driversMap[nextShift.driver_id]?.profile_id ?? null : null
  const vehicle = vehiclesMap[nextShift?.vehicle_id ?? previousShift?.vehicle_id] ?? null
  const baseShift = nextShift ?? previousShift
  const shiftId = nextShift?.id ?? previousShift?.id ?? null
  const notifications = []

  const addDriverNotification = (userId, title, body, priority = 'normal') => {
    if (!userId || userId === requester.id) return
    notifications.push({
      user_id: userId,
      shift_id: shiftId,
      kind: eventType,
      priority,
      title,
      body,
      metadata: { shift_id: shiftId, event_type: eventType },
    })
  }

  const addStaffNotifications = async (title, body, priority = 'normal') => {
    const { data: staffProfiles, error } = await adminClient
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'dispatcher'])
      .eq('active', true)

    if (error) throw new Error(error.message)

    ;(staffProfiles ?? [])
      .filter((item) => item.id !== requester.id)
      .forEach((item) => {
        notifications.push({
          user_id: item.id,
          shift_id: shiftId,
          kind: eventType,
          priority,
          title,
          body,
          metadata: { shift_id: shiftId, event_type: eventType },
        })
      })
  }

  const addReplacementOfferNotifications = async () => {
    const { data: activeDrivers, error } = await adminClient
      .from('drivers')
      .select('profile_id')
      .eq('active', true)
      .not('profile_id', 'is', null)

    if (error) throw new Error(error.message)

    ;(activeDrivers ?? [])
      .filter((item) => item.profile_id && item.profile_id !== requester.id && item.profile_id !== previousDriverProfileId)
      .forEach((item) => {
        notifications.push({
          user_id: item.profile_id,
          shift_id: shiftId,
          kind: eventType,
          priority: 'normal',
          title: 'Směna k převzetí',
          body: createShiftBody(baseShift, vehicle),
          metadata: { shift_id: shiftId, event_type: eventType },
        })
      })
  }

  if (eventType === 'shift_created') {
    addDriverNotification(nextDriverProfileId, 'Přišla ti nová směna', createShiftBody(baseShift, vehicle))
  }

  if (eventType === 'shift_updated') {
    if (previousDriverProfileId && previousDriverProfileId !== nextDriverProfileId) {
      addDriverNotification(previousDriverProfileId, 'Směna už ti není přiřazená', createShiftBody(previousShift, vehicle), 'critical')
    }

    if (nextShift?.status === 'cancelled') {
      addDriverNotification(nextDriverProfileId ?? previousDriverProfileId, 'Směna byla zrušena', createShiftBody(baseShift, vehicle), 'critical')
    } else if (nextDriverProfileId && nextDriverProfileId !== previousDriverProfileId) {
      addDriverNotification(nextDriverProfileId, 'Byla ti přiřazena směna', createShiftBody(baseShift, vehicle))
    } else if (nextDriverProfileId) {
      addDriverNotification(nextDriverProfileId, 'Směna byla upravena', createShiftBody(baseShift, vehicle))
    }
  }

  if (eventType === 'shift_deleted') {
    addDriverNotification(previousDriverProfileId, 'Směna byla zrušena', createShiftBody(previousShift, vehicle), 'critical')
  }

  if (eventType === 'shift_response') {
    await addStaffNotifications(
      nextShift?.driver_response === 'accepted' ? 'Řidič potvrdil směnu' : 'Řidič odmítl směnu',
      `${requester.full_name} · ${createShiftBody(baseShift, vehicle)}`,
      nextShift?.driver_response === 'accepted' ? 'normal' : 'critical'
    )
  }

  if (eventType === 'shift_release') {
    await addReplacementOfferNotifications()
    await addStaffNotifications(
      'Řidič zrušil účast na směně',
      `${requester.full_name} · ${createShiftBody(baseShift, vehicle)}`,
      'critical'
    )
  }

  if (eventType === 'shift_offer') {
    await addReplacementOfferNotifications()
    await addStaffNotifications(
      'Řidič nabízí směnu k přeobsazení',
      `${requester.full_name} · ${createShiftBody(baseShift, vehicle)}`,
      'critical'
    )
  }

  if (eventType === 'shift_takeover') {
    addDriverNotification(previousDriverProfileId, 'Kolega převzal nabídnutou směnu', `${requester.full_name} · ${createShiftBody(baseShift, vehicle)}`)
    await addStaffNotifications(
      'Směna byla převzata kolegou',
      `${requester.full_name} · ${createShiftBody(baseShift, vehicle)}`,
      'normal'
    )
  }

  return notifications
}

async function deliverNotifications(adminClient, notifications) {
  if (notifications.length === 0) {
    return []
  }

  const userIds = [...new Set(notifications.map((item) => item.user_id))]
  const [profilesRes, preferencesRes, subscriptionsRes] = await Promise.all([
    adminClient.from('profiles').select('id, email, phone, full_name').in('id', userIds),
    adminClient.from('notification_preferences').select('*').in('user_id', userIds),
    adminClient.from('push_subscriptions').select('*').in('user_id', userIds),
  ])

  if (profilesRes.error) throw new Error(profilesRes.error.message)
  if (preferencesRes.error) throw new Error(preferencesRes.error.message)
  if (subscriptionsRes.error) throw new Error(subscriptionsRes.error.message)

  const profilesMap = Object.fromEntries((profilesRes.data ?? []).map((item) => [item.id, item]))
  const preferencesMap = Object.fromEntries((preferencesRes.data ?? []).map((item) => [item.user_id, item]))
  const subscriptionsMap = (subscriptionsRes.data ?? []).reduce((acc, item) => {
    acc[item.user_id] = [...(acc[item.user_id] ?? []), item]
    return acc
  }, {})

  const rows = []

  for (const notification of notifications) {
    const recipient = {
      ...(profilesMap[notification.user_id] ?? {}),
      ...(preferencesMap[notification.user_id] ?? {}),
    }
    const onlyCritical = recipient.critical_only === true
    const allowExternal = !onlyCritical || notification.priority === 'critical'
    const deliveryChannels = ['in_app']
    const deliveryResults = { in_app: 'stored' }

    if (allowExternal && recipient.push_enabled) {
      const pushResult = await sendPushIfConfigured(subscriptionsMap[notification.user_id] ?? [], notification)
      deliveryChannels.push('push')
      deliveryResults.push = pushResult.ok ? 'sent' : pushResult.reason ?? pushResult.error ?? 'skipped'
    }

    if (allowExternal && recipient.email_enabled) {
      const emailResult = await sendEmailIfConfigured(recipient, notification)
      deliveryChannels.push('email')
      deliveryResults.email = emailResult.ok ? 'sent' : emailResult.reason ?? emailResult.error ?? 'skipped'
    }

    if (allowExternal && recipient.sms_enabled) {
      const smsResult = await sendSmsIfConfigured(recipient, notification)
      deliveryChannels.push('sms')
      deliveryResults.sms = smsResult.ok ? 'sent' : smsResult.reason ?? smsResult.error ?? 'skipped'
    }

    rows.push({
      id: generateId('notification'),
      user_id: notification.user_id,
      shift_id: notification.shift_id ?? null,
      kind: notification.kind,
      priority: notification.priority,
      title: notification.title,
      body: notification.body,
      delivery_channels: [...new Set(deliveryChannels)],
      delivery_results: deliveryResults,
      metadata: notification.metadata ?? null,
      created_at: new Date().toISOString(),
    })
  }

  const { error } = await adminClient.from('notification_events').insert(rows)
  if (error) throw new Error(error.message)

  return rows
}

async function takeoverShift(adminClient, requester, shiftId) {
  if (requester.role !== 'driver') {
    throw new Error('Směnu může převzít jen řidič.')
  }

  const { data: currentDriver, error: driverError } = await adminClient
    .from('drivers')
    .select('id, display_name, active')
    .eq('profile_id', requester.id)
    .eq('active', true)
    .single()

  if (driverError || !currentDriver) {
    throw new Error('K účtu není připojený aktivní řidičský profil.')
  }

  const { data: shift, error: shiftError } = await adminClient
    .from('shifts')
    .select('*')
    .eq('id', shiftId)
    .single()

  if (shiftError || !shift) {
    throw new Error('Směna nebyla nalezena.')
  }

  if (shift.status !== 'replacement_needed') {
    throw new Error('Tato směna už není dostupná k převzetí.')
  }

  if (shift.driver_id === currentDriver.id) {
    throw new Error('Tato směna už je přiřazená tobě.')
  }

  const [overlapRes, availabilityRes] = await Promise.all([
    adminClient
      .from('shifts')
      .select('id, start_at, end_at')
      .eq('driver_id', currentDriver.id)
      .neq('id', shift.id)
      .neq('status', 'cancelled'),
    adminClient
      .from('driver_availability')
      .select('id, availability_type, from_date, to_date')
      .eq('driver_id', currentDriver.id)
      .neq('availability_type', 'available'),
  ])

  if (overlapRes.error) throw new Error(overlapRes.error.message)
  if (availabilityRes.error) throw new Error(availabilityRes.error.message)

  const hasShiftOverlap = (overlapRes.data ?? []).some((item) => rangesOverlap(item.start_at, item.end_at, shift.start_at, shift.end_at))
  if (hasShiftOverlap) {
    throw new Error('V tomto čase už máš jinou směnu.')
  }

  const availabilityConflict = (availabilityRes.data ?? []).find((item) => rangesOverlap(item.from_date, item.to_date, shift.start_at, shift.end_at))
  if (availabilityConflict) {
    throw new Error('V tomto termínu máš zadanou nepřítomnost.')
  }

  const now = new Date().toISOString()
  const note = shift.note?.trim()
    ? `${shift.note.trim()}\n[${now}] Směnu převzal/a ${currentDriver.display_name}.`
    : `[${now}] Směnu převzal/a ${currentDriver.display_name}.`

  const patch = {
    driver_id: currentDriver.id,
    driver_response: 'accepted',
    status: 'confirmed',
    note,
    updated_by: requester.id,
    updated_at: now,
  }

  const { data: updatedShift, error: updateError } = await adminClient
    .from('shifts')
    .update(patch)
    .eq('id', shift.id)
    .eq('status', 'replacement_needed')
    .select('*')
    .single()

  if (updateError || !updatedShift) {
    throw new Error(updateError?.message ?? 'Směnu se nepodařilo převzít. Možná ji už převzal někdo jiný.')
  }

  const { error: logError } = await adminClient.from('change_log').insert([{
    id: generateId('log'),
    entity_type: 'shift',
    entity_id: shift.id,
    action: 'shift_takeover',
    old_data: shift,
    new_data: updatedShift,
    user_id: requester.id,
    created_at: now,
  }])

  if (logError) {
    throw new Error(logError.message)
  }

  const notifications = await buildShiftNotifications(adminClient, 'shift_takeover', requester, shift, updatedShift)
  await deliverNotifications(adminClient, notifications)

  return updatedShift
}

async function updateShiftResponse(adminClient, requester, shiftId, response) {
  if (requester.role !== 'driver') {
    throw new Error('Na směnu může odpovědět jen řidič.')
  }

  const { data: currentDriver, error: driverError } = await adminClient
    .from('drivers')
    .select('id, display_name, active')
    .eq('profile_id', requester.id)
    .eq('active', true)
    .single()

  if (driverError || !currentDriver) {
    throw new Error('K účtu není připojený aktivní řidičský profil.')
  }

  const { data: shift, error: shiftError } = await adminClient
    .from('shifts')
    .select('*')
    .eq('id', shiftId)
    .single()

  if (shiftError || !shift) {
    throw new Error('Směna nebyla nalezena.')
  }

  if (shift.driver_id !== currentDriver.id) {
    throw new Error('Tato směna není přiřazená tobě.')
  }

  if (['cancelled', 'completed'].includes(shift.status)) {
    throw new Error('U zrušené nebo dokončené směny už nejde měnit reakci.')
  }

  const now = new Date().toISOString()
  const noteTime = new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(now))

  const actionConfig = response === 'accepted'
    ? {
        patch: {
          driver_response: 'accepted',
          status: 'confirmed',
          updated_by: requester.id,
          updated_at: now,
        },
        logAction: 'response',
        eventType: 'shift_response',
      }
    : response === 'declined'
      ? {
          patch: {
            driver_response: 'declined',
            status: 'replacement_needed',
            updated_by: requester.id,
            updated_at: now,
          },
          logAction: 'response',
          eventType: 'shift_response',
        }
      : response === 'release'
        ? {
            patch: {
              driver_response: 'declined',
              status: 'replacement_needed',
              note: appendShiftNote(shift.note, `[${noteTime}] Řidič zrušil už potvrzenou směnu a požádal o přeobsazení.`),
              updated_by: requester.id,
              updated_at: now,
            },
            logAction: 'driver_release',
            eventType: 'shift_release',
          }
        : response === 'offer'
          ? {
              patch: {
                driver_response: 'declined',
                status: 'replacement_needed',
                note: appendShiftNote(shift.note, `[${noteTime}] Řidič nabídl směnu k přeobsazení.`),
                updated_by: requester.id,
                updated_at: now,
              },
              logAction: 'driver_offer',
              eventType: 'shift_offer',
            }
          : null

  if (!actionConfig) {
    throw new Error('Neznámá reakce na směnu.')
  }

  if (['accepted', 'declined'].includes(response) && (shift.driver_response !== 'pending' || shift.status !== 'planned')) {
    throw new Error('Na tuto směnu už bylo odpovězeno.')
  }

  if (['release', 'offer'].includes(response) && (shift.driver_response !== 'accepted' || shift.status !== 'confirmed')) {
    throw new Error('Přeobsazení lze řešit jen u potvrzené směny.')
  }

  const { data: updatedShift, error: updateError } = await adminClient
    .from('shifts')
    .update(actionConfig.patch)
    .eq('id', shift.id)
    .eq('driver_id', currentDriver.id)
    .eq('status', shift.status)
    .eq('driver_response', shift.driver_response)
    .select('*')
    .single()

  if (updateError || !updatedShift) {
    throw new Error(updateError?.message ?? 'Reakci na směnu se nepodařilo uložit.')
  }

  const { error: logError } = await adminClient.from('change_log').insert([{
    id: generateId('log'),
    entity_type: 'shift',
    entity_id: shift.id,
    action: actionConfig.logAction,
    old_data: shift,
    new_data: updatedShift,
    user_id: requester.id,
    created_at: now,
  }])

  if (logError) {
    throw new Error(logError.message)
  }

  const notifications = await buildShiftNotifications(adminClient, actionConfig.eventType, requester, shift, updatedShift)
  await deliverNotifications(adminClient, notifications)

  return updatedShift
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Metoda není povolená.' })
    return
  }

  const auth = await getRequester(req, res)
  if (!auth) return

  const { adminClient, requester } = auth
  const body = parseBody(req, res)
  if (!body) return

  if (body.action === 'config') {
    sendJson(res, 200, {
      pushSupported: Boolean(pushPublicKey && pushPrivateKey),
      publicKey: pushPublicKey || null,
    })
    return
  }

  if (body.action === 'save-preferences') {
    const payload = normalizePreferences(body.preferences, requester)
    const { data, error } = await adminClient
      .from('notification_preferences')
      .upsert([payload], { onConflict: 'user_id' })
      .select('*')
      .single()

    if (error || !data) {
      sendJson(res, 400, { error: error?.message ?? 'Nepodařilo se uložit preference notifikací.' })
      return
    }

    sendJson(res, 200, { preferences: data })
    return
  }

  if (body.action === 'save-push-subscription') {
    const subscription = body.subscription
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      sendJson(res, 400, { error: 'Push subscription nemá platná data.' })
      return
    }

    const { data, error } = await adminClient
      .from('push_subscriptions')
      .upsert([{
        user_id: requester.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: req.headers['user-agent'] ?? null,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }], { onConflict: 'endpoint' })
      .select('id, endpoint')

    if (error) {
      sendJson(res, 400, { error: error.message })
      return
    }

    sendJson(res, 200, { subscription: data?.[0] ?? null })
    return
  }

  if (body.action === 'mark-read') {
    const notificationId = body.notificationId?.trim()
    if (!notificationId) {
      sendJson(res, 400, { error: 'Chybí ID notifikace.' })
      return
    }

    const { error } = await adminClient
      .from('notification_events')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', requester.id)

    if (error) {
      sendJson(res, 400, { error: error.message })
      return
    }

    sendJson(res, 200, { ok: true })
    return
  }

  if (body.action === 'takeover-shift') {
    const shiftId = body.shiftId?.trim()
    if (!shiftId) {
      sendJson(res, 400, { error: 'Chybí ID směny.' })
      return
    }

    try {
      const shift = await takeoverShift(adminClient, requester, shiftId)
      sendJson(res, 200, { shift })
    } catch (takeoverError) {
      sendJson(res, 400, { error: takeoverError.message ?? 'Směnu se nepodařilo převzít.' })
    }
    return
  }

  if (body.action === 'update-shift-response') {
    const shiftId = body.shiftId?.trim()
    const response = body.response?.trim()
    if (!shiftId || !response) {
      sendJson(res, 400, { error: 'Chybí ID směny nebo reakce řidiče.' })
      return
    }

    try {
      const shift = await updateShiftResponse(adminClient, requester, shiftId, response)
      sendJson(res, 200, { shift })
    } catch (responseError) {
      sendJson(res, 400, { error: responseError.message ?? 'Reakci na směnu se nepodařilo uložit.' })
    }
    return
  }

  if (body.action === 'dispatch-shift-event') {
    const eventType = body.eventType?.trim()
    const allowedEvents = ['shift_created', 'shift_updated', 'shift_deleted', 'shift_response', 'shift_release', 'shift_offer', 'shift_takeover']
    if (!allowedEvents.includes(eventType)) {
      sendJson(res, 400, { error: 'Neznámý typ notifikační události.' })
      return
    }

    try {
      const notifications = await buildShiftNotifications(adminClient, eventType, requester, body.previousShift ?? null, body.nextShift ?? null)
      const rows = await deliverNotifications(adminClient, notifications)
      sendJson(res, 200, { count: rows.length })
    } catch (dispatchError) {
      sendJson(res, 400, { error: dispatchError.message ?? 'Nepodařilo se rozeslat notifikace.' })
    }
    return
  }

  sendJson(res, 400, { error: 'Neznámá akce.' })
}
