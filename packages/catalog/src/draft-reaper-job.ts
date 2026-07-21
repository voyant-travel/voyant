import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"

import {
  deleteBookingDraft,
  findExpiredDrafts,
  type OwnedBookingHandlerRegistry,
  type SourceAdapterRegistry,
} from "./booking-engine/index.js"
import {
  type CatalogDraftReaperJobRuntime,
  catalogDraftReaperJobRuntimePort,
} from "./draft-reaper-job-runtime-port.js"

export {
  type CatalogDraftReaperJobRuntime,
  catalogDraftReaperJobRuntimePort,
} from "./draft-reaper-job-runtime-port.js"

export interface DraftReaperResult {
  scanned: number
  released: number
  releaseErrors: number
  deleted: number
  inGrace: number
}

export async function runCatalogDraftReaperJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  await runCatalogDraftReaper(await context.getPort(catalogDraftReaperJobRuntimePort))
}

export async function runCatalogDraftReaper(
  runtime: CatalogDraftReaperJobRuntime,
): Promise<DraftReaperResult> {
  const [registry, ownedHandlers] = await Promise.all([
    runtime.resolveSourceRegistry(),
    runtime.resolveOwnedHandlers(),
  ])
  return runtime.withDb(async (db) => {
    const expired = await findExpiredDrafts(db)
    let released = 0
    let releaseErrors = 0
    let deleted = 0
    let inGrace = 0
    const now = runtime.now?.() ?? Date.now()

    for (const draft of expired) {
      const grace = resolveGraceMs(draft, ownedHandlers, registry)
      if (grace > 0 && now < new Date(draft.expires_at).getTime() + grace) {
        inGrace++
        continue
      }
      if (draft.hold_expires_at) {
        try {
          await releaseHold(db, draft, ownedHandlers, registry)
          released++
        } catch (error) {
          releaseErrors++
          runtime.reportFailure(error, { draftId: draft.id, op: "release-hold" })
        }
      }
      try {
        await deleteBookingDraft(db, draft.id)
        deleted++
      } catch (error) {
        runtime.reportFailure(error, { draftId: draft.id, op: "delete-draft" })
      }
    }
    return { scanned: expired.length, released, releaseErrors, deleted, inGrace }
  })
}

type ExpiredDraft = Awaited<ReturnType<typeof findExpiredDrafts>>[number]

function resolveGraceMs(
  draft: ExpiredDraft,
  ownedHandlers: OwnedBookingHandlerRegistry,
  registry: SourceAdapterRegistry,
): number {
  if (draft.source_kind === "owned") {
    return ownedHandlers.resolve(draft.entity_module)?.holdReleaseGraceMs ?? 0
  }
  return draft.source_connection_id
    ? (registry.resolveByConnection(draft.source_connection_id)?.capabilities.holdReleaseGraceMs ??
        0)
    : 0
}

async function releaseHold(
  db: AnyDrizzleDb,
  draft: ExpiredDraft,
  ownedHandlers: OwnedBookingHandlerRegistry,
  registry: SourceAdapterRegistry,
): Promise<void> {
  if (draft.source_kind === "owned") {
    await ownedHandlers
      .resolve(draft.entity_module)
      ?.releaseHold?.({ db, adapterContext: { connection_id: "reaper" } }, draft.id)
    return
  }
  if (draft.source_connection_id) void registry.resolveByConnection(draft.source_connection_id)
}
