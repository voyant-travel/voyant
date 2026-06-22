import { and, asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { programs } from "./schema.js"
import {
  type ProgramSession,
  programSessions,
  type SessionInclusion,
  sessionInclusions,
} from "./schema-sessions.js"
import type {
  CreateSessionBody,
  SessionInclusionInput,
  SessionListQuery,
  UpdateSessionBody,
} from "./validation-sessions.js"

/** Coerce ISO datetime strings (from validation) into Date for timestamp columns. */
function withTimestamps<T extends { startsAt?: string; endsAt?: string }>(input: T) {
  const { startsAt, endsAt, ...rest } = input
  return {
    ...rest,
    ...(startsAt !== undefined ? { startsAt: new Date(startsAt) } : {}),
    ...(endsAt !== undefined ? { endsAt: new Date(endsAt) } : {}),
  }
}

export type CreateSessionOutcome =
  | { status: "ok"; session: ProgramSession }
  | { status: "program_not_found" }

export async function createSession(
  db: PostgresJsDatabase,
  input: CreateSessionBody,
): Promise<CreateSessionOutcome> {
  // Validate the program FK up front so a stale/mistyped programId is a 4xx,
  // not a raw FK-violation 500.
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.id, input.programId))
    .limit(1)
  if (!program) return { status: "program_not_found" }
  const [session] = await db.insert(programSessions).values(withTimestamps(input)).returning()
  if (!session) throw new Error("createSession: insert returned no rows")
  return { status: "ok", session }
}

export async function getSession(
  db: PostgresJsDatabase,
  id: string,
): Promise<(ProgramSession & { inclusions: SessionInclusion[] }) | null> {
  const [session] = await db
    .select()
    .from(programSessions)
    .where(eq(programSessions.id, id))
    .limit(1)
  if (!session) return null
  const inclusions = await db
    .select()
    .from(sessionInclusions)
    .where(eq(sessionInclusions.sessionId, id))
  return { ...session, inclusions }
}

export async function listSessions(
  db: PostgresJsDatabase,
  query: SessionListQuery,
): Promise<{ data: ProgramSession[]; limit: number; offset: number }> {
  const conditions = [eq(programSessions.programId, query.programId)]
  if (query.sessionType) conditions.push(eq(programSessions.sessionType, query.sessionType))
  const data = await db
    .select()
    .from(programSessions)
    .where(and(...conditions))
    .orderBy(asc(programSessions.dayDate), asc(programSessions.startsAt))
    .limit(query.limit)
    .offset(query.offset)
  return { data, limit: query.limit, offset: query.offset }
}

export async function updateSession(
  db: PostgresJsDatabase,
  id: string,
  input: UpdateSessionBody,
): Promise<ProgramSession | null> {
  const [session] = await db
    .update(programSessions)
    .set({ ...withTimestamps(input), updatedAt: new Date() })
    .where(eq(programSessions.id, id))
    .returning()
  return session ?? null
}

export async function deleteSession(db: PostgresJsDatabase, id: string): Promise<boolean> {
  const [row] = await db.delete(programSessions).where(eq(programSessions.id, id)).returning()
  return !!row
}

/** Replace a session's inclusions (delete-all + insert) in one transaction. */
export async function setSessionInclusions(
  db: PostgresJsDatabase,
  sessionId: string,
  inclusions: SessionInclusionInput[],
): Promise<SessionInclusion[]> {
  return db.transaction(async (tx) => {
    await tx.delete(sessionInclusions).where(eq(sessionInclusions.sessionId, sessionId))
    if (inclusions.length === 0) return []
    return tx
      .insert(sessionInclusions)
      .values(inclusions.map((i) => ({ sessionId, ...i })))
      .returning()
  })
}

export const sessionService = {
  createSession,
  getSession,
  listSessions,
  updateSession,
  deleteSession,
  setSessionInclusions,
}
