import type { AnyDrizzleDb } from "@voyant-travel/db"
import { workflow } from "@voyant-travel/workflows"

import {
  deleteBookingDraft,
  findExpiredDrafts,
  type OwnedBookingHandlerRegistry,
  type SourceAdapterRegistry,
} from "./booking-engine/index.js"

export const CATALOG_DRAFT_REAPER_RUNTIME_KEY = "catalog.workflows.draft-reaper.runtime" as const

export interface CatalogDraftReaperRuntime {
  withDb<T>(operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T>
  resolveSourceRegistry(): SourceAdapterRegistry | Promise<SourceAdapterRegistry>
  resolveOwnedHandlers(): OwnedBookingHandlerRegistry | Promise<OwnedBookingHandlerRegistry>
  reportFailure(error: unknown, context: { draftId: string; op: string }): void
  now?(): number
}

export interface CatalogDraftReaperRuntimeOptions extends Omit<CatalogDraftReaperRuntime, "now"> {
  now?: () => number
}

/** Build the package-owned draft reaper runtime from deployment host capabilities. */
export function createCatalogDraftReaperRuntime(
  options: CatalogDraftReaperRuntimeOptions,
): CatalogDraftReaperRuntime {
  return options
}

export interface DraftReaperResult {
  scanned: number
  released: number
  releaseErrors: number
  deleted: number
  inGrace: number
}

export const catalogDraftReaperWorkflow = workflow<Record<string, never>, DraftReaperResult>({
  id: "catalog.reap-expired-booking-drafts",
  defaultRuntime: "node",
  schedule: { cron: "5 * * * *", name: "hourly-at-05" },
  async run(_input, context) {
    return runCatalogDraftReaper(
      context.services.resolve<CatalogDraftReaperRuntime>(CATALOG_DRAFT_REAPER_RUNTIME_KEY),
    )
  },
})

export async function runCatalogDraftReaper(
  runtime: CatalogDraftReaperRuntime,
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
