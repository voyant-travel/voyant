import { asc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { programs } from "./schema.js"
import { programDelegates } from "./schema-delegates.js"
import {
  type RoomingAssignment,
  type RoomingAssignmentDelegate,
  roomingAssignmentDelegates,
  roomingAssignments,
} from "./schema-rooming.js"
import type {
  CreateRoomingAssignmentBody,
  RoomingDelegateInput,
  UpdateRoomingAssignmentBody,
} from "./validation-rooming.js"

export type CreateRoomingAssignmentOutcome =
  | { status: "ok"; assignment: RoomingAssignment }
  | { status: "program_not_found" }

export async function createRoomingAssignment(
  db: PostgresJsDatabase,
  input: CreateRoomingAssignmentBody,
): Promise<CreateRoomingAssignmentOutcome> {
  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.id, input.programId))
    .limit(1)
  if (!program) return { status: "program_not_found" }
  const [assignment] = await db.insert(roomingAssignments).values(input).returning()
  if (!assignment) throw new Error("createRoomingAssignment: insert returned no rows")
  return { status: "ok", assignment }
}

export async function getRoomingAssignment(
  db: PostgresJsDatabase,
  id: string,
): Promise<(RoomingAssignment & { delegates: RoomingAssignmentDelegate[] }) | null> {
  const [assignment] = await db
    .select()
    .from(roomingAssignments)
    .where(eq(roomingAssignments.id, id))
    .limit(1)
  if (!assignment) return null
  const delegates = await db
    .select()
    .from(roomingAssignmentDelegates)
    .where(eq(roomingAssignmentDelegates.roomingAssignmentId, id))
  return { ...assignment, delegates }
}

export async function listRoomingAssignments(
  db: PostgresJsDatabase,
  query: { programId: string; limit: number; offset: number },
): Promise<{ data: RoomingAssignment[]; limit: number; offset: number }> {
  const data = await db
    .select()
    .from(roomingAssignments)
    .where(eq(roomingAssignments.programId, query.programId))
    .orderBy(asc(roomingAssignments.createdAt))
    .limit(query.limit)
    .offset(query.offset)
  return { data, limit: query.limit, offset: query.offset }
}

export async function updateRoomingAssignment(
  db: PostgresJsDatabase,
  id: string,
  input: UpdateRoomingAssignmentBody,
): Promise<RoomingAssignment | null> {
  const [assignment] = await db
    .update(roomingAssignments)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(roomingAssignments.id, id))
    .returning()
  return assignment ?? null
}

export type SetRoomingDelegatesOutcome =
  | { status: "ok"; delegates: RoomingAssignmentDelegate[] }
  | { status: "assignment_not_found" }
  | { status: "delegate_not_found"; missing: string[] }

/**
 * Replace the occupants of a rooming assignment (full replace). Validates the
 * assignment and that every delegate exists before touching the join, so a
 * stale delegate id is a 4xx rather than an FK 500.
 */
export async function setRoomingDelegates(
  db: PostgresJsDatabase,
  assignmentId: string,
  delegates: RoomingDelegateInput[],
): Promise<SetRoomingDelegatesOutcome> {
  return db.transaction(async (tx) => {
    const [assignment] = await tx
      .select({ id: roomingAssignments.id })
      .from(roomingAssignments)
      .where(eq(roomingAssignments.id, assignmentId))
      .limit(1)
    if (!assignment) return { status: "assignment_not_found" as const }

    const ids = delegates.map((d) => d.delegateId)
    if (ids.length) {
      const found = await tx
        .select({ id: programDelegates.id })
        .from(programDelegates)
        .where(inArray(programDelegates.id, ids))
      const foundIds = new Set(found.map((r) => r.id))
      const missing = ids.filter((id) => !foundIds.has(id))
      if (missing.length) return { status: "delegate_not_found" as const, missing }
    }

    await tx
      .delete(roomingAssignmentDelegates)
      .where(eq(roomingAssignmentDelegates.roomingAssignmentId, assignmentId))
    if (delegates.length === 0) return { status: "ok" as const, delegates: [] }
    const rows = await tx
      .insert(roomingAssignmentDelegates)
      .values(
        delegates.map((d) => ({
          roomingAssignmentId: assignmentId,
          delegateId: d.delegateId,
          isPrimary: d.isPrimary ?? false,
          bedLabel: d.bedLabel,
        })),
      )
      .returning()
    return { status: "ok" as const, delegates: rows }
  })
}

export const roomingService = {
  createRoomingAssignment,
  getRoomingAssignment,
  listRoomingAssignments,
  updateRoomingAssignment,
  setRoomingDelegates,
}
