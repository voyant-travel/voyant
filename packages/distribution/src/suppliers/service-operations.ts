import { and, asc, desc, eq, exists, gte, lte, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  supplierAvailability,
  supplierContracts,
  supplierNotes,
  supplierRates,
  supplierServices,
} from "./schema.js"
import type {
  AvailabilityQuery,
  CreateAvailabilityInput,
  CreateContractInput,
  CreateRateInput,
  CreateServiceInput,
  CreateSupplierNoteInput,
  UpdateContractInput,
  UpdateRateInput,
  UpdateServiceInput,
} from "./service-shared.js"
import { ensureSupplierExists } from "./service-shared.js"

export function listServices(db: PostgresJsDatabase, supplierId: string) {
  return db
    .select()
    .from(supplierServices)
    .where(eq(supplierServices.supplierId, supplierId))
    .orderBy(supplierServices.createdAt)
}

export async function createService(
  db: PostgresJsDatabase,
  supplierId: string,
  data: CreateServiceInput,
) {
  const supplier = await ensureSupplierExists(db, supplierId)
  if (!supplier) {
    return null
  }

  const [row] = await db
    .insert(supplierServices)
    .values({ ...data, supplierId })
    .returning()
  return row ?? null
}

export async function updateService(
  db: PostgresJsDatabase,
  serviceId: string,
  data: UpdateServiceInput,
): Promise<typeof supplierServices.$inferSelect | null>
export async function updateService(
  db: PostgresJsDatabase,
  supplierId: string,
  serviceId: string,
  data: UpdateServiceInput,
): Promise<typeof supplierServices.$inferSelect | null>
export async function updateService(
  db: PostgresJsDatabase,
  supplierOrServiceId: string,
  serviceOrData: string | UpdateServiceInput,
  maybeData?: UpdateServiceInput,
) {
  const supplierId = typeof serviceOrData === "string" ? supplierOrServiceId : null
  const serviceId = typeof serviceOrData === "string" ? serviceOrData : supplierOrServiceId
  const data = typeof serviceOrData === "string" ? maybeData : serviceOrData
  if (!data) throw new Error("updateService requires update data")

  const [row] = await db
    .update(supplierServices)
    .set({ ...data, updatedAt: new Date() })
    .where(
      supplierId
        ? and(eq(supplierServices.id, serviceId), eq(supplierServices.supplierId, supplierId))
        : eq(supplierServices.id, serviceId),
    )
    .returning()
  return row ?? null
}

export async function deleteService(
  db: PostgresJsDatabase,
  serviceId: string,
): Promise<{ id: string } | null>
export async function deleteService(
  db: PostgresJsDatabase,
  supplierId: string,
  serviceId: string,
): Promise<{ id: string } | null>
export async function deleteService(
  db: PostgresJsDatabase,
  supplierOrServiceId: string,
  maybeServiceId?: string,
) {
  const supplierId = maybeServiceId ? supplierOrServiceId : null
  const serviceId = maybeServiceId ?? supplierOrServiceId

  const [row] = await db
    .delete(supplierServices)
    .where(
      supplierId
        ? and(eq(supplierServices.id, serviceId), eq(supplierServices.supplierId, supplierId))
        : eq(supplierServices.id, serviceId),
    )
    .returning({ id: supplierServices.id })
  return row ?? null
}

function serviceBelongsToSupplier(db: PostgresJsDatabase, supplierId: string, serviceId: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(supplierServices)
      .where(and(eq(supplierServices.id, serviceId), eq(supplierServices.supplierId, supplierId))),
  )
}

export function listRates(
  db: PostgresJsDatabase,
  supplierOrServiceId: string,
  maybeServiceId?: string,
) {
  const supplierId = maybeServiceId ? supplierOrServiceId : null
  const serviceId = maybeServiceId ?? supplierOrServiceId

  return db
    .select()
    .from(supplierRates)
    .where(
      supplierId
        ? and(
            eq(supplierRates.serviceId, serviceId),
            serviceBelongsToSupplier(db, supplierId, serviceId),
          )
        : eq(supplierRates.serviceId, serviceId),
    )
    .orderBy(supplierRates.createdAt)
}

