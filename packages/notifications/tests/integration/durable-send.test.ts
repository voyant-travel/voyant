// agent-quality: file-size exception -- owner: notifications; one live database suite proves the full durable-send admission, lease, reconciliation, settlement, and dead-letter protocol.
import { randomUUID } from "node:crypto"

import {
  type ActionLedgerRequestContextValues,
  buildActionApprovalCommandFingerprint,
  decideActionLedgerApproval,
  requestActionLedgerApproval,
} from "@voyant-travel/action-ledger"
import { actionLedgerEntries } from "@voyant-travel/action-ledger/schema"
import { createDbClient } from "@voyant-travel/db"
import { eventOutboxTable } from "@voyant-travel/db/schema"
import { cleanupTestDb } from "@voyant-travel/db/test-utils"
import type { ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  notificationDeliveries,
  notificationSendOperations,
  notificationTemplates,
} from "../../src/schema.js"
import { createNotificationService } from "../../src/service.js"
import {
  drainDurableNotificationSends,
  executeDurableNotificationSendCommand,
  NOTIFICATION_SEND_COMPLETED_EVENT,
  NOTIFICATION_SEND_DEAD_LETTERED_EVENT,
  NOTIFICATION_SEND_REQUESTED_EVENT,
} from "../../src/service-durable-send.js"
import { SEND_NOTIFICATION_HANDLER_POLICY } from "../../src/tools.js"
import type {
  DurableNotificationDeliveryContext,
  NotificationPayload,
  NotificationProvider,
  NotificationResult,
} from "../../src/types.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
type ClosableTestDb = PostgresJsDatabase & {
  $client: { end(options?: { timeout?: number | null }): Promise<unknown> }
}

