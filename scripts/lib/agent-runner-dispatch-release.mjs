export function planDispatchIntentRelease({
  activeResult,
  force = false,
  now = new Date(),
  reason,
}) {
  const intent = activeResult?.intent
  if (!intent) {
    return {
      release: false,
      reason: "missing_intent",
    }
  }

  if (intent.status !== "leased") {
    return {
      intent,
      release: false,
      reason: "intent_not_leased",
    }
  }

  const expiresAt = Date.parse(intent.lease.expiresAt)
  const expired = Number.isFinite(expiresAt) && expiresAt <= now.getTime()
  if (activeResult.active && !force) {
    return {
      expired,
      intent,
      release: false,
      reason: "intent_still_active",
    }
  }

  return {
    expired,
    id: intent.id,
    intent,
    release: true,
    request: {
      holder: intent.lease.holder,
      reason:
        reason?.trim() ||
        (expired ? "released expired dispatch intent" : "released dispatch intent by operator"),
      status: "released",
    },
  }
}
