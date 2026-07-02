import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { people } from "../../src/schema.js"
import { personRelationshipsService } from "../../src/service/person-relationships.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("personRelationshipsService", () => {
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: crm; existing suppression is intentional pending typed cleanup.
  let db: any

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyant-travel/db/test-utils")
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
    expect(all).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromPersonId: child.id,
          toPersonId: parent.id,
          kind: "child",
          inverseKind: "parent",
        }),
      ]),
    )
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

  it("does not treat autoInverse opt-out reverse edges as a synced pair", async () => {
    const parent = await seedPerson("Parent")
    const child = await seedPerson("Child")
    const reverse = await personRelationshipsService.createPersonRelationship(db, child.id, {
      toPersonId: parent.id,
      kind: "child",
    })
    const primary = await personRelationshipsService.createPersonRelationship(db, parent.id, {
      toPersonId: child.id,
      kind: "parent",
      inverseKind: "child",
      autoInverse: false,
    })
    if (!primary || !reverse) throw new Error("seed failure")

    await personRelationshipsService.updatePersonRelationship(db, primary.id, {
      kind: "guardian",
      inverseKind: "ward",
    })

    expect(await personRelationshipsService.getPersonRelationship(db, reverse.id)).toMatchObject({
      id: reverse.id,
      kind: "child",
      inverseKind: null,
    })

    await personRelationshipsService.deletePersonRelationship(db, primary.id)
    expect(await personRelationshipsService.getPersonRelationship(db, reverse.id)).toMatchObject({
      id: reverse.id,
      kind: "child",
    })
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

  it("keeps auto-inverse pairs in sync when either edge is updated", async () => {
    const parent = await seedPerson("Parent")
    const child = await seedPerson("Child")
    const created = await personRelationshipsService.createPersonRelationship(db, parent.id, {
      toPersonId: child.id,
      kind: "parent",
      inverseKind: "child",
      startDate: "2026-06-01",
    })
    if (!created) throw new Error("seed failure")

    const updated = await personRelationshipsService.updatePersonRelationship(db, created.id, {
      kind: "sibling",
      inverseKind: "sibling",
      startDate: "2026-07-01",
      notes: "Updated pair",
    })
    expect(updated?.kind).toBe("sibling")

    const parentRelationships = await personRelationshipsService.listPersonRelationships(
      db,
      parent.id,
    )
    expect(parentRelationships).toHaveLength(2)
    expect(
      parentRelationships.map((row) => ({
        from: row.fromPersonId,
        to: row.toPersonId,
        kind: row.kind,
        inverseKind: row.inverseKind,
        startDate: row.startDate,
        notes: row.notes,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          from: parent.id,
          to: child.id,
          kind: "sibling",
          inverseKind: "sibling",
          startDate: "2026-07-01",
          notes: "Updated pair",
        },
        {
          from: child.id,
          to: parent.id,
          kind: "sibling",
          inverseKind: "sibling",
          startDate: "2026-07-01",
          notes: "Updated pair",
        },
      ]),
    )

    const inverse = parentRelationships.find((row) => row.fromPersonId === child.id)
    if (!inverse) throw new Error("expected inverse relationship")

    await personRelationshipsService.updatePersonRelationship(db, inverse.id, {
      kind: "friend",
      inverseKind: "friend",
      notes: "Updated from inverse",
    })

    const afterInverseUpdate = await personRelationshipsService.listPersonRelationships(
      db,
      parent.id,
    )
    expect(
      afterInverseUpdate.map((row) => ({
        from: row.fromPersonId,
        to: row.toPersonId,
        kind: row.kind,
        inverseKind: row.inverseKind,
        notes: row.notes,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          from: parent.id,
          to: child.id,
          kind: "friend",
          inverseKind: "friend",
          notes: "Updated from inverse",
        },
        {
          from: child.id,
          to: parent.id,
          kind: "friend",
          inverseKind: "friend",
          notes: "Updated from inverse",
        },
      ]),
    )
  })

  it("deletes an auto-inverse pair when either edge is deleted", async () => {
    const parent = await seedPerson("Parent")
    const child = await seedPerson("Child")
    const created = await personRelationshipsService.createPersonRelationship(db, parent.id, {
      toPersonId: child.id,
      kind: "parent",
      inverseKind: "child",
    })
    if (!created) throw new Error("seed failure")

    const deleted = await personRelationshipsService.deletePersonRelationship(db, created.id)
    expect(deleted?.id).toBe(created.id)

    expect(await personRelationshipsService.listPersonRelationships(db, parent.id)).toHaveLength(0)
    expect(await personRelationshipsService.listPersonRelationships(db, child.id)).toHaveLength(0)

    const createdFromChild = await personRelationshipsService.createPersonRelationship(
      db,
      parent.id,
      {
        toPersonId: child.id,
        kind: "parent",
        inverseKind: "child",
      },
    )
    if (!createdFromChild) throw new Error("seed failure")
    const childRelationships = await personRelationshipsService.listPersonRelationships(
      db,
      child.id,
    )
    const inverse = childRelationships.find((row) => row.fromPersonId === child.id)
    if (!inverse) throw new Error("expected inverse relationship")

    const deletedInverse = await personRelationshipsService.deletePersonRelationship(db, inverse.id)
    expect(deletedInverse?.id).toBe(inverse.id)

    expect(await personRelationshipsService.listPersonRelationships(db, parent.id)).toHaveLength(0)
    expect(await personRelationshipsService.listPersonRelationships(db, child.id)).toHaveLength(0)
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
