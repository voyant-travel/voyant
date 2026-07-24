import { actionLedgerEntries } from "@voyant-travel/action-ledger/schema"
import { createDbClient } from "@voyant-travel/db"
import { eventOutboxTable } from "@voyant-travel/db/schema"
import { cleanupTestDb } from "@voyant-travel/db/test-utils"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  executeProductCreateCommand,
  voyantToolContextContribution,
} from "../../src/mcp-runtime.js"
import { products } from "../../src/schema.js"
import {
  COMPOSE_PRODUCT_HANDLER_POLICY,
  CREATE_PRODUCT_HANDLER_POLICY,
  type InventoryToolServices,
} from "../../src/tools.js"
import { insertProductSchema } from "../../src/validation.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
type ClosableTestDb = PostgresJsDatabase & {
  $client: { end(options?: { timeout?: number | null }): Promise<unknown> }
}

describe.skipIf(!DB_AVAILABLE)("Inventory created-target Tool wiring", () => {
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

  async function contribute(client = db) {
    return voyantToolContextContribution.contribute({
      request: {
        var: {
          db: client,
          userId: "user_1",
          agentId: "agent_1",
          callerType: "agent",
          actor: "staff",
        },
        req: { header: () => undefined },
        get(key: string) {
          return this.var[key as keyof typeof this.var]
        },
      },
      context: {
        db: client,
        actor: "staff",
        audience: "staff",
        tenantId: "default",
        resolverScope: { locale: "en", market: "default", audience: "staff", actor: "staff" },
      },
      resources: {},
    })
  }

  async function inventory(client = db): Promise<InventoryToolServices> {
    return (await contribute(client)).inventory as InventoryToolServices
  }

  const admitted = (
    policy: typeof CREATE_PRODUCT_HANDLER_POLICY | typeof COMPOSE_PRODUCT_HANDLER_POLICY,
    idempotencyKey: string,
  ) =>
    ({
      capabilityId: policy.capabilityId,
      capabilityVersion: policy.capabilityVersion,
      canonicalName: policy.canonicalName,
      actionPolicy: {
        ...policy.actionPolicy,
        enforcement: "handler",
        invocation: {
          controlField: "_voyant",
          requiredFields: [],
          optionalFields: [],
          fingerprintAlgorithm: "action-ledger-command-v1",
        },
      },
      invocation: { idempotencyKey },
    }) as never

  it("atomically creates, replays, conflicts, serializes, and enqueues the outbox", async () => {
    const service = await inventory()
    const input = { name: "Atomic product", sellCurrency: "EUR", idempotencyKey: "create-1" }
    let releaseFirst: () => void = () => undefined
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let domainInserted: () => void = () => undefined
    const inserted = new Promise<void>((resolve) => {
      domainInserted = resolve
    })
    const command = {
      c: {
        var: { userId: "user_1", agentId: "agent_1", callerType: "agent", actor: "staff" },
        req: { header: () => undefined } as never,
      },
      db,
      idempotencyKey: undefined,
      input: insertProductSchema.parse({
        ...input,
        status: "draft",
        visibility: "private",
        activated: false,
      }),
      admitted: admitted(CREATE_PRODUCT_HANDLER_POLICY, input.idempotencyKey),
    }
    const firstPromise = executeProductCreateCommand({
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
    const secondPromise = executeProductCreateCommand(command).finally(() => {
      secondSettled = true
    })
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(secondSettled).toBe(false)
    releaseFirst()
    const [firstResult, replayResult] = await Promise.all([firstPromise, secondPromise])
    const first = firstResult.value
    const concurrentReplay = replayResult.value
    expect(first).toEqual(concurrentReplay)
    expect(replayResult.replayed).toBe(true)

    await expect(
      service.createProduct(
        { ...input, name: "Drifted product" },
        admitted(CREATE_PRODUCT_HANDLER_POLICY, input.idempotencyKey),
      ),
    ).rejects.toMatchObject({ name: "ActionLedgerIdempotencyConflictError" })

    const outbox = await db.select().from(eventOutboxTable)
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({
      name: "product.created",
      payload: { id: (first as { productId: string }).productId },
    })
    const canonical = await db
      .select()
      .from(actionLedgerEntries)
      .where(eq(actionLedgerEntries.status, "succeeded"))
    expect(canonical).toContainEqual(
      expect.objectContaining({
        targetType: "product",
        targetId: (first as { productId: string }).productId,
        actionName: CREATE_PRODUCT_HANDLER_POLICY.actionPolicy.capabilityId,
        capabilityId: CREATE_PRODUCT_HANDLER_POLICY.actionPolicy.capabilityId,
        routeOrToolName: CREATE_PRODUCT_HANDLER_POLICY.capabilityId,
        causationActionId: expect.any(String),
      }),
    )
  })

  it("rolls back claim, domain rows, result, and outbox after a post-insert failure", async () => {
    await expect(
      executeProductCreateCommand({
        c: {
          var: { userId: "user_1", callerType: "session", actor: "staff" },
          req: { header: () => undefined } as never,
        },
        db,
        idempotencyKey: "invalid-1",
        admitted: admitted(CREATE_PRODUCT_HANDLER_POLICY, "invalid-1"),
        input: insertProductSchema.parse({
          name: "Fails after insert",
          sellCurrency: "EUR",
          status: "draft",
          visibility: "private",
          activated: false,
        }),
        testHooks: {
          async afterDomainCreate() {
            throw new Error("injected post-insert failure")
          },
        },
      }),
    ).rejects.toThrow("injected post-insert failure")
    const claims = await db
      .select()
      .from(actionLedgerEntries)
      .where(eq(actionLedgerEntries.idempotencyKey, "invalid-1"))
    expect(claims).toHaveLength(0)
    expect(
      await db.select().from(products).where(eq(products.name, "Fails after insert")),
    ).toHaveLength(0)
    expect(await db.select().from(eventOutboxTable)).toHaveLength(0)
  })

  it("composes one canonical result with both durable domain events", async () => {
    const authoring = (await contribute()).inventoryAuthoring as {
      composeProduct(input: unknown, admitted: unknown): Promise<{ productId: string }>
    }
    const result = await authoring.composeProduct(
      {
        idempotencyKey: "compose-1",
        spec: {
          product: { name: "Composed product", sellCurrency: "EUR" },
          options: [{ ref: "standard", name: "Standard" }],
        },
      },
      admitted(COMPOSE_PRODUCT_HANDLER_POLICY, "compose-1"),
    )
    expect((await db.select().from(eventOutboxTable)).map(({ name }) => name).sort()).toEqual([
      "product.content.changed",
      "product.created",
    ])
    const canonical = await db
      .select()
      .from(actionLedgerEntries)
      .where(eq(actionLedgerEntries.status, "succeeded"))
    expect(canonical).toContainEqual(
      expect.objectContaining({
        targetType: "product",
        targetId: result.productId,
        actionName: COMPOSE_PRODUCT_HANDLER_POLICY.actionPolicy.capabilityId,
        capabilityId: COMPOSE_PRODUCT_HANDLER_POLICY.actionPolicy.capabilityId,
        routeOrToolName: COMPOSE_PRODUCT_HANDLER_POLICY.capabilityId,
      }),
    )
  })
})
