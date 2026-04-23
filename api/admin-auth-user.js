import { getRequester, normalizeProfilePayload, parseBody, sendJson } from './_lib/supabaseAdmin.js'

async function ensureDriverRecord(adminClient, profilePayload) {
  if (profilePayload.role !== 'driver') return

  const { data: existingDriver, error: selectError } = await adminClient
    .from('drivers')
    .select('id')
    .eq('profile_id', profilePayload.id)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message)
  }

  if (existingDriver?.id) {
    const { error: updateError } = await adminClient
      .from('drivers')
      .update({
        display_name: profilePayload.full_name,
        active: profilePayload.active,
      })
      .eq('id', existingDriver.id)

    if (updateError) {
      throw new Error(updateError.message)
    }
    return
  }

  const { error: insertError } = await adminClient.from('drivers').insert([{
    profile_id: profilePayload.id,
    display_name: profilePayload.full_name,
    active: profilePayload.active,
    note: null,
    preferred_shift_types: [],
  }])

  if (insertError) {
    throw new Error(insertError.message)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Metoda není povolená.' })
    return
  }

  const auth = await getRequester(req, res, ['admin', 'dispatcher'])
  if (!auth) return

  const { adminClient } = auth
  const body = parseBody(req, res)
  if (!body) return
  const action = body?.action

  if (action === 'create') {
    const email = body?.email?.trim()?.toLowerCase()
    const password = body?.password?.trim()

    if (!email || !password || password.length < 6) {
      sendJson(res, 400, { error: 'Vyplň platný e-mail a heslo aspoň o 6 znacích.' })
      return
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error || !data?.user) {
      sendJson(res, 400, { error: error?.message ?? 'Nepodařilo se vytvořit auth účet.' })
      return
    }

    sendJson(res, 200, {
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
    return
  }

  if (action === 'upsert-profile') {
    const profilePayload = normalizeProfilePayload(body?.profile)
    if (!profilePayload) {
      sendJson(res, 400, { error: 'Profil nemá platné ID, jméno, e-mail nebo roli.' })
      return
    }

    const { error } = await adminClient
      .from('profiles')
      .upsert([profilePayload], { onConflict: 'id' })

    if (error) {
      sendJson(res, 400, { error: error.message })
      return
    }

    try {
      await ensureDriverRecord(adminClient, profilePayload)
    } catch (driverError) {
      sendJson(res, 400, { error: driverError.message ?? 'Nepodařilo se navázat řidičský profil.' })
      return
    }

    sendJson(res, 200, { profile: profilePayload })
    return
  }

  if (action === 'set-profile-active') {
    const userId = body?.userId?.trim()
    const active = body?.active === true

    if (!userId) {
      sendJson(res, 400, { error: 'Chybí ID uživatele.' })
      return
    }

    const { data: updatedProfile, error } = await adminClient
      .from('profiles')
      .update({ active })
      .eq('id', userId)
      .select('id, full_name, role, active')
      .single()

    if (error || !updatedProfile) {
      sendJson(res, 400, { error: error?.message ?? 'Nepodařilo se změnit aktivitu uživatele.' })
      return
    }

    if (updatedProfile.role === 'driver') {
      const { error: driverError } = await adminClient
        .from('drivers')
        .update({ active })
        .eq('profile_id', userId)

      if (driverError) {
        sendJson(res, 400, { error: driverError.message })
        return
      }
    }

    sendJson(res, 200, { profile: updatedProfile })
    return
  }

  if (action === 'delete') {
    const userId = body?.userId?.trim()
    if (!userId) {
      sendJson(res, 400, { error: 'Chybí ID uživatele.' })
      return
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) {
      sendJson(res, 400, { error: error.message })
      return
    }

    sendJson(res, 200, { ok: true })
    return
  }

  sendJson(res, 400, { error: 'Neznámá akce.' })
}
