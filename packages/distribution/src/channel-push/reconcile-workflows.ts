import { type WorkflowContext, workflow } from "@voyant-travel/workflows"

import { reconcileAvailability, reconcileBookingLinks, reconcileContent } from "./reconciler.js"
import type { ChannelPushDeps } from "./types.js"

export const CHANNEL_PUSH_RECONCILE_WORKFLOW_RUNTIME_KEY =
  "distribution.workflows.channel-push.reconcile-runtime" as const

export interface ChannelPushReconcileWorkflowRuntime {
  withDeps<T>(operation: (deps: ChannelPushDeps) => Promise<T>): Promise<T>
}

function resolveRuntime(ctx: WorkflowContext) {
  return ctx.services.resolve<ChannelPushReconcileWorkflowRuntime>(
    CHANNEL_PUSH_RECONCILE_WORKFLOW_RUNTIME_KEY,
  )
}

export const channelPushBookingLinkReconcileWorkflow = workflow({
  id: "distribution.channel-push-reconcile-booking-links",
  async run(_input, ctx) {
    return ctx.step("reconcile-booking-links", () =>
      resolveRuntime(ctx).withDeps((deps) => reconcileBookingLinks({}, deps)),
    )
  },
})

export const channelPushAvailabilityReconcileWorkflow = workflow({
  id: "distribution.channel-push-reconcile-availability",
  async run(_input, ctx) {
    return ctx.step("reconcile-availability", () =>
      resolveRuntime(ctx).withDeps((deps) => reconcileAvailability({}, deps)),
    )
  },
})

export const channelPushContentReconcileWorkflow = workflow({
  id: "distribution.channel-push-reconcile-content",
  async run(_input, ctx) {
    return ctx.step("reconcile-content", () =>
      resolveRuntime(ctx).withDeps((deps) => reconcileContent({}, deps)),
    )
  },
})
