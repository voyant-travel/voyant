import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { inspectExternalWebhookDeliveryConvergence } from "../lib/phase5-external-webhook-convergence.mjs"

const valid = {
  distributionQueue: "createSelectedExternalWebhookQueue({ store })",
  distributionWorker:
    "createWebhookDeliveryWorker({ store: createPostgresWebhookDeliveryStore(db) })",
  selectedQueue: "store.enqueueAttempt({ requestPayload: event, deliveryContract: contract })",
  store: "requestPayload: input.requestPayload deliveryContract: input.deliveryContract",
  worker:
    "listReadyAttemptIds claimAttempt( hydrateAttempt( signWebhookPayload retryDelay( completeAndEnqueueRetry dead_lettered onAudit",
  schema: "requestPayload: jsonb requestBodyHash deliveryContract: jsonb",
  migration:
    'ADD COLUMN IF NOT EXISTS "request_payload" jsonb ADD COLUMN IF NOT EXISTS "delivery_contract" jsonb',
}

describe("external webhook delivery convergence authority", () => {
  it("accepts durable enqueue plus one package-owned execution worker", () => {
    assert.deepEqual(inspectExternalWebhookDeliveryConvergence(valid), [])
  })

  it("rejects inline HTTP and retry behavior from enqueue paths", () => {
    const failures = inspectExternalWebhookDeliveryConvergence({
      ...valid,
      distributionQueue: `${valid.distributionQueue}\nfetch(target)\nretryDelay(2)`,
    })
    assert.ok(failures.some((failure) => failure.includes("HTTP execution")))
    assert.ok(failures.some((failure) => failure.includes("retry/backoff")))
  })

  it("rejects payload-less pending attempts", () => {
    const failures = inspectExternalWebhookDeliveryConvergence({
      ...valid,
      selectedQueue: "store.enqueueAttempt({ requestBodyHash: hash })",
    })
    assert.ok(failures.some((failure) => failure.includes("requestPayload")))
    assert.ok(failures.some((failure) => failure.includes("deliveryContract")))

    const droppedByStore = inspectExternalWebhookDeliveryConvergence({
      ...valid,
      store: "requestBodyHash: input.requestBodyHash",
    })
    assert.ok(droppedByStore.some((failure) => failure.includes("Postgres pending rows")))
  })

  it("rejects a worker without restart-safe claim and hydration", () => {
    const failures = inspectExternalWebhookDeliveryConvergence({
      ...valid,
      worker: "signWebhookPayload retryDelay( completeAndEnqueueRetry dead_lettered onAudit",
    })
    assert.ok(failures.some((failure) => failure.includes("listReadyAttemptIds")))
    assert.ok(failures.some((failure) => failure.includes("hydrateAttempt")))
  })

  it("rejects a schema or migration that drops durable payload state", () => {
    const failures = inspectExternalWebhookDeliveryConvergence({
      ...valid,
      schema: "requestBodyHash: text",
      migration: "ALTER TABLE webhook_deliveries",
    })
    assert.ok(failures.some((failure) => failure.includes("delivery schema")))
    assert.ok(failures.some((failure) => failure.includes("delivery migration")))
  })
})
