import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET() {
  const timestamp = new Date().toISOString()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return Response.json(
      { status: 'degraded', db: 'error', detail: 'Missing Supabase env vars', timestamp },
      { status: 503 }
    )
  }

  try {
    const supabase = createClient(url, key)
    const { error } = await supabase.from('profiles').select('id').limit(1)
    if (error) throw new Error(error.message)
    return Response.json(
      { status: 'ok', db: 'ok', env: process.env.NODE_ENV, timestamp },
      { status: 200 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json(
      { status: 'degraded', db: 'error', detail: msg, timestamp },
      { status: 503 }
    )
  }
}
