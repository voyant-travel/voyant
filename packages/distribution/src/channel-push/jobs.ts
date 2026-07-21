import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import { sql } from "drizzle-orm"

import { processAvailabilityPushIntents } from "./availability-push.js"
import { processContentPushIntents } from "./content-push.js"
import { reconcileAvailability, reconcileBookingLinks, reconcileContent } from "./reconciler.js"
import { channelPushRuntimePort } from "./runtime-port.js"
import type { ChannelPushDeps } from "./types.js"

const LEASE_MS = 2 * 60 * 1_000

async function withRuntime(
  context: VoyantGraphRuntimeFactoryContext,
  jobId: string,
  operation: (deps: ChannelPushDeps) => Promise<unknown>,
): Promise<void> {
  const runtime = await context.getPort(channelPushRuntimePort)
  await runtime.withDeps(async (deps) => {
    const owner = crypto.randomUUID()
    const claimed = await deps.db.execute(sql`
      INSERT INTO channel_push_job_leases (job_id, owner, lease_until, updated_at)
      VALUES (${jobId}, ${owner}, now() + (${LEASE_MS} * interval '1 millisecond'), now())
      ON CONFLICT (job_id) DO UPDATE
      SET owner = EXCLUDED.owner, lease_until = EXCLUDED.lease_until, updated_at = now()
      WHERE channel_push_job_leases.lease_until < now()
      RETURNING job_id
    `)
    const rows = Array.isArray(claimed) ? claimed : ((claimed as { rows?: unknown[] }).rows ?? [])
    if (rows.length === 0) return
    let leaseLost = false
    let renewal = Promise.resolve()
    const renew = () => {
      renewal = renewal
        .then(async () => {
          const updated = await deps.db.execute(sql`
          UPDATE channel_push_job_leases
          SET lease_until = now() + (${LEASE_MS} * interval '1 millisecond'), updated_at = now()
          WHERE job_id = ${jobId} AND owner = ${owner}
          RETURNING job_id
        `)
          const rows = Array.isArray(updated)
            ? updated
            : ((updated as { rows?: unknown[] }).rows ?? [])
          if (rows.length === 0) leaseLost = true
        })
        .catch(() => {
          leaseLost = true
        })
    }
    const heartbeat = setInterval(renew, 30_000)
    heartbeat.unref?.()
    try {
      await operation(deps)
      await renewal
      if (leaseLost) throw new Error(`Channel push job lease "${jobId}" was lost.`)
    } finally {
      clearInterval(heartbeat)
      await renewal
      await deps.db.execute(sql`
        DELETE FROM channel_push_job_leases WHERE job_id = ${jobId} AND owner = ${owner}
      `)
    }
  })
}

/** Drain pending durable booking links; booking ids never enter the host invocation. */
export async function runChannelBookingPushJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  await withRuntime(context, "channel.booking.push", (deps) =>
    reconcileBookingLinks({ staleAfterMs: 0, limit: 200 }, deps),
  )
}

export async function runChannelAvailabilityPushJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  await withRuntime(context, "channel.availability.push", (deps) =>
    processAvailabilityPushIntents({}, deps),
  )
}

export async function runChannelContentPushJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  await withRuntime(context, "channel.content.push", (deps) => processContentPushIntents({}, deps))
}

export async function runChannelBookingLinkReconcilerJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  await withRuntime(context, "distribution.channel-push-reconcile-booking-links", (deps) =>
    reconcileBookingLinks({}, deps),
  )
}

export async function runChannelAvailabilityReconcilerJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  await withRuntime(context, "distribution.channel-push-reconcile-availability", (deps) =>
    reconcileAvailability({}, deps),
  )
}

export async function runChannelContentReconcilerJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  await withRuntime(context, "distribution.channel-push-reconcile-content", (deps) =>
    reconcileContent({}, deps),
  )
}
