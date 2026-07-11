/**
 * Durable channel-push workflows.
 *
 * Wraps the inline-callable processors (`processBookingPush`,
 * `processAvailabilityPushIntents`, `processContentPushIntents`) in
 * `@voyant-travel/workflows` definitions so retries, sleeps, and resumption
 * survive worker restarts. Importing this module registers the
 * workflows in the global registry — Voyant Cloud orchestrator picks
 * them up automatically.
 *
 * The workflow bodies look up `ChannelPushDeps` from the process-local
 * holder set via `setChannelPushDeps`. Detached bundles wire deps from
 * their `bootstrapWorkflowBundle` export before the runner executes a
 * workflow step.
 *
 * Dev / single-process deployments (e.g. the operator starter's
 * inline drain) don't need to register these — the subscriber calls the
 * processors directly. Production deployments with the Voyant Cloud
 * orchestrator wired import this module to opt into durability.
 *
 * Per docs/architecture/channel-push-architecture.md §4.2 + §12.
 */

import { type ScheduleDeclaration, workflow } from "@voyant-travel/workflows"

import {
  CHANNEL_AVAILABILITY_PUSH_WORKFLOW_ID,
  type ProcessAvailabilityPushInput,
  type ProcessAvailabilityPushResult,
  processAvailabilityPushIntents,
} from "./availability-push.js"
import {
  CHANNEL_BOOKING_PUSH_WORKFLOW_ID,
  type ProcessBookingPushInput,
  type ProcessBookingPushResult,
  processBookingPush,
} from "./booking-push.js"
import {
  CHANNEL_CONTENT_PUSH_WORKFLOW_ID,
  type ProcessContentPushInput,
  type ProcessContentPushResult,
  processContentPushIntents,
} from "./content-push.js"
import { CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY, type ChannelPushDeps } from "./types.js"

const CHANNEL_PUSH_SCHEDULES_ENABLED_ENV = "VOYANT_DISTRIBUTION_CHANNEL_PUSH_ENABLED" as const

function channelPushSchedulesEnabled(): boolean {
  return (
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
      CHANNEL_PUSH_SCHEDULES_ENABLED_ENV
    ] === "true"
  )
}

function channelPushSchedule(schedule: ScheduleDeclaration): ScheduleDeclaration | undefined {
  return channelPushSchedulesEnabled() ? schedule : undefined
}

/**
 * Per-booking saga workflow with compensation support.
 *
 * Concurrency is keyed by `bookingId` so two confirms of the same
 * booking serialize (which can't actually happen given the booking
 * state machine, but the perKey lock is cheap insurance). Retries on
 * exponential backoff up to 5 attempts; the per-link compensation pass
 * inside `processBookingPush` handles strict-atomic policy when
 * `channel_contracts.policy.compensation = "strict-atomic"`.
 *
 * Per §4.2 + §12.1.
 */
export const channelBookingPushWorkflow = workflow<
  ProcessBookingPushInput,
  ProcessBookingPushResult
>({
  id: CHANNEL_BOOKING_PUSH_WORKFLOW_ID,
  description: "Drain pending channel_booking_links and push to upstream channels",
  retry: { backoff: "exponential", max: 5, initial: "5s", maxDelay: "5m" },
  timeout: "1h",
  concurrency: {
    key: (input) => input.bookingId,
    limit: 1,
    strategy: "queue",
  },
  tags: ["channel-push", "booking"],
  async run(input, ctx) {
    const deps = ctx.services.resolve<ChannelPushDeps>(CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY)
    return await ctx.step("process-booking-push", () => processBookingPush(input, deps))
  },
})

/**
 * Scheduled batch worker for availability push. Runs every 30 seconds
 * (tunable per channel via policy in a future iteration); each tick
 * drains up to 100 pending intents, capped at one concurrent run per
 * channel. Idempotency is upstream-side via `(slot_id, remaining_pax)`.
 *
 * Per §5.3 + §12.2.
 */
export const channelAvailabilityPushWorkflow = workflow<
  ProcessAvailabilityPushInput | null,
  ProcessAvailabilityPushResult
>({
  id: CHANNEL_AVAILABILITY_PUSH_WORKFLOW_ID,
  description: "Drain channel_availability_push_intents per channel",
  schedule: channelPushSchedule({ every: "30s" }),
  retry: { backoff: "exponential", max: 3, initial: "10s" },
  timeout: "5m",
  concurrency: {
    key: (input) => input?.channelId ?? "all",
    limit: 1,
    strategy: "queue",
  },
  tags: ["channel-push", "availability"],
  async run(input, ctx) {
    const deps = ctx.services.resolve<ChannelPushDeps>(CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY)
    return await ctx.step("process-availability-push", () =>
      processAvailabilityPushIntents(input, deps),
    )
  },
})

/**
 * Scheduled batch worker for content push. Longer cadence (5m) since
 * content drift is rarely time-critical; idempotency via the upstream's
 * acknowledged-hash skip in `processContentPushIntents`.
 *
 * Per §6 + §12.3.
 */
export const channelContentPushWorkflow = workflow<
  ProcessContentPushInput | null,
  ProcessContentPushResult
>({
  id: CHANNEL_CONTENT_PUSH_WORKFLOW_ID,
  description: "Drain channel_content_push_intents per channel",
  schedule: channelPushSchedule({ every: "5m" }),
  retry: { backoff: "exponential", max: 3, initial: "30s" },
  timeout: "5m",
  concurrency: {
    key: (input) => input?.channelId ?? "all",
    limit: 1,
    strategy: "queue",
  },
  tags: ["channel-push", "content"],
  async run(input, ctx) {
    const deps = ctx.services.resolve<ChannelPushDeps>(CHANNEL_PUSH_WORKFLOW_RUNTIME_KEY)
    return await ctx.step("process-content-push", () => processContentPushIntents(input, deps))
  },
})
