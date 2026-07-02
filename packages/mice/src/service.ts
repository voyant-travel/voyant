import { RequestValidationError } from "@voyant-travel/hono"
import { and, desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { type Program, programs } from "./schema.js"
import type { CreateProgramBody, ProgramListQuery, UpdateProgramBody } from "./validation.js"

const PROGRAM_DATE_RANGE_ERROR_MESSAGE = "endDate must be on or after startDate"

type ProgramDateRangeShape = {
  startDate?: string | null
  endDate?: string | null
}

function assertProgramDateRange(program: ProgramDateRangeShape) {
  if (!program.startDate || !program.endDate || program.endDate >= program.startDate) return

  throw new RequestValidationError(PROGRAM_DATE_RANGE_ERROR_MESSAGE, {
    issues: [{ path: ["endDate"], message: PROGRAM_DATE_RANGE_ERROR_MESSAGE }],
  })
}

export async function createProgram(
  db: PostgresJsDatabase,
  input: CreateProgramBody,
): Promise<Program> {
  assertProgramDateRange(input)
  const [program] = await db.insert(programs).values(input).returning()
  if (!program) throw new Error("createProgram: insert returned no rows")
  return program
}

export async function getProgram(db: PostgresJsDatabase, id: string): Promise<Program | null> {
  const [program] = await db.select().from(programs).where(eq(programs.id, id)).limit(1)
  return program ?? null
}

export async function listPrograms(
  db: PostgresJsDatabase,
  query: ProgramListQuery,
): Promise<{ data: Program[]; limit: number; offset: number }> {
  const conditions = []
  if (query.status) conditions.push(eq(programs.status, query.status))
  if (query.type) conditions.push(eq(programs.type, query.type))
  if (query.organizationId) conditions.push(eq(programs.organizationId, query.organizationId))
  const where = conditions.length ? and(...conditions) : undefined

  const data = await db
    .select()
    .from(programs)
    .where(where)
    .orderBy(desc(programs.createdAt))
    .limit(query.limit)
    .offset(query.offset)
  return { data, limit: query.limit, offset: query.offset }
}

export async function updateProgram(
  db: PostgresJsDatabase,
  id: string,
  input: UpdateProgramBody,
): Promise<Program | null> {
  const [current] = await db.select().from(programs).where(eq(programs.id, id)).limit(1)
  if (!current) return null

  assertProgramDateRange({ ...current, ...input })

  const [program] = await db
    .update(programs)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(programs.id, id))
    .returning()
  return program ?? null
}

export const miceService = {
  createProgram,
  getProgram,
  listPrograms,
  updateProgram,
}
