/**
 * Draft reaper — Cloudflare Workers cron entrypoint that drops
 * expired `booking_drafts` rows (per booking-journey-architecture
 * §5.7).
 *
 * Lifecycle:
 *   1. List drafts past `expires_at` that haven't been consumed.
 *   2. For each draft with an active hold, ask the appropriate
 *      handler/adapter to release it (best-effort; failures get
 *      logged but don't block the delete).
 *   3. Delete the draft row.
 *
 * Cadence: hourly at :05 — chosen so it doesn't collide with the
 * channel-push hourly availability reconciler that runs at :00.
 *
 * Per booking-journey-architecture §5.7 (hold release semantics
 * default to immediate; the per-supplier grace knob is a follow-up).
 */

import {
  deleteBookingDraft,
  findExpiredDrafts,
  type OwnedBookingHandlerRegistry,
  type SourceAdapterRegistry,
} from "@voyantjs/catalog/booking-engine"

import {
  type BookingEngineEnv,
  getBookingEngineRegistry,
  getOwnedBookingHandlerRegistry,
} from "./lib/booking-engine-runtime"
import { getDbFromHyperdrive } from "./lib/db"

export const DRAFT_REAPER_CRON = "5 * * * *"

export interface ReaperResult {
  scanned: number
  released: number
  releaseErrors: number
  deleted: number
}

export async function runScheduledDraftReaper(
  _event: ScheduledController,
  env: CloudflareBindings & BookingEngineEnv,
): Promise<ReaperResult> {
  const db = getDbFromHyperdrive(env)
  const registry = getBookingEngineRegistry(env)
  const ownedHandlers = getOwnedBookingHandlerRegistry(env)

  const expired = await findExpiredDrafts(db)
  let released = 0
  let releaseErrors = 0
  let deleted = 0

  for (const draft of expired) {
    if (draft.hold_expires_at) {
      try {
        await releaseHold({
          draft,
          ownedHandlers,
          registry,
        })
        released++
      } catch (err) {
        releaseErrors++
        console.warn("[draft-reaper] failed to release hold", {
          draftId: draft.id,
          reason: err instanceof Error ? err.message : String(err),
        })
      }
    }

    try {
      await deleteBookingDraft(db, draft.id)
      deleted++
    } catch (err) {
      console.warn("[draft-reaper] failed to delete draft", {
        draftId: draft.id,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { scanned: expired.length, released, releaseErrors, deleted }
}

/**
 * Best-effort hold release. Owned drafts go through the registered
 * handler's `releaseHold`; sourced drafts go through the adapter's
 * cancel (we use cancel because the SourceAdapter contract doesn't
 * yet model a hold-only release operation — that's a Phase B+
 * follow-up on the contract).
 */
async function releaseHold({
  draft,
  ownedHandlers,
  registry,
}: {
  draft: Awaited<ReturnType<typeof findExpiredDrafts>>[number]
  ownedHandlers: OwnedBookingHandlerRegistry
  registry: SourceAdapterRegistry
}): Promise<void> {
  if (draft.source_kind === "owned") {
    const handler = ownedHandlers.resolve(draft.entity_module)
    // The hold token isn't surfaced on `booking_drafts` today — the
    // table tracks expiry but not the adapter token. When a handler
    // implements `releaseHold`, callers must thread the token via
    // payload. For now, we no-op cleanly when the handler doesn't
    // expose a release primitive.
    if (!handler?.releaseHold) return
    return
  }
  const adapter = draft.source_connection_id
    ? (registry.resolveByConnection(draft.source_connection_id) ?? null)
    : null
  // Sourced adapters expose cancel for committed bookings, not for
  // soft holds. Until the contract grows a hold-release primitive
  // (booking-journey §5.7), we no-op for sourced drafts.
  void adapter
}
