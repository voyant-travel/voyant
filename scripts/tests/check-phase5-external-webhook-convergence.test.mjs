import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { inspectExternalWebhookDeliveryConvergence } from "../lib/phase5-external-webhook-convergence.mjs"

const valid = {
  distribution: `
    import { createSelectedExternalWebhookDeliveryEngine } from "@voyant-travel/webhook-delivery"
    import { createPostgresWebhookDeliveryStore } from "@voyant-travel/webhook-delivery/postgres"
    const engine = createSelectedExternalWebhookDeliveryEngine({
      store: createPostgresWebhookDeliveryStore(db),
    })
  `,
  selectedEngine: `
    const visibilityPolicy = { authorize: ({ event }) => prepareExternalWebhookEvent(event, contract) }
    return createWebhookDeliveryEngine({ ...options, visibilityPolicy })
  `,
  engine: "signWebhookPayload retryDelay( dead_lettered onAudit",
  queueAdapterExists: false,
}

describe("external webhook delivery convergence authority", () => {
  it("accepts one package-owned execution engine with a thin Distribution adapter", () => {
    assert.deepEqual(inspectExternalWebhookDeliveryConvergence(valid), [])
  })

  it("rejects duplicate execution semantics in Distribution", () => {
    const failures = inspectExternalWebhookDeliveryConvergence({
      ...valid,
      distribution: `${valid.distribution}\nfetch(target)\nretryDelay(2)\ndead_lettered`,
    })
    assert.ok(failures.some((failure) => failure.includes("HTTP execution")))
    assert.ok(failures.some((failure) => failure.includes("retry/backoff")))
    assert.ok(failures.some((failure) => failure.includes("dead-letter")))
  })

  it("rejects a second pending-only queue adapter", () => {
    const failures = inspectExternalWebhookDeliveryConvergence({
      ...valid,
      queueAdapterExists: true,
    })
    assert.ok(failures.some((failure) => failure.includes("must stay deleted")))
  })

  it("rejects a selected engine that bypasses canonical execution", () => {
    const failures = inspectExternalWebhookDeliveryConvergence({
      ...valid,
      selectedEngine: "prepareExternalWebhookEvent(event, contract)",
    })
    assert.ok(failures.some((failure) => failure.includes("canonical engine")))
  })
})
