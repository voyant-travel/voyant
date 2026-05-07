import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { people } from "../../src/schema.js"
import { personRelationshipsService } from "../../src/service/person-relationships.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("personRelationshipsService", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    await closeTestDb()
  })

  async function seedPerson(firstName = "Test") {
    const [row] = await db
      .insert(people)
      .values({
        firstName,
        lastName: "Person",
        tags: [],
        status: "active",
      })
      .returning()
    return row
  }

  it("creates a directed edge between two people", async () => {
    const a = await seedPerson("Alice")
    const b = await seedPerson("Bob")
    const created = await personRelationshipsService.createPersonRelationship(db, a.id, {
      toPersonId: b.id,
      kind: "spouse",
    })
    expect(created?.fromPersonId).toBe(a.id)
    expect(created?.toPersonId).toBe(b.id)
    expect(created?.kind).toBe("spouse")
    expect(created?.inverseKind).toBeNull()
  })

  it("rejects self-relationships", async () => {
    const a = await seedPerson("Solo")
    const result = await personRelationshipsService.createPersonRelationship(db, a.id, {
      toPersonId: a.id,
      kind: "friend",
    })
    expect(result).toBeNull()
  })

  it("returns null when either person is missing", async () => {
    const a = await seedPerson("Real")
    expect(
      await personRelationshipsService.createPersonRelationship(db, a.id, {
        toPersonId: "pers_missing",
        kind: "friend",
      }),
    ).toBeNull()
    expect(
      await personRelationshipsService.createPersonRelationship(db, "pers_missing", {
        toPersonId: a.id,
        kind: "friend",
      }),
    ).toBeNull()
  })

  it("enforces uniqueness on (from, to, kind)", async () => {
    const a = await seedPerson("Alice")
    const b = await seedPerson("Bob")
    await personRelationshipsService.createPersonRelationship(db, a.id, {
      toPersonId: b.id,
      kind: "friend",
    })
    await expect(
      personRelationshipsService.createPersonRelationship(db, a.id, {
        toPersonId: b.id,
        kind: "friend",
      }),
    ).rejects.toThrow()
    // A different kind on the same pair is fine.
    const second = await personRelationshipsService.createPersonRelationship(db, a.id, {
      toPersonId: b.id,
      kind: "travel_companion",
    })
    expect(second?.id).toBeTruthy()
  })

  it("auto-writes the inverse edge when inverseKind is provided", async () => {
    const parent = await seedPerson("Parent")
    const child = await seedPerson("Child")
    const created = await personRelationshipsService.createPersonRelationship(db, parent.id, {
      toPersonId: child.id,
      kind: "parent",
      inverseKind: "child",
    })
    expect(created?.kind).toBe("parent")

    const fromBoth = await personRelationshipsService.listPersonRelationships(db, parent.id)
    expect(fromBoth).toHaveLength(2)
    const kinds = fromBoth.map(
      (row) => `${row.fromPersonId === parent.id ? "out" : "in"}:${row.kind}`,
    )
    expect(kinds.sort()).toEqual(["in:child", "out:parent"])
  })

  it("auto-inverse helper is idempotent on a re-run", async () => {
    const parent = await seedPerson("Parent")
    const child = await seedPerson("Child")
    // Pre-populate the inverse edge directly.
    await personRelationshipsService.createPersonRelationship(db, child.id, {
      toPersonId: parent.id,
      kind: "child",
    })

    // The auto-inverse path tries to insert (child, parent, child) but
    // it's already there — the onConflictDoNothing should swallow the
    // dup and the primary insert should succeed.
    const created = await personRelationshipsService.createPersonRelationship(db, parent.id, {
      toPersonId: child.id,
      kind: "parent",
      inverseKind: "child",
    })
    expect(created?.kind).toBe("parent")

    const all = await personRelationshipsService.listPersonRelationships(db, parent.id)
    expect(all).toHaveLength(2)
  })

  it("autoInverse: false skips the symmetric edge", async () => {
    const parent = await seedPerson("Parent")
    const child = await seedPerson("Child")
    await personRelationshipsService.createPersonRelationship(db, parent.id, {
      toPersonId: child.id,
      kind: "parent",
      inverseKind: "child",
      autoInverse: false,
    })
    const all = await personRelationshipsService.listPersonRelationships(db, parent.id)
    expect(all).toHaveLength(1)
    expect(all[0]?.kind).toBe("parent")
  })

  it("listPersonRelationships filters by direction", async () => {
    const a = await seedPerson("A")
    const b = await seedPerson("B")
    const c = await seedPerson("C")
    await personRelationshipsService.createPersonRelationship(db, a.id, {
      toPersonId: b.id,
      kind: "friend",
    })
    await personRelationshipsService.createPersonRelationship(db, c.id, {
      toPersonId: a.id,
      kind: "sibling",
    })

    const both = await personRelationshipsService.listPersonRelationships(db, a.id)
    expect(both).toHaveLength(2)

    const out = await personRelationshipsService.listPersonRelationships(db, a.id, {
      direction: "from",
    })
    expect(out.map((row) => row.toPersonId)).toEqual([b.id])

    const incoming = await personRelationshipsService.listPersonRelationships(db, a.id, {
      direction: "to",
    })
    expect(incoming.map((row) => row.fromPersonId)).toEqual([c.id])
  })

  it("update + delete operate on a single edge", async () => {
    const a = await seedPerson("A")
    const b = await seedPerson("B")
    const created = await personRelationshipsService.createPersonRelationship(db, a.id, {
      toPersonId: b.id,
      kind: "friend",
    })
    if (!created) throw new Error("seed failure")

    const updated = await personRelationshipsService.updatePersonRelationship(db, created.id, {
      notes: "Met at conference",
      isPrimary: true,
    })
    expect(updated?.notes).toBe("Met at conference")
    expect(updated?.isPrimary).toBe(true)

    const deleted = await personRelationshipsService.deletePersonRelationship(db, created.id)
    expect(deleted?.id).toBe(created.id)

    const after = await personRelationshipsService.getPersonRelationship(db, created.id)
    expect(after).toBeNull()
  })
})
