// agent-quality: file-size exception -- owner: webhook-delivery; the existing Postgres queue, worker store, and subscription transaction boundary remain co-located until a dedicated persistence split preserves atomic behavior.
import type { EventEnvelope } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { newId } from "@voyant-travel/db/lib/typeid"
import {
  type InfraWebhookSubscription,
  infraWebhookDeliveriesTable,
  infraWebhookDeliverySelectSchema,
  infraWebhookSubscriptionInsertSchema,
  infraWebhookSubscriptionSelectSchema,
  infraWebhookSubscriptionsTable,
  infraWebhookSubscriptionUpdateSchema,
} from "@voyant-travel/db/schema/infra"
import { and, arrayContains, asc, eq, isNull, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ExternalWebhookEventContract } from "./contracts.js"
import type { OutboundWebhookDeliveryEnqueuer } from "./provider.js"
import {
  createSelectedExternalWebhookQueue,
  externalContractFromEventMetadata,
} from "./selected-queue.js"
import {
  createWebhookSubscriptionService,
  type WebhookSubscriptionService,
} from "./subscriptions.js"
import type {
  CompleteWebhookAttemptInput,
  EnqueuedWebhookAttempt,
  EnqueueWebhookAttemptInput,
  SelectedExternalWebhookQueue,
  WebhookDeliveryStore,
  WebhookEnqueueOutcome,
} from "./types.js"

export interface EnqueuePostgresWebhookEventOptions {
  queue?: SelectedExternalWebhookQueue
}

export interface CreatePostgresWebhookDeliveryEnqueuerOptions
  extends EnqueuePostgresWebhookEventOptions {
  resolveDatabase(bindings: unknown): AnyDrizzleDb
}

/** Create the package-owned Postgres enqueue adapter for a resident Node host. */
export function createPostgresWebhookDeliveryEnqueuer(
  options: CreatePostgresWebhookDeliveryEnqueuerOptions,
): OutboundWebhookDeliveryEnqueuer {
  return {
    enqueue: (event, bindings) =>
      enqueuePostgresWebhookEvent(options.resolveDatabase(bindings), event, {
        ...(options.queue ? { queue: options.queue } : {}),
      }),
  }
}

/** Persist one graph-selected event through the neutral Postgres delivery queue. */
export async function enqueuePostgresWebhookEvent(
  db: AnyDrizzleDb,
  event: EventEnvelope,
  options: EnqueuePostgresWebhookEventOptions = {},
): Promise<WebhookEnqueueOutcome[]> {
  const queue =
    options.queue ??
    createSelectedExternalWebhookQueue({
      contracts: [externalContractFromEventMetadata(event)],
      store: createPostgresWebhookDeliveryStore(db as PostgresJsDatabase),
    })
  return queue.enqueue(event)
}

/**
 * Postgres implementation for the Node delivery host. Transaction-scoped
 * advisory locks make `(idempotencyKey, attemptNumber)` atomic even though the
 * legacy audit table has an index rather than a unique constraint.
 */
