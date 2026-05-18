import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { peopleAccountsService } from "../../src/service/accounts-people.js"
import {
  findPersonByContactPoint,
  upsertPersonFromContact,
} from "../../src/service/accounts-resolve.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("CRM person resolution helpers (issue #961)", () => {
  let db: Awaited<ReturnType<typeof loadDb>>

  async function loadDb() {
    const { createTestDb } = await import("@voyantjs/db/test-utils")
    return createTestDb()
  }

  beforeAll(async () => {
    db = await loadDb()
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
  })

  it("findPersonByContactPoint matches a person by normalized email", async () => {
    const created = await peopleAccountsService.createPerson(db, {
      firstName: "Alice",
      lastName: "Walker",
      email: "Alice.Walker@Example.COM",
      status: "active",
      tags: [],
    })
    expect(created).not.toBeNull()

    const hit = await findPersonByContactPoint(db, {
      kind: "email",
      value: "  alice.walker@example.com  ",
    })

    expect(hit?.id).toBe(created!.id)
  })

  it("findPersonByContactPoint returns null when nothing matches", async () => {
    expect(
      await findPersonByContactPoint(db, { kind: "email", value: "nobody@example.com" }),
    ).toBeNull()
  })

  it("upsertPersonFromContact links to an existing person on email match", async () => {
    const seeded = await peopleAccountsService.createPerson(db, {
      firstName: "Existing",
      lastName: "Customer",
      email: "alice@example.com",
      status: "active",
      tags: [],
    })

    const resolved = await upsertPersonFromContact(
      db,
      {
        firstName: "Alice",
        lastName: "Walker",
        email: "ALICE@example.com",
        phone: "+40 712 345 678",
      },
      { source: "storefront-booking", sourceRef: "book_1" },
    )

    expect(resolved?.id).toBe(seeded!.id)
  })

  it("upsertPersonFromContact creates a new CRM row when no contact point matches", async () => {
    const created = await upsertPersonFromContact(
      db,
      {
        firstName: "Robin",
        lastName: "Hood",
        email: "robin@example.com",
      },
      { source: "storefront-booking", sourceRef: "book_42" },
    )

    expect(created?.id).toBeTruthy()
    expect(created?.firstName).toBe("Robin")
    expect(created?.source).toBe("storefront-booking")
    expect(created?.sourceRef).toBe("book_42")

    // Lookup should now find it back via normalized email.
    const found = await findPersonByContactPoint(db, { kind: "email", value: "ROBIN@example.com" })
    expect(found?.id).toBe(created!.id)
  })

  it("upsertPersonFromContact uses email local-part as firstName when name is missing (issue #961 acceptance)", async () => {
    const created = await upsertPersonFromContact(
      db,
      { email: "lonely.traveler@example.com" },
      { source: "storefront-booking", sourceRef: "book_99" },
    )

    expect(created?.firstName).toBe("lonely traveler")
    expect(created?.lastName).toBe("Guest")
  })
})
