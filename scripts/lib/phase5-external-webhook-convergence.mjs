const DISTRIBUTION_EXECUTION_TOKENS = [
  ["fetch(", "HTTP execution"],
  ["signWebhookPayload", "signing"],
  ["retryDelay(", "retry/backoff"],
  ["dead_lettered", "dead-letter outcomes"],
  ["queueExternalWebhookEvent", "the pending-only queue adapter"],
  ["enqueueOutboundEnvelope", "the Distribution envelope queue"],
]

export function inspectExternalWebhookDeliveryConvergence(input) {
  const failures = []
  if (!/createSelectedExternalWebhookDeliveryEngine/.test(input.distribution)) {
    failures.push("Distribution must construct the selected external webhook delivery engine")
  }
  if (!/createPostgresWebhookDeliveryStore/.test(input.distribution)) {
    failures.push("Distribution must bind the canonical Postgres delivery store")
  }
  for (const [token, capability] of DISTRIBUTION_EXECUTION_TOKENS) {
    if (input.distribution.includes(token)) {
      failures.push(`Distribution must not own external webhook ${capability}`)
    }
  }
  if (!/createWebhookDeliveryEngine\(\{/.test(input.selectedEngine)) {
    failures.push("the selected external engine must delegate execution to the canonical engine")
  }
  if (!/prepareExternalWebhookEvent/.test(input.selectedEngine)) {
    failures.push("the selected external engine must project the selected contract before delivery")
  }
  for (const token of ["signWebhookPayload", "retryDelay(", "dead_lettered", "onAudit"]) {
    if (!input.engine.includes(token)) {
      failures.push(`the canonical engine must retain ${token}`)
    }
  }
  if (input.queueAdapterExists) {
    failures.push("the superseded pending-only external webhook queue adapter must stay deleted")
  }
  return failures
}