export function createPostgresWebhookDeliveryStore(db: PostgresJsDatabase): WebhookDeliveryStore {
  return {
    async listActiveSubscriptions(eventName) {
      const rows = await db
        .select()
        .from(infraWebhookSubscriptionsTable)
        .where(
          and(
            eq(infraWebhookSubscriptionsTable.active, true),
            arrayContains(infraWebhookSubscriptionsTable.events, [eventName]),
          ),
        )
      return rows.map(toWebhookSubscription)
    },

    async getSubscription(id) {
      const rows = await db
        .select()
        .from(infraWebhookSubscriptionsTable)
        .where(eq(infraWebhookSubscriptionsTable.id, id))
        .limit(1)
      return rows[0] ? toWebhookSubscription(rows[0]) : null
    },

    async listReadyAttemptIds(now, staleBefore, limit) {
      const rows = await db
        .select({ id: infraWebhookDeliveriesTable.id })
        .from(infraWebhookDeliveriesTable)
        .where(
          or(
            and(
              eq(infraWebhookDeliveriesTable.status, "pending"),
              or(
                isNull(infraWebhookDeliveriesTable.scheduledFor),
                lte(infraWebhookDeliveriesTable.scheduledFor, now),
              ),
            ),
            and(
              eq(infraWebhookDeliveriesTable.status, "in_flight"),
              lte(infraWebhookDeliveriesTable.startedAt, staleBefore),
            ),
          ),
        )
        .orderBy(asc(infraWebhookDeliveriesTable.scheduledFor), asc(infraWebhookDeliveriesTable.id))
        .limit(limit)
      return rows.map(({ id }) => id)
    },

    async enqueueAttempt(input): Promise<EnqueuedWebhookAttempt> {
      return db.transaction(async (tx) => {
        const lockKey = `webhook-delivery:${input.idempotencyKey}:${input.attemptNumber}`
        // agent-quality: raw-sql reviewed -- owner: webhook-delivery; lockKey is parameter-bound and the SQL function/table identifiers are static.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`)
        const existing = await tx
          .select()
          .from(infraWebhookDeliveriesTable)
          .where(
            and(
              eq(infraWebhookDeliveriesTable.idempotencyKey, input.idempotencyKey),
              eq(infraWebhookDeliveriesTable.attemptNumber, input.attemptNumber),
            ),
          )
          .limit(1)
        if (existing[0]) {
          return {
            attempt: infraWebhookDeliverySelectSchema.parse(existing[0]),
            created: false,
          }
        }

        const inserted = await tx
          .insert(infraWebhookDeliveriesTable)
          .values(pendingAttemptValues(input))
          .returning()
        const row = inserted[0]
        if (!row) throw new Error("Webhook attempt insert returned no row")
        return {
          attempt: infraWebhookDeliverySelectSchema.parse(row),
          created: true,
        }
      })
    },

    async claimAttempt(id, now, staleBefore) {
      const rows = await db
        .update(infraWebhookDeliveriesTable)
        .set({ status: "in_flight", startedAt: now, updatedAt: now })
        .where(
          and(
            eq(infraWebhookDeliveriesTable.id, id),
            or(
              eq(infraWebhookDeliveriesTable.status, "pending"),
              and(
                eq(infraWebhookDeliveriesTable.status, "in_flight"),
                lte(infraWebhookDeliveriesTable.startedAt, staleBefore),
              ),
            ),
            or(
              isNull(infraWebhookDeliveriesTable.scheduledFor),
              lte(infraWebhookDeliveriesTable.scheduledFor, now),
            ),
          ),
        )
        .returning()
      return rows[0] ? infraWebhookDeliverySelectSchema.parse(rows[0]) : null
    },

    async completeAttempt(input: CompleteWebhookAttemptInput) {
      const rows = await db
        .update(infraWebhookDeliveriesTable)
        .set({
          status: input.status,
          responseStatus: input.responseStatus,
          responseHeaders: input.responseHeaders,
          responseBodyExcerpt: input.responseBodyExcerpt,
          errorClass: input.errorClass,
          errorMessage: input.errorMessage,
          finishedAt: input.finishedAt,
          durationMs: input.durationMs,
          updatedAt: input.finishedAt,
        })
        .where(
          and(
            eq(infraWebhookDeliveriesTable.id, input.id),
            eq(infraWebhookDeliveriesTable.status, "in_flight"),
          ),
        )
        .returning()
      const row = rows[0]
      if (!row) throw new Error(`Webhook attempt ${input.id} was not in flight`)
      return infraWebhookDeliverySelectSchema.parse(row)
    },

    async completeAndEnqueueRetry(completion, retry) {
      return db.transaction(async (tx) => {
        const completedRows = await tx
          .update(infraWebhookDeliveriesTable)
          .set(completedAttemptValues(completion))
          .where(
            and(
              eq(infraWebhookDeliveriesTable.id, completion.id),
              eq(infraWebhookDeliveriesTable.status, "in_flight"),
            ),
          )
          .returning()
        const completed = completedRows[0]
        if (!completed) throw new Error(`Webhook attempt ${completion.id} was not in flight`)

        const retryRows = await tx
          .insert(infraWebhookDeliveriesTable)
          .values(pendingAttemptValues(retry))
          .returning()
        const retryRow = retryRows[0]
        if (!retryRow) {
          throw new Error(
            `Webhook retry ${retry.idempotencyKey}:${retry.attemptNumber} returned no row`,
          )
        }
        return {
          completed: infraWebhookDeliverySelectSchema.parse(completed),
          retry: infraWebhookDeliverySelectSchema.parse(retryRow),
        }
      })
    },

    async recordSubscriptionOutcome(subscriptionId, succeeded, at) {
      await db
        .update(infraWebhookSubscriptionsTable)
        .set({
          lastDeliveryAt: at,
          // agent-quality: raw-sql reviewed -- owner: webhook-delivery; Drizzle supplies the typed column identifier and binds no caller-controlled SQL.
          failureCount: succeeded ? 0 : sql`${infraWebhookSubscriptionsTable.failureCount} + 1`,
          updatedAt: at,
        })
        .where(eq(infraWebhookSubscriptionsTable.id, subscriptionId))
    },
  }
}

