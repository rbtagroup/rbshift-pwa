import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function sendJson(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8').send(JSON.stringify(body))
}

export function parseBody(req, res) {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
  } catch {
    sendJson(res, 400, { error: 'Požadavek má neplatný JSON.' })
    return null
  }
}

export function extractBearerToken(req) {
  const authorization = req.headers?.authorization ?? ''
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
}

export function createAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function getRequester(req, res, allowedRoles = ['admin', 'dispatcher', 'driver']) {
  const adminClient = createAdminClient()
  if (!adminClient) {
    sendJson(res, 500, { error: 'Na serveru chybí Supabase konfigurace.' })
    return null
  }

  const token = extractBearerToken(req)
  if (!token) {
    sendJson(res, 401, { error: 'Chybí přihlašovací token.' })
    return null
  }

  const { data: userData, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !userData?.user) {
    sendJson(res, 401, { error: 'Nepodařilo se ověřit uživatele.' })
    return null
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile || !profile.active || !allowedRoles.includes(profile.role)) {
    sendJson(res, 403, { error: 'Na tuto akci nemáš oprávnění.' })
    return null
  }

  return {
    adminClient,
    requester: profile,
  }
}

export function normalizeProfilePayload(input) {
  const id = input?.id?.trim()
  const fullName = input?.full_name?.trim()
  const email = input?.email?.trim()?.toLowerCase()
  const role = input?.role?.trim()
  const phone = input?.phone?.trim() || null
  const active = input?.active !== false

  if (!id || !fullName || !email || !['admin', 'dispatcher', 'driver'].includes(role)) {
    return null
  }

  return {
    id,
    full_name: fullName,
    email,
    role,
    phone,
    active,
  }
}
