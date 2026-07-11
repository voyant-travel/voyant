import type { EventEnvelope } from "@voyant-travel/core"
import type { InfraWebhookDelivery } from "@voyant-travel/db/schema/infra"

export interface WebhookSubscription {
  id: string
  url: string
  secret: string
  headers: Record<string, string> | null
  maxRetries: number
}

export interface WebhookVisibilityPolicyInput {
  event: EventEnvelope
  eventId: string
  category: string | null
  source: string | null
  subscription: Readonly<Omit<WebhookSubscription, "secret">>
}

export type WebhookVisibilityDecision =
  | { allowed: true; payload?: unknown }
  | { allowed: false; reason: string }

export interface WebhookVisibilityPolicy {
  authorize(
    input: WebhookVisibilityPolicyInput,
  ): WebhookVisibilityDecision | Promise<WebhookVisibilityDecision>
}

export interface EnqueueWebhookAttemptInput {
  sourceModule: string
  sourceEvent: string
  sourceEntityModule: string | null
  sourceEntityId: string | null
  subscriptionId: string
  targetUrl: string
  requestMethod: string
  requestHeaders: Record<string, string>
  requestBodyHash: string
  requestBodyExcerpt: string | null
  attemptNumber: number
  parentDeliveryId: string | null
  idempotencyKey: string
  scheduledFor: Date
}

export interface CompleteWebhookAttemptInput {
  id: string
  status: "succeeded" | "failed" | "abandoned"
  responseStatus: number | null
  responseHeaders: Record<string, string> | null
  responseBodyExcerpt: string | null
  errorClass: InfraWebhookDelivery["errorClass"]
  errorMessage: string | null
  finishedAt: Date
  durationMs: number
}

export interface EnqueuedWebhookAttempt {
  attempt: InfraWebhookDelivery
  created: boolean
}

export interface WebhookDeliveryStore {
  listActiveSubscriptions(eventName: string): Promise<WebhookSubscription[]>
  enqueueAttempt(input: EnqueueWebhookAttemptInput): Promise<EnqueuedWebhookAttempt>
  claimAttempt(id: string, now: Date, staleBefore: Date): Promise<InfraWebhookDelivery | null>
  completeAttempt(input: CompleteWebhookAttemptInput): Promise<InfraWebhookDelivery>
  recordSubscriptionOutcome(subscriptionId: string, succeeded: boolean, at: Date): Promise<void>
}

export type WebhookDeliveryOutcome =
  | {
      status: "filtered"
      subscriptionId: string
      reason: string
    }
  | {
      status: "succeeded" | "dead_lettered" | "already_completed" | "already_active"
      subscriptionId: string
      delivery: InfraWebhookDelivery
      attempts: number
    }

export interface WebhookDeliveryAuditEvent {
  eventId: string
  eventName: string
  subscriptionId: string
  outcome: WebhookDeliveryOutcome["status"]
  deliveryId?: string
  attemptNumber?: number
  reason?: string
}

export interface WebhookRetryOptions {
  baseDelayMs?: number
  maxDelayMs?: number
  requestTimeoutMs?: number
  claimTimeoutMs?: number
}

export interface CreateWebhookDeliveryEngineOptions {
  store: WebhookDeliveryStore
  visibilityPolicy: WebhookVisibilityPolicy
  fetch?: typeof globalThis.fetch
  now?: () => Date
  sleep?: (milliseconds: number) => Promise<void>
  retry?: WebhookRetryOptions
  onAudit?: (event: WebhookDeliveryAuditEvent) => void | Promise<void>
}

export interface WebhookDeliveryEngine {
  enqueue(event: EventEnvelope, _bindings?: unknown): Promise<WebhookDeliveryOutcome[]>
}