describe.skipIf(!DB_AVAILABLE)("durable agent notification sends", () => {
  let db: ClosableTestDb
  let provider: ReturnType<typeof durableProvider>

  beforeAll(() => {
    db = createDbClient(process.env.TEST_DATABASE_URL as string, {
      adapter: "node",
      nodeMaxConnections: 2,
      timeouts: { statementMs: false, queryMs: false, connectMs: false },
    }) as ClosableTestDb
  })
  beforeEach(async () => {
    await cleanupTestDb(db)
    provider = durableProvider()
    await db.insert(notificationTemplates).values({
      slug: "agent-booking-confirmed",
      name: "Agent booking confirmation",
      channel: "email",
      provider: provider.name,
      status: "active",
      subjectTemplate: "Booking {{ bookingId }} confirmed",
      textTemplate: "Confirmed for {{ traveler }}",
      fromAddress: "bookings@example.test",
    })
  })
  afterAll(async () => {
    await db.$client.end({ timeout: 0 })
  })

  it("atomically prepares once, replays canonically, and rejects payload and organization drift", async () => {
    const command = await approvedCommand(`concurrent-${randomUUID()}`)
    const [first, replay] = await Promise.all([execute(command), execute(command)])

    expect([first.replayed, replay.replayed].sort()).toEqual([false, true])
    expect(first.value).toMatchObject({ id: replay.value.id, status: "pending" })
    expect(await db.select().from(notificationSendOperations)).toHaveLength(1)
    expect(await db.select().from(notificationDeliveries)).toHaveLength(1)
    const ledger = await db.select().from(actionLedgerEntries)
    expect(ledger.some(({ targetId }) => targetId === "traveler@example.test")).toBe(false)
    expect(
      ledger.some(
        ({ targetType, targetId }) =>
          targetType === "notification-template" && targetId === "agent-booking-confirmed",
      ),
    ).toBe(true)
    expect(
      (await db.select().from(eventOutboxTable)).filter(
        ({ name }) => name === NOTIFICATION_SEND_REQUESTED_EVENT,
      ),
    ).toHaveLength(1)

    await expect(
      execute({
        ...command,
        input: { ...command.input, data: { bookingId: "BK-DRIFT", traveler: "Other" } },
      }),
    ).rejects.toMatchObject({
      name: expect.stringMatching(
        /ActionLedgerCreatedCommand(?:Approval|FingerprintMismatch|Protocol)Error/,
      ),
    })

    const wrongOrganization = await approvedCommand(`wrong-org-${randomUUID()}`, {
      inputOrganizationId: "org_other",
    })
    await expect(execute(wrongOrganization)).rejects.toThrow(
      "does not match the admitted organization",
    )
    expect(await db.select().from(notificationSendOperations)).toHaveLength(1)
  })

  it("delivers identical payloads once per distinct admitted command", async () => {
    const firstCommand = await approvedCommand(`same-payload-a-${randomUUID()}`)
    const secondCommand = await approvedCommand(`same-payload-b-${randomUUID()}`)
    expect(secondCommand.context.userId).toBe(firstCommand.context.userId)
    expect(secondCommand.input).toEqual(firstCommand.input)

    const first = await execute(firstCommand)
    const second = await execute(secondCommand)
    const replay = await execute(firstCommand)
    expect(replay).toMatchObject({ replayed: true, value: first.value })
    expect(second.value.id).not.toBe(first.value.id)

    const operations = await db.select().from(notificationSendOperations)
    expect(operations).toHaveLength(2)
    expect(
      new Set(operations.map(({ providerIdempotencyKey }) => providerIdempotencyKey)).size,
    ).toBe(2)

    await expect(drainDurableNotificationSends(db, [provider])).resolves.toMatchObject({
      claimed: 2,
      sent: 2,
    })
    expect(provider.durableSend).toHaveBeenCalledTimes(2)
  })

  it("isolates provider delivery keys for identical payloads admitted in different organizations", async () => {
    const sharedKey = `cross-org-${randomUUID()}`
    const firstCommand = await approvedCommand(sharedKey, {
      contextOrganizationId: "org_notifications_a",
      omitInputOrganizationId: true,
    })
    const secondCommand = await approvedCommand(sharedKey, {
      contextOrganizationId: "org_notifications_b",
      omitInputOrganizationId: true,
    })
    expect(secondCommand.input).toEqual(firstCommand.input)

    await execute(firstCommand)
    await execute(secondCommand)
    const operations = await db.select().from(notificationSendOperations)
    expect(operations).toHaveLength(2)
    expect(
      new Set(operations.map(({ providerIdempotencyKey }) => providerIdempotencyKey)).size,
    ).toBe(2)

    await expect(drainDurableNotificationSends(db, [provider])).resolves.toMatchObject({
      claimed: 2,
      sent: 2,
    })
    expect(provider.durableSend).toHaveBeenCalledTimes(2)
  })

  it.each([
    "draft",
    "archived",
  ] as const)("rejects a %s template before committing the command intent", async (status) => {
    await db
      .update(notificationTemplates)
      .set({ status })
      .where(eq(notificationTemplates.slug, "agent-booking-confirmed"))
    const command = await approvedCommand(`inactive-${status}-${randomUUID()}`)

    await expect(execute(command)).rejects.toThrow("is not active and cannot be sent")
    expect(await db.select().from(notificationSendOperations)).toHaveLength(0)
    expect(await db.select().from(notificationDeliveries)).toHaveLength(0)
    expect(
      (await db.select().from(eventOutboxTable)).filter(
        ({ name }) => name === NOTIFICATION_SEND_REQUESTED_EVENT,
      ),
    ).toHaveLength(0)
  })

  it("rolls back the claim, delivery, operation, and requested event when preparation crashes", async () => {
    const command = await approvedCommand(`prepare-crash-${randomUUID()}`)
    await expect(
      executeDurableNotificationSendCommand({
        ...command,
        db,
        dispatcher: createNotificationService([provider]),
        testHooks: {
          async afterPrepare() {
            throw new Error("injected prepare crash")
          },
        },
      }),
    ).rejects.toThrow("injected prepare crash")

    expect(await db.select().from(notificationSendOperations)).toHaveLength(0)
    expect(await db.select().from(notificationDeliveries)).toHaveLength(0)
    expect(
      await db
        .select()
        .from(actionLedgerEntries)
        .where(eq(actionLedgerEntries.idempotencyKey, command.admitted.invocation.idempotencyKey!)),
    ).toHaveLength(1)
    expect(
      (await db.select().from(eventOutboxTable)).filter(
        ({ name }) => name === NOTIFICATION_SEND_REQUESTED_EVENT,
      ),
    ).toHaveLength(0)
  })

  it("fails closed before committing intent when the selected provider cannot reconcile", async () => {
    const command = await approvedCommand(`unsupported-${randomUUID()}`)
    const unsupported: NotificationProvider = {
      name: provider.name,
      channels: ["email"],
      defaultFromAddress: "unsupported@example.test",
      durableDelivery: {
        supported: false,
        reason: "provider has no durable idempotency API",
      },
      async send() {
        throw new Error("must not dispatch")
      },
    }

    await expect(
      executeDurableNotificationSendCommand({
        ...command,
        db,
        dispatcher: createNotificationService([unsupported]),
      }),
    ).rejects.toThrow("provider has no durable idempotency API")
    expect(await db.select().from(notificationSendOperations)).toHaveLength(0)
    expect(await db.select().from(notificationDeliveries)).toHaveLength(0)
  })

  it("reconciles provider success after a local settle crash without sending twice", async () => {
    const command = await approvedCommand(`provider-crash-${randomUUID()}`)
    const pending = await execute(command)
    expect(pending.value.status).toBe("pending")

    const acceptedCrash = vi.fn(async () => {
      throw new Error("injected post-provider crash")
    })
    const firstDrain = await drainDurableNotificationSends(db, [provider], {
      now: new Date("2026-07-24T12:00:00.000Z"),
      retryBaseMs: 0,
      testHooks: { afterProviderAccepted: acceptedCrash },
    })
    expect(firstDrain).toMatchObject({ claimed: 1, retried: 1, sent: 0 })
    expect(provider.durableSend).toHaveBeenCalledOnce()

    const recovered = await drainDurableNotificationSends(db, [provider], {
      now: new Date("2026-07-24T12:00:01.000Z"),
      retryBaseMs: 0,
    })
    expect(recovered).toMatchObject({ claimed: 1, sent: 1, retried: 0 })
    expect(provider.durableSend).toHaveBeenCalledOnce()
    expect(provider.reconcile).toHaveBeenCalledTimes(2)

    const replay = await execute(command)
    expect(replay.replayed).toBe(true)
    expect(replay.value).toEqual(pending.value)
    expect(replay.value).toMatchObject({ id: pending.value.id, status: "pending" })
    expect(
      (
        await db
          .select()
          .from(notificationDeliveries)
          .where(eq(notificationDeliveries.id, pending.value.id as string))
      )[0],
    ).toMatchObject({ status: "sent", providerMessageId: expect.any(String) })
    const events = await db.select().from(eventOutboxTable)
    expect(events.filter(({ name }) => name === NOTIFICATION_SEND_REQUESTED_EVENT)).toHaveLength(1)
    expect(events.filter(({ name }) => name === NOTIFICATION_SEND_COMPLETED_EVENT)).toHaveLength(1)
  })

  it("rolls back mutable settlement when completion event capture fails", async () => {
    const command = await approvedCommand(`settle-rollback-${randomUUID()}`)
    const pending = await execute(command)
    const failedSettle = await drainDurableNotificationSends(db, [provider], {
      now: new Date("2026-07-24T12:00:00.000Z"),
      retryBaseMs: 0,
      testHooks: {
        async beforeCompletionEvent() {
          throw new Error("injected completion event failure")
        },
      },
    })
    expect(failedSettle).toMatchObject({ claimed: 1, retried: 1, sent: 0 })
    expect((await db.select().from(notificationSendOperations))[0]).toMatchObject({
      status: "retry",
      lastError: "injected completion event failure",
    })
    expect(
      (
        await db
          .select()
          .from(notificationDeliveries)
          .where(eq(notificationDeliveries.id, pending.value.id as string))
      )[0],
    ).toMatchObject({ status: "pending", providerMessageId: null, sentAt: null })
    expect(
      (await db.select().from(eventOutboxTable)).filter(
        ({ name }) => name === NOTIFICATION_SEND_COMPLETED_EVENT,
      ),
    ).toHaveLength(0)

    await expect(
      drainDurableNotificationSends(db, [provider], {
        now: new Date("2026-07-24T12:00:01.000Z"),
        retryBaseMs: 0,
      }),
    ).resolves.toMatchObject({ sent: 1 })
  })

  it("reclaims an expired processing lease and completes exactly once", async () => {
    const command = await approvedCommand(`lease-recovery-${randomUUID()}`)
    await execute(command)
    await db.update(notificationSendOperations).set({
      status: "processing",
      attempts: 1,
      leaseExpiresAt: new Date("2026-07-24T11:59:00.000Z"),
    })

    const recovered = await drainDurableNotificationSends(db, [provider], {
      now: new Date("2026-07-24T12:00:00.000Z"),
    })
    expect(recovered).toMatchObject({ claimed: 1, sent: 1 })
    expect(provider.durableSend).toHaveBeenCalledOnce()
    expect((await db.select().from(notificationSendOperations))[0]).toMatchObject({
      status: "sent",
      attempts: 2,
    })
    expect(
      (await db.select().from(eventOutboxTable)).filter(
        ({ name }) => name === NOTIFICATION_SEND_COMPLETED_EVENT,
      ),
    ).toHaveLength(1)
  })

  it("fences an expired worker after a successor settles the same provider result", async () => {
    const command = await approvedCommand(`lease-fencing-${randomUUID()}`)
    await execute(command)
    let releaseFirst: () => void = () => undefined
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    let providerAccepted: () => void = () => undefined
    const accepted = new Promise<void>((resolve) => {
      providerAccepted = resolve
    })
    const firstDrain = drainDurableNotificationSends(db, [provider], {
      now: new Date("2026-07-24T12:00:00.000Z"),
      visibilityTimeoutMs: 1_000,
      retryBaseMs: 0,
      testHooks: {
        async afterProviderAccepted() {
          providerAccepted()
          await holdFirst
        },
      },
    })
    await accepted

    const successor = await drainDurableNotificationSends(db, [provider], {
      now: new Date("2026-07-24T12:00:02.000Z"),
      visibilityTimeoutMs: 1_000,
      retryBaseMs: 0,
    })
    expect(successor).toMatchObject({ claimed: 1, sent: 1 })
    releaseFirst()
    await expect(firstDrain).resolves.toMatchObject({
      claimed: 1,
      retried: 0,
      deadLettered: 0,
      sent: 0,
    })

    expect(provider.durableSend).toHaveBeenCalledOnce()
    expect((await db.select().from(notificationSendOperations))[0]).toMatchObject({
      status: "sent",
      attempts: 2,
    })
    expect(
      (await db.select().from(eventOutboxTable)).filter(
        ({ name }) => name === NOTIFICATION_SEND_COMPLETED_EVENT,
      ),
    ).toHaveLength(1)
  })

  it("retries missing provider configuration before dead-lettering at the lease budget", async () => {
    const command = await approvedCommand(`provider-missing-${randomUUID()}`)
    const pending = await execute(command)
    await db.update(notificationSendOperations).set({ maxAttempts: 2 })

    const first = await drainDurableNotificationSends(db, [], {
      now: new Date("2026-07-24T12:00:00.000Z"),
      retryBaseMs: 0,
    })
    expect(first).toMatchObject({ claimed: 1, retried: 1, deadLettered: 0, sent: 0 })
    expect((await db.select().from(notificationSendOperations))[0]).toMatchObject({
      status: "retry",
      attempts: 1,
      lastError: "provider is not currently registered",
    })
    expect(
      (
        await db
          .select()
          .from(notificationDeliveries)
          .where(eq(notificationDeliveries.id, pending.value.id as string))
      )[0],
    ).toMatchObject({ status: "pending", errorMessage: null })

    const exhausted = await drainDurableNotificationSends(db, [], {
      now: new Date("2026-07-24T12:00:01.000Z"),
      retryBaseMs: 0,
    })
    expect(exhausted).toMatchObject({ claimed: 1, deadLettered: 1, sent: 0 })
    expect((await db.select().from(notificationSendOperations))[0]).toMatchObject({
      status: "dead_letter",
      attempts: 2,
      lastError: "provider is not currently registered",
      completedAt: expect.any(Date),
    })
    expect(
      (
        await db
          .select()
          .from(notificationDeliveries)
          .where(eq(notificationDeliveries.id, pending.value.id as string))
      )[0],
    ).toMatchObject({ status: "failed", errorMessage: "provider is not currently registered" })
    expect(
      (await db.select().from(eventOutboxTable)).filter(
        ({ name }) => name === NOTIFICATION_SEND_DEAD_LETTERED_EVENT,
      ),
    ).toHaveLength(1)
  })

  it("dead-letters immediately when the selected provider explicitly drops durable support", async () => {
    const command = await approvedCommand(`provider-unsupported-${randomUUID()}`)
    await execute(command)
    const unsupported: NotificationProvider = {
      name: provider.name,
      channels: ["email"],
      defaultFromAddress: "unsupported@example.test",
      durableDelivery: { supported: false, reason: "durable protocol was disabled" },
      async send() {
        throw new Error("must not dispatch")
      },
    }

    const drained = await drainDurableNotificationSends(db, [unsupported], {
      now: new Date("2026-07-24T12:00:00.000Z"),
    })
    expect(drained).toMatchObject({ claimed: 1, deadLettered: 1, retried: 0 })
    expect((await db.select().from(notificationSendOperations))[0]).toMatchObject({
      status: "dead_letter",
      attempts: 1,
      lastError: "durable protocol was disabled",
    })
  })

  async function execute(command: Awaited<ReturnType<typeof approvedCommand>>) {
    return executeDurableNotificationSendCommand({
      ...command,
      db,
      dispatcher: createNotificationService([provider]),
    })
  }

  async function approvedCommand(
    idempotencyKey: string,
    options: {
      inputOrganizationId?: string
      contextOrganizationId?: string
      omitInputOrganizationId?: boolean
    } = {},
  ) {
    const organizationId = options.contextOrganizationId ?? "org_notifications"
    const context: ActionLedgerRequestContextValues = {
      userId: "usr_notifications_agent",
      callerType: "session",
      actor: "staff",
      organizationId,
    }
    const input = {
      templateSlug: "agent-booking-confirmed",
      to: "traveler@example.test",
      channel: "email" as const,
      data: { bookingId: "BK-100", traveler: "Mihai" },
      bookingId: "book_100",
      ...(options.omitInputOrganizationId
        ? {}
        : { organizationId: options.inputOrganizationId ?? organizationId }),
    }
    const policy = SEND_NOTIFICATION_HANDLER_POLICY.actionPolicy
    const reasonCode = "approved_agent_notification"
    const fingerprint = await buildActionApprovalCommandFingerprint({
      actionName: policy.capabilityId,
      actionVersion: policy.version,
      targetType: policy.targetType,
      targetId: input.templateSlug,
      commandInput: input,
      approvalPolicy: "required",
      capabilityId: policy.capabilityId,
      capabilityVersion: policy.version,
      evaluatedRisk: "high",
      reasonCode,
    })
    const requested = await requestActionLedgerApproval(db, {
      context,
      actionName: policy.capabilityId,
      actionVersion: policy.version,
      actionKind: "execute",
      evaluatedRisk: "high",
      targetType: policy.targetType,
      targetId: input.templateSlug,
      routeOrToolName: SEND_NOTIFICATION_HANDLER_POLICY.capabilityId,
      capabilityId: policy.capabilityId,
      capabilityVersion: policy.version,
      authorizationSource: "integration_test",
      idempotencyScope: `${organizationId}:notifications-approval:${idempotencyKey}`,
      idempotencyKey,
      idempotencyFingerprint: fingerprint,
      approval: {
        assignedToPrincipalId: "usr_notifications_agent",
        policyName: "notifications-agent-send",
        policyVersion: policy.version,
        riskSnapshot: "high",
        reasonCode,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    await decideActionLedgerApproval(db, {
      context,
      id: requested.approval.id,
      status: "approved",
      actionName: "notifications.approval.decision",
      actionVersion: "v1",
      evaluatedRisk: "high",
      organizationId,
    })
    const admitted: ToolHandlerActionPolicyContext = {
      capabilityId: SEND_NOTIFICATION_HANDLER_POLICY.capabilityId,
      capabilityVersion: SEND_NOTIFICATION_HANDLER_POLICY.capabilityVersion,
      canonicalName: SEND_NOTIFICATION_HANDLER_POLICY.canonicalName,
      actionPolicy: {
        ...policy,
        enforcement: "handler",
        invocation: {
          controlField: "_voyant",
          requiredFields: [
            "confirmed",
            "targetId",
            "idempotencyKey",
            "approvalId",
            "idempotencyFingerprint",
          ],
          optionalFields: ["reasonCode", "approvalId", "idempotencyFingerprint"],
          fingerprintAlgorithm: "action-ledger-command-v1",
        },
      },
      invocation: {
        confirmed: true,
        targetId: input.templateSlug,
        idempotencyKey,
        approvalId: requested.approval.id,
        idempotencyFingerprint: fingerprint,
        reasonCode,
      },
    }
    return { context, admitted, input }
  }
})

function durableProvider() {
  const accepted = new Map<string, NotificationResult>()
  const durableSend = vi.fn(
    async (_payload: NotificationPayload, context: DurableNotificationDeliveryContext) => {
      const existing = accepted.get(context.idempotencyKey)
      if (existing) return existing
      const result = {
        id: `provider_${context.idempotencyKey.slice(-12)}`,
        provider: "durable-test-email",
      }
      accepted.set(context.idempotencyKey, result)
      return result
    },
  )
  const reconcile = vi.fn(async (context: DurableNotificationDeliveryContext) => {
    return accepted.get(context.idempotencyKey) ?? null
  })
  return {
    name: "durable-test-email",
    channels: ["email"],
    defaultFromAddress: "durable@example.test",
    durableDelivery: {
      supported: true,
      protocol: "notification-provider-idempotency-v1",
      send: durableSend,
      reconcile,
    },
    send: vi.fn(async () => {
      throw new Error("request-scoped send must not run for durable operations")
    }),
    durableSend,
    reconcile,
  } satisfies NotificationProvider & {
    durableSend: ReturnType<typeof vi.fn>
    reconcile: ReturnType<typeof vi.fn>
  }
}
