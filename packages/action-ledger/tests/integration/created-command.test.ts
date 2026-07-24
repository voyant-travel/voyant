import { randomUUID } from "node:crypto"

import type { AnyDrizzleDb } from "@voyant-travel/db"
import { createDbClient } from "@voyant-travel/db"
import { dbClientDispose } from "@voyant-travel/db/transaction-capability"
import { inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"

import {
  buildCreatedTargetCommandFingerprint,
  executeCreatedTargetCommand,
} from "../../src/created-command.js"
import { actionLedgerEntries } from "../../src/schema.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const describeIfDb: typeof describe = describe.skipIf(!TEST_DATABASE_URL)

describeIfDb("created-target command transaction protocol", () => {
  it("rolls back failed mutation and serializes concurrent equal commands", async () => {
    const db = createDbClient(TEST_DATABASE_URL!, {
      adapter: "node",
      nodeMaxConnections: 2,
      timeouts: { statementMs: false, queryMs: false, connectMs: false },
    }) as PostgresJsDatabase
    const unique = randomUUID()
    const scope = `action-ledger.created-command.integration:${unique}`
    const commandTarget = {
      type: "test-resource-create-command",
      id: `command_${unique}`,
    }
    const fingerprintInput = {
      actionName: "test.resource.create",
      actionVersion: "v1",
      commandTarget,
      canonicalTargetType: "test-resource",
      resultReferenceType: "test-resource-ref",
      commandInput: { label: "Integration resource" },
      capabilityId: "test:resource:create",
      capabilityVersion: "v1",
      evaluatedRisk: "medium" as const,
      approvalPolicy: "none" as const,
      approvalReasonCode: null,
    }
    const input = {
      context: {
        userId: "usr_created_command_test",
        callerType: "session",
        actor: "staff",
        organizationId: "org_created_command_test",
      },
      ...fingerprintInput,
      idempotency: {
        scope,
        key: `key_${unique}`,
        fingerprint: await buildCreatedTargetCommandFingerprint(fingerprintInput),
      },
    }
    let createCalls = 0
    const handlers = {
      async create() {
        createCalls += 1
        return {
          value: { id: `resource_${unique}` },
          targetId: `resource_${unique}`,
        }
      },
      async replay(_tx: AnyDrizzleDb, result: { reference: { id: string } }) {
        return { id: result.reference.id }
      },
    }

    try {
      await expect(
        executeCreatedTargetCommand(db, input, {
          ...handlers,
          async create() {
            throw new Error("simulate domain mutation failure")
          },
        }),
      ).rejects.toThrow("simulate domain mutation failure")

      expect(await rowsForScopes(db, scope)).toEqual([])

      const [first, second] = await Promise.all([
        executeCreatedTargetCommand(db, input, handlers),
        executeCreatedTargetCommand(db, input, handlers),
      ])

      expect(createCalls).toBe(1)
      expect([first.replayed, second.replayed].sort()).toEqual([false, true])
      expect(first.value.id).toBe(`resource_${unique}`)
      expect(second.value.id).toBe(`resource_${unique}`)
      expect(await rowsForScopes(db, scope)).toHaveLength(2)
    } finally {
      await db
        .delete(actionLedgerEntries)
        .where(
          inArray(actionLedgerEntries.idempotencyScope, [claimScope(scope), resultScope(scope)]),
        )
      await dbClientDispose(db)?.()
    }
  })
})

function rowsForScopes(db: PostgresJsDatabase, scope: string) {
  return db
    .select()
    .from(actionLedgerEntries)
    .where(inArray(actionLedgerEntries.idempotencyScope, [claimScope(scope), resultScope(scope)]))
}

function claimScope(scope: string): string {
  return `${scope}:created-command-claim`
}

function resultScope(scope: string): string {
  return `${scope}:created-command-result`
}