export async function createRate(
  db: PostgresJsDatabase,
  serviceId: string,
  data: CreateRateInput,
): Promise<typeof supplierRates.$inferSelect | null>
export async function createRate(
  db: PostgresJsDatabase,
  supplierId: string,
  serviceId: string,
  data: CreateRateInput,
): Promise<typeof supplierRates.$inferSelect | null>
export async function createRate(
  db: PostgresJsDatabase,
  supplierOrServiceId: string,
  serviceOrData: string | CreateRateInput,
  maybeData?: CreateRateInput,
) {
  const supplierId = typeof serviceOrData === "string" ? supplierOrServiceId : null
  const serviceId = typeof serviceOrData === "string" ? serviceOrData : supplierOrServiceId
  const data = typeof serviceOrData === "string" ? maybeData : serviceOrData
  if (!data) throw new Error("createRate requires create data")

  const [service] = await db
    .select({ id: supplierServices.id })
    .from(supplierServices)
    .where(
      supplierId
        ? and(eq(supplierServices.id, serviceId), eq(supplierServices.supplierId, supplierId))
        : eq(supplierServices.id, serviceId),
    )
    .limit(1)
  if (!service) {
    return null
  }

  const [row] = await db
    .insert(supplierRates)
    .values({ ...data, serviceId })
    .returning()
  return row ?? null
}

export async function updateRate(
  db: PostgresJsDatabase,
  rateId: string,
  data: UpdateRateInput,
): Promise<typeof supplierRates.$inferSelect | null>
export async function updateRate(
  db: PostgresJsDatabase,
  supplierId: string,
  serviceId: string,
  rateId: string,
  data: UpdateRateInput,
): Promise<typeof supplierRates.$inferSelect | null>
export async function updateRate(
  db: PostgresJsDatabase,
  supplierOrRateId: string,
  serviceOrData: string | UpdateRateInput,
  rateId?: string,
  maybeData?: UpdateRateInput,
) {
  const supplierId = typeof serviceOrData === "string" ? supplierOrRateId : null
  const serviceId = typeof serviceOrData === "string" ? serviceOrData : null
  const resolvedRateId = typeof serviceOrData === "string" ? rateId : supplierOrRateId
  const data = typeof serviceOrData === "string" ? maybeData : serviceOrData
  if (!resolvedRateId || !data) throw new Error("updateRate requires rate id and update data")

  const [row] = await db
    .update(supplierRates)
    .set(data)
    .where(
      supplierId && serviceId
        ? and(
            eq(supplierRates.id, resolvedRateId),
            eq(supplierRates.serviceId, serviceId),
            serviceBelongsToSupplier(db, supplierId, serviceId),
          )
        : eq(supplierRates.id, resolvedRateId),
    )
    .returning()
  return row ?? null
}

export async function deleteRate(
  db: PostgresJsDatabase,
  rateId: string,
): Promise<{ id: string } | null>
export async function deleteRate(
  db: PostgresJsDatabase,
  supplierId: string,
  serviceId: string,
  rateId: string,
): Promise<{ id: string } | null>
export async function deleteRate(
  db: PostgresJsDatabase,
  supplierOrRateId: string,
  maybeServiceId?: string,
  maybeRateId?: string,
) {
  const supplierId = maybeRateId ? supplierOrRateId : null
  const serviceId = maybeRateId ? maybeServiceId : null
  const rateId = maybeRateId ?? supplierOrRateId

  const [row] = await db
    .delete(supplierRates)
    .where(
      supplierId && serviceId
        ? and(
            eq(supplierRates.id, rateId),
            eq(supplierRates.serviceId, serviceId),
            serviceBelongsToSupplier(db, supplierId, serviceId),
          )
        : eq(supplierRates.id, rateId),
    )
    .returning({ id: supplierRates.id })
  return row ?? null
}

export function listNotes(db: PostgresJsDatabase, supplierId: string) {
  return db
    .select()
    .from(supplierNotes)
    .where(eq(supplierNotes.supplierId, supplierId))
    .orderBy(supplierNotes.createdAt)
}

export async function createNote(
  db: PostgresJsDatabase,
  supplierId: string,
  userId: string,
  data: CreateSupplierNoteInput,
) {
  const supplier = await ensureSupplierExists(db, supplierId)
  if (!supplier) {
    return null
  }

  const [row] = await db
    .insert(supplierNotes)
    .values({
      supplierId,
      authorId: userId,
      content: data.content,
    })
    .returning()
  return row ?? null
}

