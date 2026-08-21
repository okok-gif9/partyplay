import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type ActivityRecord = {
  id: string
  recipient_id: string
  kind: 'friend_request' | 'friend_accepted' | 'group_added' | 'room_invite' | 'game_started' | 'your_turn' | 'game_finished' | 'achievement' | 'report_update' | 'security'
  title: string
  body: string
  payload: Record<string, unknown>
}

type WebhookPayload = { type?: string; record?: ActivityRecord }

const categoryByKind: Partial<Record<ActivityRecord['kind'], string>> = {
  friend_request: 'friend_request',
  room_invite: 'room_invite',
  game_started: 'game_started',
  your_turn: 'your_turn',
  achievement: 'achievement',
  security: 'security',
}

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get('PARTYPLAY_WEBHOOK_SECRET')
  if (!expectedSecret || request.headers.get('x-partyplay-webhook-secret') !== expectedSecret) return json(401, { error: 'UNAUTHORIZED' })

  let incoming: WebhookPayload
  try { incoming = await request.json() } catch { return json(400, { error: 'INVALID_JSON' }) }
  const record = incoming.record
  if (!record || incoming.type !== 'INSERT') return json(202, { skipped: 'NOT_AN_ACTIVITY_INSERT' })

  const category = categoryByKind[record.kind]
  if (!category) return json(202, { skipped: 'IN_APP_ONLY_CATEGORY' })

  const projectUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = Deno.env.get('PARTYPLAY_WEB_PUSH_PUBLIC_KEY')
  const privateKey = Deno.env.get('PARTYPLAY_WEB_PUSH_PRIVATE_KEY')
  if (!projectUrl || !serviceRoleKey || !publicKey || !privateKey) return json(503, { error: 'PUSH_NOT_CONFIGURED' })

  const admin = createClient(projectUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data: preference, error: preferenceError } = await admin
    .from('pp_notification_preferences')
    .select('browser_enabled, categories')
    .eq('user_id', record.recipient_id)
    .maybeSingle()
  if (preferenceError) return json(500, { error: 'PREFERENCE_LOAD_FAILED' })
  if (!preference?.browser_enabled || preference.categories?.[category] !== true) return json(202, { skipped: 'RECIPIENT_PREFERENCE' })

  const { data: subscriptions, error: subscriptionError } = await admin
    .from('pp_web_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', record.recipient_id)
  if (subscriptionError) return json(500, { error: 'SUBSCRIPTION_LOAD_FAILED' })
  if (!subscriptions?.length) return json(202, { skipped: 'NO_SUBSCRIPTIONS' })

  webpush.setVapidDetails('mailto:partyplay@okok-gif9.github.io', publicKey, privateKey)
  const destination = typeof record.payload?.destination === 'string' ? record.payload.destination : '?view=activity'
  const message = JSON.stringify({
    title: record.title,
    body: record.body,
    tag: `partyplay-${record.kind}-${record.id}`,
    url: `${projectUrl.replace('.supabase.co', '.supabase.co') ? 'https://okok-gif9.github.io/partyplay/' : '/'}${destination.replace(/^\/?/, '')}`,
  })

  const failedEndpoints: string[] = []
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, message, { TTL: 180 })
    } catch (cause) {
      const statusCode = typeof cause === 'object' && cause && 'statusCode' in cause ? Number((cause as { statusCode?: number }).statusCode) : 0
      if (statusCode === 404 || statusCode === 410) failedEndpoints.push(subscription.endpoint)
      else console.error('push delivery failed', { statusCode })
    }
  }))

  if (failedEndpoints.length) await admin.from('pp_web_push_subscriptions').delete().in('endpoint', failedEndpoints)
  return json(200, { delivered_to: subscriptions.length - failedEndpoints.length, removed: failedEndpoints.length })
})
