const ENQUEUE_EXECUTION_TOKENS = [
  ["fetch(", "HTTP execution"],
  ["fetchImpl", "HTTP execution"],
  ["globalThis.fetch", "HTTP execution"],
  ["signWebhookPayload", "signing"],
  ["retryDelay(", "retry/backoff"],
  ["dead_lettered", "dead-letter outcomes"],
  ["createWebhookDeliveryWorker", "worker execution"],
]

export function inspectExternalWebhookDeliveryConvergence(input) {
  const failures = []
  const bindsSelectedQueueDirectly = /createSelectedExternalWebhookQueue/.test(
    input.distributionQueue,
  )
  const delegatesCanonicalPostgresQueue =
    /enqueuePostgresWebhookEvent/.test(input.distributionQueue) &&
    /enqueuePostgresWebhookEvent[\s\S]*createSelectedExternalWebhookQueue/.test(input.store)
  if (!bindsSelectedQueueDirectly && !delegatesCanonicalPostgresQueue) {
    failures.push("Distribution enqueue must bind the selected durable webhook queue")
  }
  for (const [token, capability] of ENQUEUE_EXECUTION_TOKENS) {
    if (input.distributionQueue.includes(token) || input.selectedQueue.includes(token)) {
      failures.push(`webhook enqueue paths must not perform ${capability}`)
    }
  }
  if (!/createWebhookDeliveryWorker/.test(input.distributionWorker)) {
    failures.push("Distribution worker binding must delegate to the package-owned worker")
  }
  if (!/createPostgresWebhookDeliveryStore/.test(input.distributionWorker)) {
    failures.push("Distribution worker binding must use the canonical Postgres store")
  }
  for (const token of ["requestPayload:", "deliveryContract:", "enqueueAttempt("]) {
    if (!input.selectedQueue.includes(token)) failures.push(`durable enqueue must persist ${token}`)
  }
  for (const token of [
    "requestPayload: input.requestPayload",
    "deliveryContract: input.deliveryContract",
  ]) {
    if (!input.store.includes(token)) failures.push(`Postgres pending rows must persist ${token}`)
  }
  for (const token of [
    "listReadyAttemptIds",
    "claimAttempt(",
    "hydrateAttempt(",
    "signWebhookPayload",
    "retryDelay(",
    "completeAndEnqueueRetry",
    "dead_lettered",
    "onAudit",
  ]) {
    if (!input.worker.includes(token)) failures.push(`the canonical worker must retain ${token}`)
  }
  if (!/requestPayload:[\s\S]*deliveryContract:/.test(input.schema)) {
    failures.push("delivery schema must retain complete payload and contract columns")
  }
  if (
    !/ADD COLUMN IF NOT EXISTS "request_payload"[\s\S]*ADD COLUMN IF NOT EXISTS "delivery_contract"/.test(
      input.migration,
    )
  ) {
    failures.push("delivery migration must add nullable payload and contract columns")
  }
  return failures
}
