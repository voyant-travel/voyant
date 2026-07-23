import { randomUUID } from "node:crypto"

import { and, eq, inArray } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import {
  buildCreatedTargetCommandFingerprint,
  claimCreatedTargetCommand,
  completeCreatedTargetCommand,
} from "../../src/created-command.js"
import { actionLedgerEntries } from "../../src/schema.js"

const describeIfDb: typeof describe = describe.skipIf(!process.env.TEST_DATABASE_URL)

describeIfDb("created-target command transaction protocol", () => {
  it("rolls back an incomplete claim and replays a committed canonical result", async () => {
    const { createTestDb } = await import("@voyant-travel/db/test-utils")
    const db = createTestDb()
    const unique = randomUUID()
    const scope = `action-ledger.created-command.integration:${unique}`
    const commandTarget = {
      type: "test-resource-create-command",
      id: `command_${unique}`,
    }
    const fingerprintInput = {
      commandInput: { label: "Integration resource" },
      policyInputs: {
        approval: "never",
        capabilityId: "test:resource:create",
        capabilityVersion: "v1",
        evaluatedRisk: "medium",
      },
    }
    const fingerprint = await buildCreatedTargetCommandFingerprint({
      actionName: "test.resource.create",
      actionVersion: "v1",
      commandTarget,
      canonicalTargetType: "test-resource",
      resultReferenceType: "test-resource-ref",
      ...fingerprintInput,
    })
    const input = {
      context: { userId: "usr_created_command_test", actor: "staff" },
      actionName: "test.resource.create",
      actionVersion: "v1",
      evaluatedRisk: "medium" as const,
      commandTarget,
      canonicalTargetType: "test-resource",
      resultReferenceType: "test-resource-ref",
      idempotency: {
        scope,
        key: `key_${unique}`,
        fingerprint,
      },
      fingerprintInput,
    }

    try {
      await expect(
        db.transaction(async (tx) => {
          await claimCreatedTargetCommand(tx, input)
          throw new Error("simulate domain mutation failure")
        }),
      ).rejects.toThrow("simulate domain mutation failure")

      const afterRollback = await db
        .select()
        .from(actionLedgerEntries)
        .where(
          and(
            inArray(actionLedgerEntries.idempotencyScope, [
              claimScope(scope),
              resultScope(scope),
            ]),
            eq(actionLedgerEntries.idempotencyKey, input.idempotency.key),
          ),
        )
      expect(afterRollback).toEqual([])

      const first = await db.transaction(async (tx) => {
        const claim = await claimCreatedTargetCommand(tx, input)
        const result = await completeCreatedTargetCommand(tx, {
          claim: claim.claim,
          targetId: `resource_${unique}`,
        })
        return { claim, result }
      })
      const replay = await db.transaction((tx) => claimCreatedTargetCommand(tx, input))

      expect(first.claim.replayed).toBe(false)
      expect(first.result).toMatchObject({
        replayed: false,
        entry: {
          causationActionId: first.claim.claim.entry.id,
          targetType: "test-resource",
          targetId: `resource_${unique}`,
        },
        reference: {
          type: "test-resource-ref",
          id: `resource_${unique}`,
          value: `test-resource-ref:resource_${unique}`,
        },
      })
      expect(replay).toMatchObject({
        replayed: true,
        result: {
          entry: { id: first.result.entry.id },
          reference: { id: `resource_${unique}` },
        },
      })
    } finally {
      await db
        .delete(actionLedgerEntries)
        .where(
          inArray(actionLedgerEntries.idempotencyScope, [
            claimScope(scope),
            resultScope(scope),
          ]),
        )
    }
  })
})

function claimScope(scope: string): string {
  return `${scope}:created-command-claim`
}

function resultScope(scope: string): string {
  return `${scope}:created-command-result`
}
