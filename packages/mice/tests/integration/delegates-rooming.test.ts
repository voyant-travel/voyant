import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createProgram } from "../../src/service.js"
import { createDelegate, enrollDelegate } from "../../src/service-delegates.js"
import {
  createRoomingAssignment,
  getRoomingAssignment,
  setRoomingDelegates,
} from "../../src/service-rooming.js"
import { createSession } from "../../src/service-sessions.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("mice delegates + rooming", () => {
  let db: ReturnType<typeof import("@voyant-travel/db/test-utils").createTestDb>

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
    await closeTestDb()
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  async function seedProgram() {
    return createProgram(db, { name: "Acme Summit" })
  }

  it("rejects a delegate for a stale program (no FK 500)", async () => {
    const outcome = await createDelegate(db, { programId: "prog_nope", role: "attendee" })
    expect(outcome.status).toBe("program_not_found")
  })

  it("enrolls a delegate in a session idempotently", async () => {
    const program = await seedProgram()
    const created = await createDelegate(db, { programId: program.id, role: "speaker" })
    if (created.status !== "ok") throw new Error("delegate create failed")
    const session = await createSession(db, { programId: program.id, title: "Keynote" })
    if (session.status !== "ok") throw new Error("session create failed")

    const first = await enrollDelegate(db, created.delegate.id, { sessionId: session.session.id })
    const second = await enrollDelegate(db, created.delegate.id, { sessionId: session.session.id })
    expect(first.status).toBe("ok")
    expect(second.status).toBe("ok")
    if (second.status === "ok") expect(second.idempotent).toBe(true)

    const bad = await enrollDelegate(db, created.delegate.id, { sessionId: "mpss_nope" })
    expect(bad.status).toBe("session_not_found")
  })

  it("assigns a shared room (many delegates) and replaces occupants", async () => {
    const program = await seedProgram()
    const d1 = await createDelegate(db, { programId: program.id, role: "attendee" })
    const d2 = await createDelegate(db, { programId: program.id, role: "attendee" })
    if (d1.status !== "ok" || d2.status !== "ok") throw new Error("delegate create failed")
    const assignment = await createRoomingAssignment(db, {
      programId: program.id,
      bedConfig: "twin",
    })
    if (assignment.status !== "ok") throw new Error("assignment create failed")
    const aid = assignment.assignment.id

    // Shared room: two delegates on one assignment.
    const shared = await setRoomingDelegates(db, aid, [
      { delegateId: d1.delegate.id, isPrimary: true },
      { delegateId: d2.delegate.id },
    ])
    expect(shared.status).toBe("ok")
    expect((await getRoomingAssignment(db, aid))?.delegates).toHaveLength(2)

    // Replace with just one — the other occupant is removed.
    await setRoomingDelegates(db, aid, [{ delegateId: d1.delegate.id, isPrimary: true }])
    expect((await getRoomingAssignment(db, aid))?.delegates).toHaveLength(1)

    // A stale delegate id is a handled 4xx, not an FK 500.
    const bad = await setRoomingDelegates(db, aid, [{ delegateId: "mpdl_nope" }])
    expect(bad.status).toBe("delegate_not_found")
  })
})
