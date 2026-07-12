import type { EventEnvelope } from "@voyant-travel/core"
import type { InfraWebhookDelivery } from "@voyant-travel/db/schema/infra"

import type { ExternalWebhookEventContract } from "./contracts.js"

export interface WebhookSubscription {
  id: string
  url: string
  secret: string
  headers: Record<string, string> | null
  maxRetries: number
  active: boolean
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
  requestPayload: EventEnvelope
  deliveryContract: ExternalWebhookEventContract
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
  getSubscription(id: string): Promise<WebhookSubscription | null>
  enqueueAttempt(input: EnqueueWebhookAttemptInput): Promise<EnqueuedWebhookAttempt>
  listReadyAttemptIds(now: Date, staleBefore: Date, limit: number): Promise<string[]>
  claimAttempt(id: string, now: Date, staleBefore: Date): Promise<InfraWebhookDelivery | null>
  completeAttempt(input: CompleteWebhookAttemptInput): Promise<InfraWebhookDelivery>
  completeAndEnqueueRetry(
    completion: CompleteWebhookAttemptInput,
    retry: EnqueueWebhookAttemptInput,
  ): Promise<{ completed: InfraWebhookDelivery; retry: InfraWebhookDelivery }>
  recordSubscriptionOutcome(subscriptionId: string, succeeded: boolean, at: Date): Promise<void>
}

export type WebhookEnqueueOutcome = {
  status: "pending" | "already_pending" | "already_completed"
  subscriptionId: string
  delivery: InfraWebhookDelivery
}

export type WebhookDeliveryOutcome =
  | {
      status: "succeeded" | "dead_lettered" | "retry_scheduled"
      subscriptionId: string | null
      delivery: InfraWebhookDelivery
      nextAttempt?: InfraWebhookDelivery
    }
  | { status: "idle" }

export interface WebhookDeliveryAuditEvent {
  eventId: string | null
  eventName: string
  contractId?: string
  contractVersion?: string
  subscriptionId: string | null
  outcome: Exclude<WebhookDeliveryOutcome["status"], "idle">
  deliveryId: string
  attemptNumber: number
  reason?: string
}

export interface WebhookRetryOptions {
  baseDelayMs?: number
  maxDelayMs?: number
  requestTimeoutMs?: number
  claimTimeoutMs?: number
}

export interface CreateWebhookDeliveryWorkerOptions {
  store: WebhookDeliveryStore
  fetch?: typeof globalThis.fetch
  now?: () => Date
  retry?: WebhookRetryOptions
  onAudit?: (event: WebhookDeliveryAuditEvent) => void | Promise<void>
}

export interface WebhookDeliveryWorker {
  runNext(): Promise<WebhookDeliveryOutcome>
  drain(options?: { limit?: number }): Promise<WebhookDeliveryOutcome[]>
}

export interface SelectedExternalWebhookQueue {
  enqueue(event: EventEnvelope): Promise<WebhookEnqueueOutcome[]>
}
