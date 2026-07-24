import { actionLedgerEntries } from "@voyant-travel/action-ledger/schema"
import { createDbClient } from "@voyant-travel/db"
import { eventOutboxTable } from "@voyant-travel/db/schema"
import { cleanupTestDb } from "@voyant-travel/db/test-utils"
import { identityContactPoints } from "@voyant-travel/identity"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  RELATIONSHIPS_PERSON_CREATED_TARGET_POLICY,
  RELATIONSHIPS_PERSON_HANDLER_ACTION_POLICY,
} from "../../src/created-target-policy.js"
import {
  executePersonCreateCommand,
  personCreatedEventId,
} from "../../src/person-created-command.js"
import { people } from "../../src/schema.js"
import { insertPersonSchema } from "../../src/validation.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
type ClosableTestDb = PostgresJsDatabase & {
  $client: { end(options?: { timeout?: number | null }): Promise<unknown> }
}

describe.skipIf(!DB_AVAILABLE)("Relationships person created-target command", () => {
  let db: ClosableTestDb

  beforeAll(() => {
    db = createDbClient(process.env.TEST_DATABASE_URL as string, {
      adapter: "node",
      nodeMaxConnections: 2,
      timeouts: { statementMs: false, queryMs: false, connectMs: false },
    }) as ClosableTestDb
  })
  beforeEach(() => cleanupTestDb(db))
  afterAll(async () => {
    await db.$client.end({ timeout: 0 })
  })

  it("atomically creates identity rows, replays, rejects drift, serializes, and enqueues once", async () => {
    const idempotencyKey = "person-create-1"
    const command = personCommand(idempotencyKey)
    let releaseFirst: () => void = () => undefined
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let domainInserted: () => void = () => undefined
    const inserted = new Promise<void>((resolve) => {
      domainInserted = resolve
    })

    const firstPromise = executePersonCreateCommand({
      ...command,
      testHooks: {
        async afterDomainCreate() {
          domainInserted()
          await holdFirst
        },
      },
    })
    await inserted
    let secondSettled = false
    const secondPromise = executePersonCreateCommand(command).finally(() => {
      secondSettled = true
    })
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(secondSettled).toBe(false)

    releaseFirst()
    const [first, concurrentReplay] = await Promise.all([firstPromise, secondPromise])
    expect(first.replayed).toBe(false)
    expect(concurrentReplay).toMatchObject({ replayed: true, value: first.value })

    const canonicalPersonId = first.value.id
    first.value.id = "mutated_response"
    const exactReplay = await executePersonCreateCommand(command)
    expect(exactReplay).toEqual(
      expect.objectContaining({
        replayed: true,
        value: { id: canonicalPersonId },
      }),
    )
    await expect(
      executePersonCreateCommand({
        ...command,
        commandInput: {
          person: { ...command.commandInput.person, lastName: "Drifted" },
        },
      }),
    ).rejects.toMatchObject({ name: "ActionLedgerIdempotencyConflictError" })

    const personRows = await db.select().from(people)
    expect(personRows).toHaveLength(1)
    expect(personRows[0]).toMatchObject({
      id: canonicalPersonId,
      firstName: "Ana",
      lastName: "Popescu",
    })
    const contactPoints = await db
      .select()
      .from(identityContactPoints)
      .where(
        and(
          eq(identityContactPoints.entityType, "person"),
          eq(identityContactPoints.entityId, canonicalPersonId),
        ),
      )
    expect(contactPoints).toHaveLength(3)
    expect(contactPoints.map(({ kind, value, isPrimary }) => ({ kind, value, isPrimary }))).toEqual(
      expect.arrayContaining([
        { kind: "email", value: "ana@example.com", isPrimary: true },
        { kind: "phone", value: "+40 721 000 001", isPrimary: true },
        { kind: "website", value: "https://ana.example.com", isPrimary: true },
      ]),
    )

    const expectedEventId = personCreatedEventId(canonicalPersonId)
    const outbox = await db.select().from(eventOutboxTable)
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({
      eventId: expectedEventId,
      name: "person.changed",
      payload: { id: canonicalPersonId, action: "created" },
      metadata: {
        category: "domain",
        source: "service",
        eventId: expectedEventId,
      },
    })

    const canonical = await db
      .select()
      .from(actionLedgerEntries)
      .where(eq(actionLedgerEntries.status, "succeeded"))
    expect(canonical).toContainEqual(
      expect.objectContaining({
        targetType: "person",
        targetId: canonicalPersonId,
        actionName: RELATIONSHIPS_PERSON_CREATED_TARGET_POLICY.actionName,
        capabilityId: RELATIONSHIPS_PERSON_CREATED_TARGET_POLICY.actionName,
        routeOrToolName: RELATIONSHIPS_PERSON_CREATED_TARGET_POLICY.toolCapabilityId,
        causationActionId: expect.any(String),
      }),
    )
  })

  it.each([
    {
      dimension: "principal",
      firstScope: { userId: "user_1", organizationId: "tenant_1" },
      secondScope: { userId: "user_2", organizationId: "tenant_1" },
    },
    {
      dimension: "organization",
      firstScope: { userId: "user_1", organizationId: "tenant_1" },
      secondScope: { userId: "user_1", organizationId: "tenant_2" },
    },
  ])("keeps identical exact-name commands distinct across the $dimension scope dimension", async ({
    dimension,
    firstScope,
    secondScope,
  }) => {
    const idempotencyKey = `person-create-cross-${dimension}`
    const first = await executePersonCreateCommand(personCommand(idempotencyKey, firstScope))
    const second = await executePersonCreateCommand(personCommand(idempotencyKey, secondScope))

    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(false)
    expect(second.value.id).not.toBe(first.value.id)
    expect((await db.select().from(people)).map(({ id }) => id).sort()).toEqual(
      [first.value.id, second.value.id].sort(),
    )
    expect((await db.select().from(eventOutboxTable)).map(({ eventId }) => eventId).sort()).toEqual(
      [personCreatedEventId(first.value.id), personCreatedEventId(second.value.id)].sort(),
    )
  })

  it("always creates a distinct person for exact-name commands with distinct keys", async () => {
    const first = await executePersonCreateCommand(personCommand("person-create-exact-name-1"))
    const second = await executePersonCreateCommand(personCommand("person-create-exact-name-2"))

    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(false)
    expect(second.value.id).not.toBe(first.value.id)
    expect((await db.select().from(people)).map(({ id }) => id).sort()).toEqual(
      [first.value.id, second.value.id].sort(),
    )
    expect((await db.select().from(eventOutboxTable)).map(({ eventId }) => eventId).sort()).toEqual(
      [personCreatedEventId(first.value.id), personCreatedEventId(second.value.id)].sort(),
    )
  })

  it("rolls back the claim, person, all contacts, outbox, and result", async () => {
    const idempotencyKey = "person-create-crash"
    const command = personCommand(idempotencyKey, { lastName: "Rollback" })
    await expect(
      executePersonCreateCommand({
        ...command,
        testHooks: {
          async afterDomainCreate() {
            throw new Error("injected post-insert crash")
          },
        },
      }),
    ).rejects.toThrow("injected post-insert crash")

    expect(await db.select().from(people).where(eq(people.lastName, "Rollback"))).toHaveLength(0)
    expect(await db.select().from(identityContactPoints)).toHaveLength(0)
    expect(await db.select().from(eventOutboxTable)).toHaveLength(0)
    expect(
      await db
        .select()
        .from(actionLedgerEntries)
        .where(eq(actionLedgerEntries.idempotencyKey, idempotencyKey)),
    ).toHaveLength(0)
  })

  it("accepts the legacy key only when it matches the admitted command key", async () => {
    const command = personCommand("person-create-admitted-key")
    await expect(
      executePersonCreateCommand({
        ...command,
        legacyIdempotencyKey: "different-top-level-key",
      }),
    ).rejects.toMatchObject({
      name: "ActionLedgerCreatedCommandProtocolError",
      reason: "admitted_policy_mismatch",
    })
    expect(await db.select().from(people)).toHaveLength(0)
    expect(await db.select().from(identityContactPoints)).toHaveLength(0)
    expect(await db.select().from(eventOutboxTable)).toHaveLength(0)
  })

  function personCommand(
    idempotencyKey: string,
    options: {
      userId?: string
      organizationId?: string
      lastName?: string
    } = {},
  ) {
    return {
      db,
      context: {
        userId: options.userId ?? "user_1",
        callerType: "session" as const,
        actor: "staff" as const,
        organizationId: options.organizationId ?? "tenant_1",
      },
      commandInput: {
        person: insertPersonSchema.parse({
          firstName: "Ana",
          lastName: options.lastName ?? "Popescu",
          email: "ana@example.com",
          phone: "+40 721 000 001",
          website: "https://ana.example.com",
        }),
      },
      admitted: {
        ...RELATIONSHIPS_PERSON_HANDLER_ACTION_POLICY,
        actionPolicy: {
          ...RELATIONSHIPS_PERSON_HANDLER_ACTION_POLICY.actionPolicy,
          enforcement: "handler" as const,
          invocation: {
            controlField: "_voyant" as const,
            requiredFields: ["idempotencyKey"] as const,
            optionalFields: ["reasonCode", "approvalId", "idempotencyFingerprint"] as const,
            fingerprintAlgorithm: "action-ledger-command-v1" as const,
          },
        },
        invocation: { idempotencyKey },
      },
    }
  }
})
