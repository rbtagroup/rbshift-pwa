import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function sendJson(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').send(JSON.stringify(body))
}

function extractBearerToken(req) {
  const authorization = req.headers?.authorization ?? ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
}

async function getRequester(req, res) {
  if (!supabaseUrl || !serviceRoleKey) {
    sendJson(res, 500, { error: 'Na serveru chybí Supabase konfigurace.' })
    return null
  }

  const token = extractBearerToken(req)
  if (!token) {
    sendJson(res, 401, { error: 'Chybí přihlašovací token.' })
    return null
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !userData?.user) {
    sendJson(res, 401, { error: 'Nepodařilo se ověřit uživatele.' })
    return null
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile || !['admin', 'dispatcher'].includes(profile.role)) {
    sendJson(res, 403, { error: 'Na tuto akci nemáš oprávnění.' })
    return null
  }

  return { adminClient, requester: profile }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Metoda není povolená.' })
    return
  }

  const auth = await getRequester(req, res)
  if (!auth) return

  const { adminClient } = auth
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
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
