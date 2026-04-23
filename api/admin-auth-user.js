import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

async function getRequester(request) {
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return { error: json(500, { error: 'Na serveru chybí Supabase konfigurace.' }) }
  }

  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) {
    return { error: json(401, { error: 'Chybí přihlašovací token.' }) }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !userData.user) {
    return { error: json(401, { error: 'Nepodařilo se ověřit uživatele.' }) }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile || !['admin', 'dispatcher'].includes(profile.role)) {
    return { error: json(403, { error: 'Na tuto akci nemáš oprávnění.' }) }
  }

  return { adminClient, requester: profile }
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json(405, { error: 'Metoda není povolená.' })
  }

  const auth = await getRequester(request)
  if (auth.error) return auth.error

  const { adminClient } = auth
  const body = await request.json().catch(() => null)
  const action = body?.action

  if (action === 'create') {
    const email = body?.email?.trim()?.toLowerCase()
    const password = body?.password?.trim()
    if (!email || !password || password.length < 6) {
      return json(400, { error: 'Vyplň platný e-mail a heslo aspoň o 6 znacích.' })
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error || !data.user) {
      return json(400, { error: error?.message ?? 'Nepodařilo se vytvořit auth účet.' })
    }

    return json(200, {
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  }

  if (action === 'delete') {
    const userId = body?.userId?.trim()
    if (!userId) {
      return json(400, { error: 'Chybí ID uživatele.' })
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId)
    if (error) {
      return json(400, { error: error.message })
    }

    return json(200, { ok: true })
  }

  return json(400, { error: 'Neznámá akce.' })
}