export async function listAvailability(
  db: PostgresJsDatabase,
  supplierId: string,
  query: AvailabilityQuery,
) {
  const conditions = [eq(supplierAvailability.supplierId, supplierId)]

  if (query.from) {
    conditions.push(gte(supplierAvailability.date, query.from))
  }
  if (query.to) {
    conditions.push(lte(supplierAvailability.date, query.to))
  }

  return db
    .select()
    .from(supplierAvailability)
    .where(and(...conditions))
    .orderBy(asc(supplierAvailability.date))
}

export async function createAvailability(
  db: PostgresJsDatabase,
  supplierId: string,
  entries: CreateAvailabilityInput[],
) {
  const supplier = await ensureSupplierExists(db, supplierId)
  if (!supplier) {
    return null
  }

  if (entries.length === 0) {
    return []
  }

  const latestEntriesByDate = new Map<string, CreateAvailabilityInput>()
  for (const entry of entries) {
    latestEntriesByDate.set(entry.date, entry)
  }

  return db
    .insert(supplierAvailability)
    .values(
      [...latestEntriesByDate.values()].map((entry) => ({
        supplierId,
        date: entry.date,
        available: entry.available,
        notes: entry.notes ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: [supplierAvailability.supplierId, supplierAvailability.date],
      set: {
        available: sql`excluded.available`,
        notes: sql`excluded.notes`,
      },
    })
    .returning()
}

export function listContracts(db: PostgresJsDatabase, supplierId: string) {
  return db
    .select()
    .from(supplierContracts)
    .where(eq(supplierContracts.supplierId, supplierId))
    .orderBy(desc(supplierContracts.createdAt))
}

export async function createContract(
  db: PostgresJsDatabase,
  supplierId: string,
  data: CreateContractInput,
) {
  const supplier = await ensureSupplierExists(db, supplierId)
  if (!supplier) {
    return null
  }

  const [row] = await db
    .insert(supplierContracts)
    .values({ ...data, supplierId })
    .returning()
  return row ?? null
}

export async function updateContract(
  db: PostgresJsDatabase,
  contractId: string,
  data: UpdateContractInput,
): Promise<typeof supplierContracts.$inferSelect | null>
export async function updateContract(
  db: PostgresJsDatabase,
  supplierId: string,
  contractId: string,
  data: UpdateContractInput,
): Promise<typeof supplierContracts.$inferSelect | null>
export async function updateContract(
  db: PostgresJsDatabase,
  supplierOrContractId: string,
  contractOrData: string | UpdateContractInput,
  maybeData?: UpdateContractInput,
) {
  const supplierId = typeof contractOrData === "string" ? supplierOrContractId : null
  const contractId = typeof contractOrData === "string" ? contractOrData : supplierOrContractId
  const data = typeof contractOrData === "string" ? maybeData : contractOrData
  if (!data) throw new Error("updateContract requires update data")

  const [row] = await db
    .update(supplierContracts)
    .set({ ...data, updatedAt: new Date() })
    .where(
      supplierId
        ? and(eq(supplierContracts.id, contractId), eq(supplierContracts.supplierId, supplierId))
        : eq(supplierContracts.id, contractId),
    )
    .returning()
  return row ?? null
}

export async function deleteContract(
  db: PostgresJsDatabase,
  contractId: string,
): Promise<{ id: string } | null>
export async function deleteContract(
  db: PostgresJsDatabase,
  supplierId: string,
  contractId: string,
): Promise<{ id: string } | null>
export async function deleteContract(
  db: PostgresJsDatabase,
  supplierOrContractId: string,
  maybeContractId?: string,
) {
  const supplierId = maybeContractId ? supplierOrContractId : null
  const contractId = maybeContractId ?? supplierOrContractId

  const [row] = await db
    .delete(supplierContracts)
    .where(
      supplierId
        ? and(eq(supplierContracts.id, contractId), eq(supplierContracts.supplierId, supplierId))
        : eq(supplierContracts.id, contractId),
    )
    .returning({ id: supplierContracts.id })
  return row ?? null
}
