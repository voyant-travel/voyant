// Postgres-backed manifest store. Holds the serialized WorkflowManifest
// pushed at `createApp()` boot via `driver.registerManifest(...)` and read
// by `driver.getManifest(...)` for boot-time mismatch detection and the
// dashboard's filter inspector.
//
// One row is "current" per environment, enforced by the partial unique
// index `voyant_workflow_manifests_current_idx` (migration 0004). History
// is retained — `pruneToVersions(n)` keeps the latest N per environment.
//
// See architecture doc §14 for the manifest lifecycle.

import { and, desc, eq, ne, sql } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/node-postgres"

import { workflowManifestsTable } from "./postgres-schema.js"

type ManifestDb = ReturnType<typeof drizzle>

/**
 * Structural view of `WorkflowManifest` (from `@voyant-travel/workflows/protocol`).
 * Declared locally to avoid pulling the workflows package's protocol export
 * into this store — every consumer satisfies the shape via TypeScript
 * structural compat, same pattern Voyant uses elsewhere.
 */
export interface ManifestEnvelope {
  environment: string
  versionId: string
  manifest: Record<string, unknown>
}

export interface ManifestStore {
  /**
   * Idempotent. Same `(environment, versionId)` returns without re-write.
   * New `versionId` for an existing environment marks the new row
   * `is_current = true` and the previous current `is_current = false`.
   */
  registerManifest(envelope: ManifestEnvelope): Promise<{ versionId: string }>

  /** Returns the current manifest for the environment, or null. */
  getCurrent(environment: string): Promise<ManifestEnvelope | null>

  /** Retain the latest `keep` versions per environment; delete older. */
  pruneToVersions(environment: string, keep: number): Promise<{ deleted: number }>
}

export interface PostgresManifestStoreOptions {
  db: ManifestDb
}

export function createPostgresManifestStore(opts: PostgresManifestStoreOptions): ManifestStore {
  const db = opts.db

  return {
    async registerManifest(envelope) {
      // Atomically: insert new row, flip is_current to false on every other
      // row for this environment, mark this row is_current = true. Single
      // transaction so concurrent registrations don't leave two rows current.
      await db.transaction(async (tx) => {
        await tx
          .insert(workflowManifestsTable)
          .values({
            environment: envelope.environment,
            versionId: envelope.versionId,
            manifest: envelope.manifest,
            isCurrent: true,
          })
          .onConflictDoNothing({
            target: [workflowManifestsTable.environment, workflowManifestsTable.versionId],
          })

        // Demote any existing current row that isn't this versionId.
        await tx
          .update(workflowManifestsTable)
          .set({ isCurrent: false })
          .where(
            and(
              eq(workflowManifestsTable.environment, envelope.environment),
              eq(workflowManifestsTable.isCurrent, true),
              ne(workflowManifestsTable.versionId, envelope.versionId),
            ),
          )

        // Promote the just-registered row in case it already existed
        // (re-register of the same versionId).
        await tx
          .update(workflowManifestsTable)
          .set({ isCurrent: true })
          .where(
            and(
              eq(workflowManifestsTable.environment, envelope.environment),
              eq(workflowManifestsTable.versionId, envelope.versionId),
            ),
          )
      })
      return { versionId: envelope.versionId }
    },

    async getCurrent(environment) {
      const rows = await db
        .select()
        .from(workflowManifestsTable)
        .where(
          and(
            eq(workflowManifestsTable.environment, environment),
            eq(workflowManifestsTable.isCurrent, true),
          ),
        )
        .limit(1)
      const row = rows[0]
      if (!row) return null
      return {
        environment: row.environment,
        versionId: row.versionId,
        manifest: row.manifest,
      }
    },

    async pruneToVersions(environment, keep) {
      if (keep < 1) {
        throw new Error(`pruneToVersions: keep must be >= 1, got ${keep}`)
      }
      // Get the IDs of the latest `keep` rows for this environment, then
      // delete everything else.
      const newest = await db
        .select({ versionId: workflowManifestsTable.versionId })
        .from(workflowManifestsTable)
        .where(eq(workflowManifestsTable.environment, environment))
        .orderBy(desc(workflowManifestsTable.registeredAt))
        .limit(keep)
      const keepIds = newest.map((r) => r.versionId)
      if (keepIds.length === 0) return { deleted: 0 }

      const result = await db.execute(
        // agent-quality: raw-sql reviewed -- owner: workflows-orchestrator-node; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        sql`DELETE FROM ${workflowManifestsTable}
            WHERE environment = ${environment}
            AND version_id NOT IN (${sql.join(
              // agent-quality: raw-sql reviewed -- owner: workflows-orchestrator-node; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
              keepIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
      )
      return { deleted: (result as { rowCount?: number }).rowCount ?? 0 }
    },
  }
}
