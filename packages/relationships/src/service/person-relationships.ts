import { RequestValidationError } from "@voyant-travel/hono"
import { and, asc, eq, isNull, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { people, personRelationships } from "../schema.js"
import type {
  insertPersonRelationshipSchema,
  personRelationshipListQuerySchema,
  updatePersonRelationshipSchema,
} from "../validation.js"
import { duplicateRelationshipsValueError } from "./duplicate-errors.js"

export type CreatePersonRelationshipInput = z.infer<typeof insertPersonRelationshipSchema>
export type UpdatePersonRelationshipInput = z.infer<typeof updatePersonRelationshipSchema>
export type PersonRelationshipListQuery = z.infer<typeof personRelationshipListQuerySchema>
export type PersonRelationshipKind = CreatePersonRelationshipInput["kind"]

async function personExists(db: PostgresJsDatabase, personId: string) {
  const [row] = await db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1)
  return Boolean(row)
}

function assertValidDateRange(startDate?: string | null, endDate?: string | null) {
  if (startDate && endDate && endDate < startDate) {
    throw new RequestValidationError("endDate must be on or after startDate", {
      fields: { endDate: ["endDate must be on or after startDate"] },
    })
  }
}

export const personRelationshipsService = {
  /**
   * Lists relationships for a person. Default `direction: "both"`
   * returns the union of outgoing and incoming edges — the typical
   * "Jane's family" UI shape. Use `from` / `to` for one-sided lists.
   */
  listPersonRelationships(
    db: PostgresJsDatabase,
    personId: string,
    query?: PersonRelationshipListQuery,
  ) {
    const direction = query?.direction ?? "both"
    const directionFilter =
      direction === "from"
        ? eq(personRelationships.fromPersonId, personId)
        : direction === "to"
          ? eq(personRelationships.toPersonId, personId)
          : or(
              eq(personRelationships.fromPersonId, personId),
              eq(personRelationships.toPersonId, personId),
            )

    const conditions = [directionFilter]
    if (query?.kind) {
      conditions.push(eq(personRelationships.kind, query.kind))
    }

    const limit = query?.limit ?? 50
    const offset = query?.offset ?? 0

    return db
      .select()
      .from(personRelationships)
      .where(and(...conditions))
      .orderBy(asc(personRelationships.createdAt))
      .limit(limit)
      .offset(offset)
  },

  async getPersonRelationship(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(personRelationships)
      .where(eq(personRelationships.id, id))
      .limit(1)
    return row ?? null
  },

  /**
   * Inserts a directed edge `fromPerson → toPerson` of `data.kind`.
   * When `data.inverseKind` is provided AND `data.autoInverse` is
   * not explicitly false, also inserts the symmetric
   * `toPerson → fromPerson` edge with `kind = inverseKind` (and
   * `inverseKind` swapped back). The pair is written in a single
   * transaction so a failed inverse rolls the primary back.
   *
   * The inverse insert is idempotent — if the symmetric edge
   * already exists, the `(from, to, kind)` unique index would
   * normally throw; we suppress that case so retrying a partially
   * applied operation doesn't fail. Any other DB error still
   * propagates.
   */
  async createPersonRelationship(
    db: PostgresJsDatabase,
    fromPersonId: string,
    data: CreatePersonRelationshipInput,
  ) {
    if (fromPersonId === data.toPersonId) return null
    if (!(await personExists(db, fromPersonId))) return null
    if (!(await personExists(db, data.toPersonId))) return null

    const { toPersonId, autoInverse: autoInverseInput, inverseKind, ...rest } = data
    const autoInverse = autoInverseInput !== false

    return db.transaction(async (tx) => {
      const [primary] = await tx
        .insert(personRelationships)
        .values({
          ...rest,
          inverseKind: inverseKind ?? null,
          fromPersonId,
          toPersonId,
        })
        .onConflictDoNothing({
          target: [
            personRelationships.fromPersonId,
            personRelationships.toPersonId,
            personRelationships.kind,
          ],
        })
        .returning()
      if (!primary) {
        throw duplicateRelationshipsValueError({
          code: "duplicate_person_relationship",
          message: "Person relationship already exists",
          resource: "person_relationship",
          fields: [["toPersonId"], ["kind"]],
        })
      }

      if (autoInverse && inverseKind) {
        await tx
          .insert(personRelationships)
          .values({
            fromPersonId: toPersonId,
            toPersonId: fromPersonId,
            kind: inverseKind,
            inverseKind: rest.kind,
            startDate: rest.startDate ?? null,
            endDate: rest.endDate ?? null,
            isPrimary: rest.isPrimary,
            notes: rest.notes ?? null,
            metadata: rest.metadata ?? null,
          })
          .onConflictDoNothing({
            target: [
              personRelationships.fromPersonId,
              personRelationships.toPersonId,
              personRelationships.kind,
            ],
          })

        await tx
          .update(personRelationships)
          .set({ inverseKind: rest.kind, updatedAt: new Date() })
          .where(
            and(
              eq(personRelationships.fromPersonId, toPersonId),
              eq(personRelationships.toPersonId, fromPersonId),
              eq(personRelationships.kind, inverseKind),
              isNull(personRelationships.inverseKind),
            ),
          )
      }

      return primary
    })
  },

  async updatePersonRelationship(
    db: PostgresJsDatabase,
    id: string,
    data: UpdatePersonRelationshipInput,
  ) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(personRelationships)
        .where(eq(personRelationships.id, id))
        .for("update")
        .limit(1)
      if (!existing) return null

      const updatedAt = new Date()
      assertValidDateRange(data.startDate ?? existing.startDate, data.endDate ?? existing.endDate)

      const [row] = await tx
        .update(personRelationships)
        .set({ ...data, updatedAt })
        .where(eq(personRelationships.id, id))
        .returning()

      if (existing.inverseKind) {
        const [inverse] = await tx
          .select()
          .from(personRelationships)
          .where(
            and(
              eq(personRelationships.fromPersonId, existing.toPersonId),
              eq(personRelationships.toPersonId, existing.fromPersonId),
              eq(personRelationships.kind, existing.inverseKind),
              eq(personRelationships.inverseKind, existing.kind),
            ),
          )
          .for("update")
          .limit(1)

        const inverseUpdates = Object.fromEntries(
          Object.entries({
            kind: data.inverseKind ?? undefined,
            inverseKind: data.kind,
            startDate: data.startDate,
            endDate: data.endDate,
            isPrimary: data.isPrimary,
            notes: data.notes,
            metadata: data.metadata,
            updatedAt,
          }).filter(([, value]) => value !== undefined),
        )

        if (inverse && Object.keys(inverseUpdates).length > 1) {
          await tx
            .update(personRelationships)
            .set(inverseUpdates)
            .where(eq(personRelationships.id, inverse.id))
        }
      }

      return row ?? null
    })
  },

  async deletePersonRelationship(db: PostgresJsDatabase, id: string) {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(personRelationships)
        .where(eq(personRelationships.id, id))
        .for("update")
        .limit(1)
      if (!existing) return null

      if (existing.inverseKind) {
        const [inverse] = await tx
          .select({ id: personRelationships.id })
          .from(personRelationships)
          .where(
            and(
              eq(personRelationships.fromPersonId, existing.toPersonId),
              eq(personRelationships.toPersonId, existing.fromPersonId),
              eq(personRelationships.kind, existing.inverseKind),
              eq(personRelationships.inverseKind, existing.kind),
            ),
          )
          .for("update")
          .limit(1)

        if (inverse) {
          await tx.delete(personRelationships).where(eq(personRelationships.id, inverse.id))
        }
      }

      const [row] = await tx
        .delete(personRelationships)
        .where(eq(personRelationships.id, id))
        .returning({ id: personRelationships.id })
      return row ?? null
    })
  },
}
