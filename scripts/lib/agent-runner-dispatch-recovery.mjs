export function expiredActiveDispatchIntent(error, { now = new Date() } = {}) {
  const intent = error?.body?.intent
  const expiresAt = intent?.lease?.expiresAt
  if (!intent || typeof expiresAt !== "string") return null

  const expiresTime = Date.parse(expiresAt)
  if (Number.isNaN(expiresTime) || expiresTime > now.getTime()) return null

  return intent
}

export async function releaseExpiredActiveDispatchIntent({
  config,
  error,
  finishDispatchIntent,
  log = console.log,
  now = new Date(),
}) {
  const intent = expiredActiveDispatchIntent(error, { now })
  if (!intent) {
    return {
      intent: null,
      released: false,
      reason: "no_expired_active_intent",
    }
  }

  const holder = intent.lease?.holder
  if (typeof holder !== "string" || holder.trim().length === 0) {
    return {
      intent,
      released: false,
      reason: "expired_intent_holder_missing",
    }
  }

  const finish = await finishDispatchIntent({
    id: intent.id,
    request: {
      holder,
      reason: "released expired dispatch intent before executor retry",
      status: "released",
    },
    token: config.token,
    url: config.url,
  })
  log(`released expired dispatch intent ${intent.id}`)

  return {
    finish,
    intent,
    released: true,
    reason: "expired_intent_released",
  }
}
