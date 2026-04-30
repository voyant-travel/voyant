/**
 * Provenance shape carried by every CatalogEntry.
 *
 * Every vertical's CatalogEntry rows include this tuple. It records where the
 * data came from (owned vs sourced), how to call the source back for live
 * resolution and post-book operations, and how the source freshens.
 *
 * See `docs/architecture/catalog-architecture.md` §5.1 for the full design.
 */

import type { SourceFreshness } from "./contract.js"

/**
 * Identifies a source of CatalogEntry data. Open-ended at the type level —
 * deployments declare their source kinds at adapter registration time.
 *
 * Conventions:
 *   - `"owned"`                       — operator's own inventory
 *   - `"voyant-connect"`              — Voyant Connect peer (cloud or self-hosted)
 *   - `"gds:amadeus"` / `"gds:sabre"` / `"gds:travelport"` — GDS providers
 *   - `"direct:tui"` / `"direct:viking"` / `"direct:hilton"` — direct supplier APIs
 *   - `"bedbank:hotelbeds"` / `"bedbank:expedia"` — bedbanks
 *   - `"manual"`                      — manual / CSV import
 */
export type SourceKind = string

/**
 * Provenance tuple recorded on every CatalogEntry. Every field except
 * `source_kind` and `source_freshness` is optional because owned inventory
 * has no upstream connection or external reference.
 */
export interface Provenance {
  /** Source identifier — see {@link SourceKind} conventions. */
  source_kind: SourceKind
  /**
   * Optional sub-identifier for the source provider (e.g. specific Connect peer,
   * specific GDS office id).
   */
  source_provider?: string
  /**
   * FK to the connection / adapter instance that produced this row. For
   * `voyant-connect` sources this points to the connection record; for
   * direct-API sources it points to the local adapter config.
   */
  source_connection_id?: string
  /** Upstream identifier (e.g. Viking sailing code, Hotelbeds property id). */
  source_ref?: string
  /** How the source side of this row's fields refreshes. */
  source_freshness: SourceFreshness
  /** When this row was last refreshed from the source. */
  last_sourced_at?: Date
}

/**
 * Returns true if the provenance describes operator-owned inventory.
 */
export function isOwned(provenance: Provenance): boolean {
  return provenance.source_kind === "owned"
}

/**
 * Returns true if the provenance describes externally-sourced inventory
 * (anything that's not `owned`).
 */
export function isSourced(provenance: Provenance): boolean {
  return provenance.source_kind !== "owned"
}

/**
 * Returns a stable composite identifier for the source connection +
 * external ref, used for deduplication and reverse-lookup queries.
 *
 * Returns `undefined` if either piece is missing — useful for skipping
 * rows that have no upstream identity.
 */
export function sourceCompositeKey(provenance: Provenance): string | undefined {
  const { source_kind, source_connection_id, source_ref } = provenance
  if (!source_connection_id || !source_ref) return undefined
  return `${source_kind}:${source_connection_id}:${source_ref}`
}
