import { and, asc, desc, eq, gte, lte } from "drizzle-orm"
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
) {
  const [row] = await db
    .update(supplierServices)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(supplierServices.id, serviceId))
    .returning()
  return row ?? null
}

export async function deleteService(db: PostgresJsDatabase, serviceId: string) {
  const [row] = await db
    .delete(supplierServices)
    .where(eq(supplierServices.id, serviceId))
    .returning({ id: supplierServices.id })
  return row ?? null
}

export function listRates(db: PostgresJsDatabase, serviceId: string) {
  return db
    .select()
    .from(supplierRates)
    .where(eq(supplierRates.serviceId, serviceId))
    .orderBy(supplierRates.createdAt)
}

export async function createRate(db: PostgresJsDatabase, serviceId: string, data: CreateRateInput) {
  const [service] = await db
    .select({ id: supplierServices.id })
    .from(supplierServices)
    .where(eq(supplierServices.id, serviceId))
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

export async function updateRate(db: PostgresJsDatabase, rateId: string, data: UpdateRateInput) {
  const [row] = await db
    .update(supplierRates)
    .set(data)
    .where(eq(supplierRates.id, rateId))
    .returning()
  return row ?? null
}

export async function deleteRate(db: PostgresJsDatabase, rateId: string) {
  const [row] = await db
    .delete(supplierRates)
    .where(eq(supplierRates.id, rateId))
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

  return db
    .insert(supplierAvailability)
    .values(
      entries.map((entry) => ({
        supplierId,
        date: entry.date,
        available: entry.available,
        notes: entry.notes ?? null,
      })),
    )
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
) {
  const [row] = await db
    .update(supplierContracts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(supplierContracts.id, contractId))
    .returning()
  return row ?? null
}

export async function deleteContract(db: PostgresJsDatabase, contractId: string) {
  const [row] = await db
    .delete(supplierContracts)
    .where(eq(supplierContracts.id, contractId))
    .returning({ id: supplierContracts.id })
  return row ?? null
}
