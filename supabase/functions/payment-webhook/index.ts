// ============================================================================
// DebitManager — Edge Function : webhook de paiement agrégateurs
// Endpoint : /functions/v1/payment-webhook?aggregator=kkiapay|moneroo|cinetpay
// Vérifie la signature (secret partagé WEBHOOK_SECRET), puis confirme le
// paiement via la RPC confirm_payment (idempotente, transactionnelle).
//
// ⚠️ À adapter à la signature exacte de chaque agrégateur (headers dédiés).
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const aggregator = (url.searchParams.get('aggregator') || 'generic').toLowerCase()

  // Vérification de signature (secret partagé)
  const secret = Deno.env.get('WEBHOOK_SECRET')
  const sig = req.headers.get('x-webhook-signature') ?? req.headers.get('x-signature')
  if (secret && (!sig || sig !== secret)) {
    return new Response(JSON.stringify({ error: 'signature invalide' }), { status: 401 })
  }

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'corps invalide' }), { status: 400 })
  }

  // Normalisation du payload selon l'agrégateur (à ajuster aux schémas réels)
  const paymentId = body.payment_id ?? body.paymentId ?? body.data?.payment_id ?? body.data?.id
  const reference = body.reference ?? body.transaction_id ?? body.data?.reference
  const statusRaw = String(body.status ?? body.state ?? 'success').toLowerCase()
  const ok = ['success', 'completed', 'confirmed', 'approved', 'paid'].includes(statusRaw)

  if (!paymentId) {
    return new Response(JSON.stringify({ error: 'payment_id manquant' }), { status: 400 })
  }

  if (!ok) {
    // Échec : on trace sans lever d'erreur (l'agrégateur retentera)
    await supabase.from('audit_logs').insert({
      action: 'PAYMENT_WEBHOOK_FAILED',
      entity_type: 'Payment',
      entity_id: paymentId,
      metadata: { aggregator, status: statusRaw },
    })
    return new Response(JSON.stringify({ ok: true, status: statusRaw }))
  }

  const { error } = await supabase.rpc('confirm_payment', {
    p_payment_id: paymentId,
    p_aggregator_reference: reference ?? null,
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 422 })
  }

  await supabase.from('audit_logs').insert({
    action: 'PAYMENT_WEBHOOK_RECEIVED',
    entity_type: 'Payment',
    entity_id: paymentId,
    metadata: { aggregator, reference },
  })

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})
