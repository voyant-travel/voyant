import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { inspectWebhookSubscriptionMutationBoundary } from "../lib/webhook-subscription-mutation-boundary.mjs"

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/webhook-subscription-mutation-boundary.json", import.meta.url),
    "utf8",
  ),
)

test("allows subscription mutations only in the package-owned Postgres service", () => {
  assert.deepEqual(inspectWebhookSubscriptionMutationBoundary(fixture.allowed), [])
})

test("rejects legacy Dash and admin subscription table mutations", () => {
  for (const entry of fixture.rejected) {
    const failures = inspectWebhookSubscriptionMutationBoundary([entry])
    assert.equal(failures.length, 1)
    assert.match(failures[0], new RegExp(`subscription ${entry.operation} bypasses`))
    assert.match(failures[0], new RegExp(entry.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})
