import type { EventEnvelope } from "@voyant-travel/core"
import type { InfraWebhookDelivery } from "@voyant-travel/db/schema/infra"

import {
  hashWebhookPayload,
  redactWebhookHeaders,
  signWebhookPayload,
  webhookBodyExcerpt,
} from "./security.js"
import type {
  CreateWebhookDeliveryEngineOptions,
  WebhookDeliveryAuditEvent,
  WebhookDeliveryEngine,
  WebhookDeliveryOutcome,
  WebhookSubscription,
} from "./types.js"

const DEFAULT_BASE_DELAY_MS = 1_000
const DEFAULT_MAX_DELAY_MS = 60_000
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000
const DEFAULT_CLAIM_TIMEOUT_MS = 60_000
const MAX_RESPONSE_BODY_BYTES = 4 * 1024
const MAX_ERROR_MESSAGE_LENGTH = 1_000

export function createWebhookDeliveryEngine(
  options: CreateWebhookDeliveryEngineOptions,
): WebhookDeliveryEngine {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const now = options.now ?? (() => new Date())
  const sleep =
    options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
  const baseDelayMs = positiveInteger(options.retry?.baseDelayMs, DEFAULT_BASE_DELAY_MS)
  const maxDelayMs = positiveInteger(options.retry?.maxDelayMs, DEFAULT_MAX_DELAY_MS)
  const requestTimeoutMs = positiveInteger(
    options.retry?.requestTimeoutMs,
    DEFAULT_REQUEST_TIMEOUT_MS,
  )
  const claimTimeoutMs = positiveInteger(options.retry?.claimTimeoutMs, DEFAULT_CLAIM_TIMEOUT_MS)

  return {
    async enqueue(event) {
      const eventId = requireEventId(event)
      const subscriptions = await options.store.listActiveSubscriptions(event.name)
      return Promise.all(
        subscriptions.map(async (subscription) => {
          const decision = await options.visibilityPolicy.authorize({
            event,
            eventId,
            category: stringMetadata(event, "category"),
            source: stringMetadata(event, "source"),
            subscription: publicSubscription(subscription),
          })
          if (!decision.allowed) {
            const outcome: WebhookDeliveryOutcome = {
              status: "filtered",
              subscriptionId: subscription.id,
              reason: decision.reason,
            }
            await audit(options, event, outcome)
            return outcome
          }
          const payload = decision.payload ?? event
          const body = JSON.stringify(payload)
          return deliverToSubscription(event, eventId, subscription, body)
        }),
      )
    },
  }

  async function deliverToSubscription(
    event: EventEnvelope,
    eventId: string,
    subscription: WebhookSubscription,
    body: string,
  ): Promise<WebhookDeliveryOutcome> {
    assertWebhookUrl(subscription.url)
    const idempotencyKey = `graph-webhook:${eventId}:${subscription.id}`
    const maxAttempts = Math.max(1, subscription.maxRetries + 1)
    let parentDeliveryId: string | null = null

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
      const delayMs =
        attemptNumber === 1 ? 0 : retryDelay(attemptNumber - 1, baseDelayMs, maxDelayMs)
      const scheduledFor = new Date(now().getTime() + delayMs)
      const timestamp = Math.floor(scheduledFor.getTime() / 1_000).toString()
      const requestHeaders = signedHeaders(
        subscription,
        event,
        eventId,
        idempotencyKey,
        timestamp,
        body,
      )
      const enqueued = await options.store.enqueueAttempt({
        sourceModule: stringMetadata(event, "graphEventSourceModule") ?? "graph-outbound-webhooks",
        sourceEvent: event.name,
        ...sourceEntity(event.data),
        subscriptionId: subscription.id,
        targetUrl: subscription.url,
        requestMethod: "POST",
        requestHeaders: redactWebhookHeaders(requestHeaders) ?? {},
        requestBodyHash: hashWebhookPayload(body),
        requestBodyExcerpt: webhookBodyExcerpt(body),
        attemptNumber,
        parentDeliveryId,
        idempotencyKey,
        scheduledFor,
      })

      if (!enqueued.created && isTerminal(enqueued.attempt)) {
        const outcome: WebhookDeliveryOutcome = {
          status: "already_completed",
          subscriptionId: subscription.id,
          delivery: enqueued.attempt,
          attempts: attemptNumber,
        }
        await audit(options, event, outcome)
        return outcome
      }
      if (!enqueued.created && enqueued.attempt.status === "failed") {
        parentDeliveryId = enqueued.attempt.id
        continue
      }
      if (delayMs > 0) await sleep(delayMs)
      const startedAt = now()
      const staleBefore = new Date(startedAt.getTime() - claimTimeoutMs)
      const claimed = await options.store.claimAttempt(enqueued.attempt.id, startedAt, staleBefore)
      if (!claimed) {
        const replay = await options.store.enqueueAttempt({
          sourceModule:
            stringMetadata(event, "graphEventSourceModule") ?? "graph-outbound-webhooks",
          sourceEvent: event.name,
          ...sourceEntity(event.data),
          subscriptionId: subscription.id,
          targetUrl: subscription.url,
          requestMethod: "POST",
          requestHeaders: redactWebhookHeaders(requestHeaders) ?? {},
          requestBodyHash: hashWebhookPayload(body),
          requestBodyExcerpt: webhookBodyExcerpt(body),
          attemptNumber,
          parentDeliveryId,
          idempotencyKey,
          scheduledFor,
        })
        if (isTerminal(replay.attempt)) {
          const outcome: WebhookDeliveryOutcome = {
            status: "already_completed",
            subscriptionId: subscription.id,
            delivery: replay.attempt,
            attempts: attemptNumber,
          }
          await audit(options, event, outcome)
          return outcome
        }
        const outcome: WebhookDeliveryOutcome = {
          status: "already_active",
          subscriptionId: subscription.id,
          delivery: replay.attempt,
          attempts: attemptNumber,
        }
        await audit(options, event, outcome)
        return outcome
      }

      const result = await dispatch(
        fetchImpl,
        subscription.url,
        requestHeaders,
        body,
        requestTimeoutMs,
      )
      const retryable = result.retryable && attemptNumber < maxAttempts
      const terminalStatus = result.succeeded ? "succeeded" : retryable ? "failed" : "abandoned"
      const completed = await options.store.completeAttempt({
        id: claimed.id,
        status: terminalStatus,
        responseStatus: result.responseStatus,
        responseHeaders: redactWebhookHeaders(result.responseHeaders),
        responseBodyExcerpt: webhookBodyExcerpt(result.responseBody),
        errorClass: result.errorClass,
        errorMessage: result.errorMessage,
        finishedAt: now(),
        durationMs: Math.max(0, now().getTime() - startedAt.getTime()),
      })

      if (result.succeeded) {
        await options.store.recordSubscriptionOutcome(subscription.id, true, now())
        const outcome: WebhookDeliveryOutcome = {
          status: "succeeded",
          subscriptionId: subscription.id,
          delivery: completed,
          attempts: attemptNumber,
        }
        await audit(options, event, outcome)
        return outcome
      }

      if (!retryable) {
        await options.store.recordSubscriptionOutcome(subscription.id, false, now())
        const outcome: WebhookDeliveryOutcome = {
          status: "dead_lettered",
          subscriptionId: subscription.id,
          delivery: completed,
          attempts: attemptNumber,
        }
        await audit(options, event, outcome)
        return outcome
      }
      parentDeliveryId = completed.id
    }

    throw new Error("Webhook delivery exhausted retries without a terminal outcome")
  }
}

