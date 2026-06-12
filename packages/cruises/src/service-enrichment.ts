import { asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { CruiseEnrichmentProgram } from "./schema-content.js"
import { cruiseEnrichmentPrograms } from "./schema-content.js"
import { setUpdated } from "./service-shared.js"
import type {
  InsertEnrichmentProgram,
  ReplaceEnrichmentPrograms,
  UpdateEnrichmentProgram,
} from "./validation-content.js"

export const cruiseEnrichmentService = {
  async listEnrichmentPrograms(
    db: PostgresJsDatabase,
    cruiseId: string,
  ): Promise<CruiseEnrichmentProgram[]> {
    return db
      .select()
      .from(cruiseEnrichmentPrograms)
      .where(eq(cruiseEnrichmentPrograms.cruiseId, cruiseId))
      .orderBy(asc(cruiseEnrichmentPrograms.sortOrder), asc(cruiseEnrichmentPrograms.name))
  },

  async createEnrichmentProgram(
    db: PostgresJsDatabase,
    data: InsertEnrichmentProgram,
  ): Promise<CruiseEnrichmentProgram> {
    const [row] = await db.insert(cruiseEnrichmentPrograms).values(data).returning()
    if (!row) throw new Error("Failed to create enrichment program")
    return row
  },

  async updateEnrichmentProgram(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateEnrichmentProgram,
  ): Promise<CruiseEnrichmentProgram | null> {
    const [row] = await db
      .update(cruiseEnrichmentPrograms)
      .set({ ...data, ...setUpdated })
      .where(eq(cruiseEnrichmentPrograms.id, id))
      .returning()
    return row ?? null
  },

  async deleteEnrichmentProgram(db: PostgresJsDatabase, id: string): Promise<boolean> {
    const result = await db
      .delete(cruiseEnrichmentPrograms)
      .where(eq(cruiseEnrichmentPrograms.id, id))
      .returning({ id: cruiseEnrichmentPrograms.id })
    return result.length > 0
  },

  async replaceEnrichmentPrograms(
    db: PostgresJsDatabase,
    payload: ReplaceEnrichmentPrograms,
  ): Promise<CruiseEnrichmentProgram[]> {
    return db.transaction(async (tx) => {
      await tx
        .delete(cruiseEnrichmentPrograms)
        .where(eq(cruiseEnrichmentPrograms.cruiseId, payload.cruiseId))
      if (payload.programs.length === 0) return []
      const inserted = await tx
        .insert(cruiseEnrichmentPrograms)
        .values(payload.programs.map((p) => ({ ...p, cruiseId: payload.cruiseId })))
        .returning()
      return inserted
    })
  },
}
