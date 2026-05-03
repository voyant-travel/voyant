/**
 * Snapshot content capture per sourced-content §5.1.
 *
 * The booking engine calls a `SnapshotContentCapturer` at commit time
 * to refresh content from the adapter and embed the result in the
 * snapshot's `frozen_payload.content_capture` envelope. The
 * capturer's contract is "refresh-with-fallback":
 *
 *   1. Try to fetch fresh content from the adapter (and write through
 *      to the per-vertical content cache so the next read sees the
 *      fresh row).
 *   2. On adapter error (network blip, rate limit, transient outage),
 *      fall back to the cache — including stale rows.
 *   3. If neither is available, throw `SnapshotContentUnavailableError`.
 *      The booking engine propagates this and aborts the commit. We
 *      deliberately do NOT snapshot from the indexed projection —
 *      refunds and audit need real "what was sold" content, not a
 *      stub.
 *
 * The orchestrator stays in the booking-engine sub-package because the
 * envelope shape, error types, and integration point all live with
 * `bookEntity`. Per-vertical content services (products, cruises,
 * etc.) implement `ContentSnapshotAdapter` and the template wires them
 * into a single capturer via `composeSnapshotContentCapturer`.
 *
 * See `docs/architecture/catalog-sourced-content.md` §5.1.
 */

import type { AnyDrizzleDb } from "@voyantjs/db"

import type {
  GetContentRequest,
  GetContentResult,
  SourceAdapter,
  SourceAdapterContext,
} from "../adapter/contract.js"

import { SnapshotContentUnavailableError } from "./errors.js"
import type { SourceAdapterRegistry } from "./registry.js"

/**
 * Input the booking engine threads into the capturer. Carries the
 * entity identity, the snapshot source pointer, and the locale/market
 * scope from the original quote.
 */
export interface SnapshotContentCaptureInput {
  db: AnyDrizzleDb
  entity_module: string
  entity_id: string
  source_kind: string
  source_connection_id?: string
  source_ref?: string
  locale: string
  market?: string
  currency?: string
  adapterContext: SourceAdapterContext
}

/**
 * The envelope embedded in `frozen_payload.content_capture`. Carries
 * provenance so audit can distinguish a fresh capture from a cache
 * fallback later (refund flows, invoice rendering).
 */
export interface SnapshotContentCapture {
  source: "fresh" | "cache_fallback"
  fetched_at: Date
  fallback_reason?: string
  content_etag?: string
  content_schema_version: string
  content: unknown
}

/**
 * Per-vertical adapter for snapshot capture: refresh + read-cached.
 * Each vertical's content service implements this and the template
 * registers them by `entity_module`. The capturer (built via
 * `composeSnapshotContentCapturer`) routes calls to the right adapter.
 */
export interface ContentSnapshotAdapter {
  /**
   * Refresh content from the upstream adapter and write through to the
   * per-vertical content cache. Returns the fresh `GetContentResult`
   * on success; throws on adapter error (which the orchestrator
   * catches to fall back to cache).
   */
  refresh(
    db: AnyDrizzleDb,
    adapter: SourceAdapter,
    ctx: SourceAdapterContext,
    request: GetContentRequest,
  ): Promise<GetContentResult>
  /**
   * Read the per-vertical cache row for this entity / locale / market,
   * INCLUDING stale rows. Returns null if no row exists. Used as the
   * fallback when `refresh` fails.
   */
  readCached(
    db: AnyDrizzleDb,
    request: GetContentRequest,
  ): Promise<{
    payload: unknown
    content_schema_version: string
    fetched_at: Date
    etag: string | null
  } | null>
}

/**
 * The function the booking engine receives via
 * `BookEntityDeps.captureSnapshotContent`. Templates implement this
 * (typically via `composeSnapshotContentCapturer`) and pass the
 * resulting function in.
 *
 * Returning `null` means "this entity has no sourced content to
 * capture" (e.g. owned entities) — the engine skips the envelope and
 * the snapshot keeps its legacy shape.
 */
export type SnapshotContentCapturer = (
  input: SnapshotContentCaptureInput,
) => Promise<SnapshotContentCapture | null>

/**
 * Compose a `SnapshotContentCapturer` from a registry of per-vertical
 * `ContentSnapshotAdapter`s and an adapter registry. Use when the
 * template wants the §5.1 refresh-with-fallback behavior wired
 * uniformly across verticals.
 *
 * Returns null when:
 *   - The entity_module isn't in the per-vertical adapter map
 *     (assumed owned or out-of-scope; engine skips the envelope).
 *   - The source adapter for `source_kind` doesn't implement
 *     `getContent` AND no cache row exists. (When `getContent` is
 *     missing but a cache row exists, we serve the cache row — the
 *     vertical's synthesizer is for read paths, not write paths.)
 *
 * Throws `SnapshotContentUnavailableError` when neither fresh nor
 * cached content can be produced.
 */
export function composeSnapshotContentCapturer(options: {
  registry: SourceAdapterRegistry
  /** Per-vertical adapters keyed by `entity_module`. */
  contentAdapters: ReadonlyMap<string, ContentSnapshotAdapter>
}): SnapshotContentCapturer {
  return async function captureSnapshotContent(
    input: SnapshotContentCaptureInput,
  ): Promise<SnapshotContentCapture | null> {
    const verticalAdapter = options.contentAdapters.get(input.entity_module)
    if (!verticalAdapter) {
      // No content service for this vertical → owned or out-of-scope.
      return null
    }
    const sourceAdapter = input.source_connection_id
      ? (options.registry.resolveByConnection(input.source_connection_id) ??
        options.registry.byKind(input.source_kind)[0]?.adapter)
      : options.registry.byKind(input.source_kind)[0]?.adapter
    if (!sourceAdapter) {
      // No source adapter registered. Try cache fallback first; if
      // even that fails, signal unavailable so the engine can abort.
      return readCachedOrThrow(verticalAdapter, input, "no source adapter registered")
    }

    const request: GetContentRequest = {
      entity_module: input.entity_module,
      entity_id: input.entity_id,
      locale: input.locale,
      market: input.market,
      currency: input.currency,
    }

    if (sourceAdapter.getContent) {
      try {
        const fresh = await verticalAdapter.refresh(
          input.db,
          sourceAdapter,
          input.adapterContext,
          request,
        )
        return {
          source: "fresh",
          fetched_at: new Date(),
          content_etag: fresh.etag,
          content_schema_version: fresh.content_schema_version,
          content: fresh.content,
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        return readCachedOrThrow(verticalAdapter, input, reason)
      }
    }

    // Adapter is thin (no getContent). Cache-or-throw — synthesizer
    // is read-time only, not snapshot-time.
    return readCachedOrThrow(verticalAdapter, input, "adapter does not implement getContent")
  }
}

async function readCachedOrThrow(
  verticalAdapter: ContentSnapshotAdapter,
  input: SnapshotContentCaptureInput,
  fallbackReason: string,
): Promise<SnapshotContentCapture> {
  const request: GetContentRequest = {
    entity_module: input.entity_module,
    entity_id: input.entity_id,
    locale: input.locale,
    market: input.market,
    currency: input.currency,
  }
  const cached = await verticalAdapter.readCached(input.db, request)
  if (!cached) {
    throw new SnapshotContentUnavailableError(input.entity_module, input.entity_id, fallbackReason)
  }
  return {
    source: "cache_fallback",
    fetched_at: cached.fetched_at,
    fallback_reason: fallbackReason,
    content_etag: cached.etag ?? undefined,
    content_schema_version: cached.content_schema_version,
    content: cached.payload,
  }
}
