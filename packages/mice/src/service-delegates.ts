import { RequestValidationError } from "@voyant-travel/hono"
import { and, asc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { MiceRouteRuntime } from "./route-runtime.js"
import { programs } from "./schema.js"
import {
  type DelegateSessionEnrollment,
  delegateSessionEnrollments,
  type ProgramDelegate,
  programDelegates,
} from "./schema-delegates.js"
import { programSessions } from "./schema-sessions.js"
import type {
  CreateDelegateBody,
  DelegateListQuery,
  EnrollDelegateBody,
  UpdateDelegateBody,
} from "./validation-delegates.js"

/** Coerce ISO datetime strings (from validation) into Date for timestamp columns. */
function withTimestamps<T extends { arrivalAt?: string; departureAt?: string }>(input: T) {
  const { arrivalAt, departureAt, ...rest } = input
  return {
    ...rest,
    ...(arrivalAt !== undefined ? { arrivalAt: new Date(arrivalAt) } : {}),
    ...(departureAt !== undefined ? { departureAt: new Date(departureAt) } : {}),
  }
}

async function validateDelegatePerson(
  db: PostgresJsDatabase,
  personId: string | null | undefined,
  runtime: MiceRouteRuntime,
) {
  if (!personId || !runtime.resolveDelegatePersonById) return

  const exists = await runtime.resolveDelegatePersonById(db, personId)
  if (!exists) {
    throw new RequestValidationError("Delegate personId does not reference an existing person", {
      fields: {
        fieldErrors: { personId: ["Person not found"] },
        formErrors: [],
      },
    })
  }
}

export type CreateDelegateOutcome =
  | { status: "ok"; delegate: ProgramDelegate }
  | { status: "program_not_found" }

export async function createDelegate(
  db: PostgresJsDatabase,
  input: CreateDelegateBody,
  runtime: MiceRouteRuntime = {},
): Promise<CreateDelegateOutcome> {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.id, input.programId))
    .limit(1)
  if (!program) return { status: "program_not_found" }
  await validateDelegatePerson(db, input.personId, runtime)
  const [delegate] = await db.insert(programDelegates).values(withTimestamps(input)).returning()
  if (!delegate) throw new Error("createDelegate: insert returned no rows")
  return { status: "ok", delegate }
}

export async function getDelegate(
  db: PostgresJsDatabase,
  id: string,
): Promise<(ProgramDelegate & { enrollments: DelegateSessionEnrollment[] }) | null> {
  const [delegate] = await db
    .select()
    .from(programDelegates)
    .where(eq(programDelegates.id, id))
    .limit(1)
  if (!delegate) return null
  const enrollments = await db
    .select()
    .from(delegateSessionEnrollments)
    .where(eq(delegateSessionEnrollments.delegateId, id))
  return { ...delegate, enrollments }
}

export async function listDelegates(
  db: PostgresJsDatabase,
  query: DelegateListQuery,
): Promise<{ data: ProgramDelegate[]; limit: number; offset: number }> {
  const conditions = [eq(programDelegates.programId, query.programId)]
  if (query.status) conditions.push(eq(programDelegates.status, query.status))
  if (query.role) conditions.push(eq(programDelegates.role, query.role))
  const data = await db
    .select()
    .from(programDelegates)
    .where(and(...conditions))
    .orderBy(asc(programDelegates.createdAt))
    .limit(query.limit)
    .offset(query.offset)
  return { data, limit: query.limit, offset: query.offset }
}

export async function updateDelegate(
  db: PostgresJsDatabase,
  id: string,
  input: UpdateDelegateBody,
  runtime: MiceRouteRuntime = {},
): Promise<ProgramDelegate | null> {
  await validateDelegatePerson(db, input.personId, runtime)
  const [delegate] = await db
    .update(programDelegates)
    .set({ ...withTimestamps(input), updatedAt: new Date() })
    .where(eq(programDelegates.id, id))
    .returning()
  return delegate ?? null
}

export type EnrollDelegateOutcome =
  | { status: "ok"; enrollment: DelegateSessionEnrollment; idempotent: boolean }
  | { status: "delegate_not_found" }
  | { status: "session_not_found" }
  | { status: "program_mismatch" }

/** Enroll a delegate in a session. Idempotent on (delegate, session). */
export async function enrollDelegate(
  db: PostgresJsDatabase,
  delegateId: string,
  input: EnrollDelegateBody,
): Promise<EnrollDelegateOutcome> {
  return db.transaction(async (tx) => {
    const [delegate] = await tx
      .select({ id: programDelegates.id, programId: programDelegates.programId })
      .from(programDelegates)
      .where(eq(programDelegates.id, delegateId))
      .limit(1)
    if (!delegate) return { status: "delegate_not_found" as const }
    const [session] = await tx
      .select({ id: programSessions.id, programId: programSessions.programId })
      .from(programSessions)
      .where(eq(programSessions.id, input.sessionId))
      .limit(1)
    if (!session) return { status: "session_not_found" as const }
    // The session must belong to the delegate's program — neither the FK nor the
    // unique index includes program_id, so guard against cross-program enrollment.
    if (session.programId !== delegate.programId) return { status: "program_mismatch" as const }

    const [existing] = await tx
      .select()
      .from(delegateSessionEnrollments)
      .where(
        and(
          eq(delegateSessionEnrollments.delegateId, delegateId),
          eq(delegateSessionEnrollments.sessionId, input.sessionId),
        ),
      )
      .limit(1)
    if (existing) return { status: "ok" as const, enrollment: existing, idempotent: true }

    const [enrollment] = await tx
      .insert(delegateSessionEnrollments)
      .values({ delegateId, sessionId: input.sessionId, status: input.status })
      .returning()
    if (!enrollment) throw new Error("enrollDelegate: insert returned no rows")
    return { status: "ok" as const, enrollment, idempotent: false }
  })
}

export const delegateService = {
  createDelegate,
  getDelegate,
  listDelegates,
  updateDelegate,
  enrollDelegate,
}
