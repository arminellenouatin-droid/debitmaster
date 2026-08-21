// ============================================================================
// DebitManager — Edge Function : cycle de vie des abonnements
// Appelle run_subscription_lifecycle() : essais expirés → grâce 3 j →
// suspension, rappels J-7/J-3/J-1.
// À déclencher quotidiennement (cron externe : Vercel Cron, GitHub Actions…)
// avec le header x-cron-secret = CRON_SECRET.
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'non autorisé' }), { status: 401 })
  }
  const { error } = await supabase.rpc('run_subscription_lifecycle')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})