interface DispatchResult {
  succeeded: boolean
  retryable: boolean
  responseStatus: number | null
  responseHeaders?: Record<string, string>
  responseBody?: string
  errorClass: InfraWebhookDelivery["errorClass"]
  errorMessage: string | null
}

async function dispatch(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
): Promise<DispatchResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    })
    const responseBody = await readBoundedResponseBody(response, MAX_RESPONSE_BODY_BYTES)
    const responseHeaders = Object.fromEntries(response.headers.entries())
    if (response.ok) {
      return {
        succeeded: true,
        retryable: false,
        responseStatus: response.status,
        responseHeaders,
        responseBody,
        errorClass: null,
        errorMessage: null,
      }
    }
    const rateLimited = response.status === 429
    const retryable = rateLimited || response.status === 408 || response.status >= 500
    return {
      succeeded: false,
      retryable,
      responseStatus: response.status,
      responseHeaders,
      responseBody,
      errorClass: rateLimited ? "rate_limited" : response.status >= 500 ? "5xx" : "4xx",
      errorMessage: boundedMessage(`HTTP ${response.status}`),
    }
  } catch (error) {
    const timedOut = controller.signal.aborted
    return {
      succeeded: false,
      retryable: true,
      responseStatus: null,
      errorClass: timedOut ? "timeout" : "network",
      errorMessage: boundedMessage(error instanceof Error ? error.message : String(error)),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function readBoundedResponseBody(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ""

  const buffer = new Uint8Array(maxBytes)
  let offset = 0
  let complete = false
  try {
    while (offset < maxBytes) {
      const chunk = await reader.read()
      if (chunk.done) {
        complete = true
        break
      }
      const remaining = maxBytes - offset
      const length = Math.min(remaining, chunk.value.byteLength)
      buffer.set(chunk.value.subarray(0, length), offset)
      offset += length
      if (length < chunk.value.byteLength) break
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined)
  }
  return new TextDecoder().decode(buffer.subarray(0, offset))
}

function signedHeaders(
  subscription: WebhookSubscription,
  event: EventEnvelope,
  eventId: string,
  idempotencyKey: string,
  timestamp: string,
  body: string,
): Record<string, string> {
  const contractId = stringMetadata(event, "graphEventId")
  const contractVersion = stringMetadata(event, "graphEventVersion")
  return {
    ...(subscription.headers ?? {}),
    "content-type": "application/json",
    "idempotency-key": idempotencyKey,
    "x-voyant-event": event.name,
    "x-voyant-event-id": eventId,
    ...(contractId ? { "x-voyant-event-contract": contractId } : {}),
    ...(contractVersion ? { "x-voyant-event-version": contractVersion } : {}),
    "x-voyant-timestamp": timestamp,
    "x-voyant-signature": signWebhookPayload(subscription.secret, timestamp, body),
  }
}

function requireEventId(event: EventEnvelope): string {
  const eventId = event.metadata?.eventId
  if (typeof eventId !== "string" || eventId.trim().length === 0) {
    throw new Error(`Webhook event "${event.name}" requires metadata.eventId`)
  }
  return eventId
}

function stringMetadata(event: EventEnvelope, key: string): string | null {
  const value = event.metadata?.[key]
  return typeof value === "string" ? value : null
}

function publicSubscription(
  subscription: WebhookSubscription,
): Omit<WebhookSubscription, "secret"> {
  const { secret: _secret, ...visible } = subscription
  return visible
}

function sourceEntity(data: unknown): {
  sourceEntityModule: string | null
  sourceEntityId: string | null
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { sourceEntityModule: null, sourceEntityId: null }
  }
  const record = data as Record<string, unknown>
  const module = record.entityModule ?? record.entity_module
  const id = record.entityId ?? record.entity_id
  return {
    sourceEntityModule: typeof module === "string" ? module : null,
    sourceEntityId: typeof id === "string" ? id : null,
  }
}

function retryDelay(retryNumber: number, baseDelayMs: number, maxDelayMs: number): number {
  return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, retryNumber - 1))
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback
}

function boundedMessage(message: string): string {
  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH)
}

function isTerminal(delivery: InfraWebhookDelivery): boolean {
  return delivery.status === "succeeded" || delivery.status === "abandoned"
}

function assertWebhookUrl(value: string): void {
  const url = new URL(value)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Webhook URL must use HTTP(S): ${value}`)
  }
}

async function audit(
  options: CreateWebhookDeliveryEngineOptions,
  event: EventEnvelope,
  outcome: WebhookDeliveryOutcome,
): Promise<void> {
  if (!options.onAudit) return
  const contractId = stringMetadata(event, "graphEventId")
  const contractVersion = stringMetadata(event, "graphEventVersion")
  const auditEvent: WebhookDeliveryAuditEvent = {
    eventId: requireEventId(event),
    eventName: event.name,
    ...(contractId ? { contractId } : {}),
    ...(contractVersion ? { contractVersion } : {}),
    subscriptionId: outcome.subscriptionId,
    outcome: outcome.status,
    ...(outcome.status === "filtered"
      ? { reason: outcome.reason }
      : {
          deliveryId: outcome.delivery.id,
          attemptNumber: outcome.delivery.attemptNumber,
        }),
  }
  await options.onAudit(auditEvent)
}
