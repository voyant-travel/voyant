import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import { sql } from "drizzle-orm"

import { promotionReindexJobRuntimePort } from "./reindex-job-runtime-port.js"

function unrefTimer(timer: unknown): void {
  if (typeof timer !== "object" || timer === null || !("unref" in timer)) return
  const { unref } = timer
  if (typeof unref === "function") unref.call(timer)
}

/** Drain the durable catalog-wide reindex checkpoint without invocation input. */
export async function runPromotionReindexJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(promotionReindexJobRuntimePort)
  const leaseOwner = crypto.randomUUID()
  const requestedGeneration = await runtime.withDb(async (db) => {
    const claimed = await db.execute(sql`
      UPDATE promotion_reindex_state
      SET claimed_generation = requested_generation,
          lease_owner = ${leaseOwner},
          lease_until = now() + interval '2 minutes',
          updated_at = now()
      WHERE id = 'all-products'
        AND requested_generation > completed_generation
        AND (lease_until IS NULL OR lease_until < now())
      RETURNING claimed_generation
    `)
    const rows = Array.isArray(claimed)
      ? claimed
      : ((claimed as { rows?: Array<{ claimed_generation?: number }> }).rows ?? [])
    const generation = (rows[0] as { claimed_generation?: number } | undefined)?.claimed_generation
    return generation
  })
  if (requestedGeneration === undefined) return

  let leaseLost = false
  let renewal = Promise.resolve()
  const renew = () => {
    renewal = renewal
      .then(async () => {
        const updated = await runtime.withDb(async (db) =>
          db.execute(sql`
          UPDATE promotion_reindex_state
          SET lease_until = now() + interval '2 minutes', updated_at = now()
          WHERE id = 'all-products' AND lease_owner = ${leaseOwner}
          RETURNING id
        `),
        )
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
  unrefTimer(heartbeat)

  try {
    const service = await runtime.createService()
    const productIds = await service.listAllProductIds()
    for (const productId of productIds) {
      if (leaseLost) throw new Error("Promotion reindex lease was lost before completion.")
      await service.reindexProduct(productId)
    }
    await renewal
    if (leaseLost) throw new Error("Promotion reindex lease was lost before completion.")
    await runtime.withDb(async (db) => {
      const completed = await db.execute(sql`
        UPDATE promotion_reindex_state
        SET completed_generation = ${requestedGeneration}, claimed_generation = NULL,
            lease_owner = NULL, lease_until = NULL, completed_at = now(), updated_at = now()
        WHERE id = 'all-products' AND lease_owner = ${leaseOwner}
        RETURNING id
      `)
      const rows = Array.isArray(completed)
        ? completed
        : ((completed as { rows?: unknown[] }).rows ?? [])
      if (rows.length === 0) throw new Error("Promotion reindex lease was lost before checkpoint.")
    })
  } catch (error) {
    await runtime.withDb(async (db) =>
      db.execute(sql`
        UPDATE promotion_reindex_state
        SET lease_owner = NULL, lease_until = NULL, updated_at = now()
        WHERE id = 'all-products' AND lease_owner = ${leaseOwner}
      `),
    )
    throw error
  } finally {
    clearInterval(heartbeat)
    await renewal
  }
}
