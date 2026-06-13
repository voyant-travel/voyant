import { and, asc, eq, isNull, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { productContactRequirements } from "./schema.js"
import type { PublicTransportRequirementsQuery } from "./service-shared.js"

const transportFieldKeys = [
  "date_of_birth",
  "nationality",
  "passport_number",
  "passport_expiry",
] as const

type TransportFieldKey = (typeof transportFieldKeys)[number]
type RequirementRow = typeof productContactRequirements.$inferSelect

export interface BookingRequirementsProductSnapshot {
  id: string
  bookingMode?: string | null
  capabilities?: readonly string[]
}

export type ResolveBookingRequirementsProductSnapshot = (
  db: PostgresJsDatabase,
  productId: string,
) => Promise<BookingRequirementsProductSnapshot | null>

function uniqueSorted<T extends string>(values: Iterable<T>) {
  return Array.from(new Set(values)).sort()
}

function summarizeFields(
  rows: RequirementRow[],
  scope: RequirementRow["scope"],
): TransportFieldKey[] {
  return uniqueSorted(
    rows.filter((row) => row.scope === scope).map((row) => row.fieldKey as TransportFieldKey),
  )
}

export async function getPublicTransportRequirements(
  db: PostgresJsDatabase,
  productId: string,
  query: PublicTransportRequirementsQuery,
  resolveProductSnapshot?: ResolveBookingRequirementsProductSnapshot,
) {
  const defaultProductSnapshot: BookingRequirementsProductSnapshot = { id: productId }
  const [product, requirementRows] = await Promise.all([
    resolveProductSnapshot ? resolveProductSnapshot(db, productId) : defaultProductSnapshot,
    db
      .select()
      .from(productContactRequirements)
      .where(
        and(
          eq(productContactRequirements.productId, productId),
          eq(productContactRequirements.active, true),
          query.optionId
            ? or(
                eq(productContactRequirements.optionId, query.optionId),
                isNull(productContactRequirements.optionId),
              )
            : isNull(productContactRequirements.optionId),
        ),
      )
      .orderBy(
        asc(productContactRequirements.sortOrder),
        asc(productContactRequirements.createdAt),
      ),
  ])

  if (!product) {
    return null
  }

  const relevantRows = requirementRows.filter((row) =>
    transportFieldKeys.includes(row.fieldKey as TransportFieldKey),
  )
  const requiredRows = relevantRows.filter((row) => row.isRequired)
  const capabilitySet = new Set(product.capabilities ?? [])

  return {
    productId,
    optionId: query.optionId ?? null,
    hasTransport: product.bookingMode === "transfer" || capabilitySet.has("transport"),
    requiresPassengerDocuments: requiredRows.length > 0,
    requiresPassport: requiredRows.some(
      (row) => row.fieldKey === "passport_number" || row.fieldKey === "passport_expiry",
    ),
    requiresNationality: requiredRows.some((row) => row.fieldKey === "nationality"),
    requiresDateOfBirth: requiredRows.some((row) => row.fieldKey === "date_of_birth"),
    requiredFields: uniqueSorted(requiredRows.map((row) => row.fieldKey as TransportFieldKey)),
    fieldsByScope: {
      booking: summarizeFields(relevantRows, "booking"),
      lead_traveler: summarizeFields(relevantRows, "lead_traveler"),
      traveler: summarizeFields(relevantRows, "traveler"),
      booker: summarizeFields(relevantRows, "booker"),
    },
    requirements: relevantRows.map((row) => ({
      fieldKey: row.fieldKey as TransportFieldKey,
      scope: row.scope,
      isRequired: row.isRequired,
      perTraveler: row.perTraveler,
      notes: row.notes ?? null,
    })),
  }
}
