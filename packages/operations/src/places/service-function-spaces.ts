import { and, asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  type FunctionSpace,
  type FunctionSpaceCapacity,
  functionSpaceCapacities,
  functionSpaces,
} from "./schema-function-spaces.js"

export interface CreateFunctionSpaceInput {
  facilityId: string
  name: string
  parentSpaceId?: string
  code?: string
  description?: string
  areaSqm?: number
  divisible?: boolean
  defaultLayout?: FunctionSpace["defaultLayout"]
  sortOrder?: number
}

export async function createFunctionSpace(
  db: PostgresJsDatabase,
  input: CreateFunctionSpaceInput,
): Promise<FunctionSpace> {
  const [space] = await db.insert(functionSpaces).values(input).returning()
  if (!space) throw new Error("createFunctionSpace: insert returned no rows")
  return space
}

export async function getFunctionSpace(
  db: PostgresJsDatabase,
  id: string,
): Promise<(FunctionSpace & { capacities: FunctionSpaceCapacity[] }) | null> {
  const [space] = await db.select().from(functionSpaces).where(eq(functionSpaces.id, id)).limit(1)
  if (!space) return null
  const capacities = await db
    .select()
    .from(functionSpaceCapacities)
    .where(eq(functionSpaceCapacities.spaceId, id))
    .orderBy(asc(functionSpaceCapacities.layout))
  return { ...space, capacities }
}

export async function listFunctionSpaces(
  db: PostgresJsDatabase,
  query: { facilityId?: string; parentSpaceId?: string; limit: number; offset: number },
): Promise<{ data: FunctionSpace[]; limit: number; offset: number }> {
  const conditions = []
  if (query.facilityId) conditions.push(eq(functionSpaces.facilityId, query.facilityId))
  if (query.parentSpaceId) conditions.push(eq(functionSpaces.parentSpaceId, query.parentSpaceId))
  const where = conditions.length ? and(...conditions) : undefined
  const data = await db
    .select()
    .from(functionSpaces)
    .where(where)
    .orderBy(asc(functionSpaces.sortOrder), asc(functionSpaces.name))
    .limit(query.limit)
    .offset(query.offset)
  return { data, limit: query.limit, offset: query.offset }
}

export async function updateFunctionSpace(
  db: PostgresJsDatabase,
  id: string,
  input: Partial<CreateFunctionSpaceInput> & { active?: boolean },
): Promise<FunctionSpace | null> {
  const [space] = await db
    .update(functionSpaces)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(functionSpaces.id, id))
    .returning()
  return space ?? null
}

export interface FunctionSpaceCapacityInput {
  layout: FunctionSpaceCapacity["layout"]
  capacity: number
}

/** Replace the per-layout capacity matrix for a space (upsert by layout). */
export async function setFunctionSpaceCapacities(
  db: PostgresJsDatabase,
  spaceId: string,
  capacities: FunctionSpaceCapacityInput[],
): Promise<FunctionSpaceCapacity[]> {
  return db.transaction(async (tx) => {
    for (const c of capacities) {
      await tx
        .insert(functionSpaceCapacities)
        .values({ spaceId, layout: c.layout, capacity: c.capacity })
        .onConflictDoUpdate({
          target: [functionSpaceCapacities.spaceId, functionSpaceCapacities.layout],
          set: { capacity: c.capacity },
        })
    }
    return tx
      .select()
      .from(functionSpaceCapacities)
      .where(eq(functionSpaceCapacities.spaceId, spaceId))
      .orderBy(asc(functionSpaceCapacities.layout))
  })
}

export const functionSpaceService = {
  createFunctionSpace,
  getFunctionSpace,
  listFunctionSpaces,
  updateFunctionSpace,
  setFunctionSpaceCapacities,
}