function toWebhookSubscription(row: {
  id: string
  url: string
  secret: string
  headers: Record<string, string> | null
  maxRetries: number
  active: boolean
}) {
  return {
    id: row.id,
    url: row.url,
    secret: row.secret,
    keyId: null,
    headers: row.headers ?? null,
    maxRetries: row.maxRetries,
    active: row.active,
  }
}

function completedAttemptValues(input: CompleteWebhookAttemptInput) {
  return {
    status: input.status,
    responseStatus: input.responseStatus,
    responseHeaders: input.responseHeaders,
    responseBodyExcerpt: input.responseBodyExcerpt,
    errorClass: input.errorClass,
    errorMessage: input.errorMessage,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs,
    updatedAt: input.finishedAt,
  } as const
}

/** The only package-owned Postgres mutation boundary for webhook subscriptions. */
export function createPostgresWebhookSubscriptionService(
  db: PostgresJsDatabase,
  contracts: readonly ExternalWebhookEventContract[],
): WebhookSubscriptionService {
  return createWebhookSubscriptionService({
    contracts,
    store: {
      async create(input) {
        const values = infraWebhookSubscriptionInsertSchema.parse(input)
        const rows = await db
          .insert(infraWebhookSubscriptionsTable)
          .values({ id: newId("webhook_subscriptions"), ...values })
          .returning()
        return requireSubscription(rows[0], "create")
      },
      async update(id, input) {
        const values = infraWebhookSubscriptionUpdateSchema.parse(input)
        const rows = await db
          .update(infraWebhookSubscriptionsTable)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(infraWebhookSubscriptionsTable.id, id))
          .returning()
        return requireSubscription(rows[0], `update "${id}"`)
      },
    },
  })
}

function requireSubscription(row: unknown, operation: string): InfraWebhookSubscription {
  if (!row) throw new Error(`Webhook subscription ${operation} returned no row.`)
  return infraWebhookSubscriptionSelectSchema.parse(row)
}

function pendingAttemptValues(input: EnqueueWebhookAttemptInput) {
  return {
    id: input.id ?? newId("webhook_deliveries"),
    sourceModule: input.sourceModule,
    sourceEvent: input.sourceEvent,
    sourceEntityModule: input.sourceEntityModule,
    sourceEntityId: input.sourceEntityId,
    subscriptionId: input.subscriptionId,
    targetUrl: input.targetUrl,
    targetKind: "subscription",
    targetRef: input.subscriptionId,
    requestMethod: input.requestMethod,
    requestHeaders: input.requestHeaders,
    requestBodyHash: input.requestBodyHash,
    requestBodyExcerpt: input.requestBodyExcerpt,
    requestPayload: objectRecord(input.requestPayload),
    deliveryContract: objectRecord(input.deliveryContract),
    attemptNumber: input.attemptNumber,
    parentDeliveryId: input.parentDeliveryId,
    idempotencyKey: input.idempotencyKey,
    status: "pending",
    scheduledFor: input.scheduledFor,
    startedAt: null,
  } as const
}

function objectRecord(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value))
}
