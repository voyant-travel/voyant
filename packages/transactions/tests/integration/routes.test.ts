import { eq, sql } from "drizzle-orm"
import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import {
  offerContactAssignments,
  offerParticipants,
  offerStaffAssignments,
  orderParticipants,
  transactionPiiAccessLog,
} from "../../src/schema.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
const ORIGINAL_TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

function getIsolatedTransactionsTestDbUrl(url: string | undefined) {
  if (!url) return url

  try {
    const parsed = new URL(url)
    if (parsed.hostname === "127.0.0.1" && parsed.pathname === "/voyant_test") {
      parsed.pathname = "/voyant_transactions_test"
      return parsed.toString()
    }
  } catch {
    return url
  }

  return url
}

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let seq = 0
function nextSeq() {
  seq++
  return String(seq).padStart(4, "0")
}

function nextRef(prefix: string, seq: string) {
  const s = seq
  return `${prefix}-${Date.now()}-${s}`
}

async function cleanupTransactionsTestData(
  // biome-ignore lint/suspicious/noExplicitAny: test db typing
  db: any,
) {
  await db.execute(sql`
    TRUNCATE
      offer_item_participants,
      order_item_participants,
      order_terms,
      offer_contact_assignments,
      offer_staff_assignments,
      order_contact_assignments,
      order_staff_assignments,
      offer_items,
      order_items,
      offer_participants,
      order_participants,
      offers,
      orders,
      transaction_pii_access_log
  `)
}

describe.skipIf(!DB_AVAILABLE)("Transactions routes (integration)", () => {
  let app: Hono
  // biome-ignore lint/suspicious/noExplicitAny: test db typing
  let db: any

  beforeAll(async () => {
    process.env.TEST_DATABASE_URL = getIsolatedTransactionsTestDbUrl(process.env.TEST_DATABASE_URL)
    const { createTestDb } = await import("@voyantjs/db/test-utils")
    const { transactionsRoutes } = await import("../../src/routes.js")
    const { generateEnvKmsKey } = await import("@voyantjs/utils")

    db = createTestDb()
    await db.execute(sql`
      DO $$
      BEGIN
        CREATE TYPE transaction_pii_access_action AS ENUM ('read', 'update', 'delete');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await db.execute(sql`
      DO $$
      BEGIN
        CREATE TYPE transaction_pii_access_outcome AS ENUM ('allowed', 'denied');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await db.execute(sql`
      ALTER TABLE offer_participants
      ADD COLUMN IF NOT EXISTS identity_encrypted jsonb
    `)
    await db.execute(sql`
      ALTER TABLE order_participants
      ADD COLUMN IF NOT EXISTS identity_encrypted jsonb
    `)
    await db.execute(sql`
      ALTER TABLE offers
      ADD COLUMN IF NOT EXISTS contact_first_name text,
      ADD COLUMN IF NOT EXISTS contact_last_name text,
      ADD COLUMN IF NOT EXISTS contact_email text,
      ADD COLUMN IF NOT EXISTS contact_phone text,
      ADD COLUMN IF NOT EXISTS contact_preferred_language text,
      ADD COLUMN IF NOT EXISTS contact_country text,
      ADD COLUMN IF NOT EXISTS contact_region text,
      ADD COLUMN IF NOT EXISTS contact_city text,
      ADD COLUMN IF NOT EXISTS contact_address_line1 text,
      ADD COLUMN IF NOT EXISTS contact_postal_code text
    `)
    await db.execute(sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS contact_first_name text,
      ADD COLUMN IF NOT EXISTS contact_last_name text,
      ADD COLUMN IF NOT EXISTS contact_email text,
      ADD COLUMN IF NOT EXISTS contact_phone text,
      ADD COLUMN IF NOT EXISTS contact_preferred_language text,
      ADD COLUMN IF NOT EXISTS contact_country text,
      ADD COLUMN IF NOT EXISTS contact_region text,
      ADD COLUMN IF NOT EXISTS contact_city text,
      ADD COLUMN IF NOT EXISTS contact_address_line1 text,
      ADD COLUMN IF NOT EXISTS contact_postal_code text
    `)
    await db.execute(sql`
      DO $$
      BEGIN
        CREATE TYPE transaction_contact_assignment_role AS ENUM ('primary_contact', 'other');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS offer_contact_assignments (
        id text PRIMARY KEY NOT NULL,
        offer_id text NOT NULL,
        offer_item_id text,
        person_id text,
        role transaction_contact_assignment_role NOT NULL DEFAULT 'primary_contact',
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text,
        phone text,
        preferred_language text,
        is_primary boolean NOT NULL DEFAULT false,
        notes text,
        metadata jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS order_contact_assignments (
        id text PRIMARY KEY NOT NULL,
        order_id text NOT NULL,
        order_item_id text,
        person_id text,
        role transaction_contact_assignment_role NOT NULL DEFAULT 'primary_contact',
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text,
        phone text,
        preferred_language text,
        is_primary boolean NOT NULL DEFAULT false,
        notes text,
        metadata jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `)
    await db.execute(sql`
      DO $$
      BEGIN
        CREATE TYPE transaction_staff_assignment_role AS ENUM ('service_assignee', 'other');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS offer_staff_assignments (
        id text PRIMARY KEY NOT NULL,
        offer_id text NOT NULL,
        offer_item_id text,
        person_id text,
        role transaction_staff_assignment_role NOT NULL DEFAULT 'service_assignee',
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text,
        phone text,
        preferred_language text,
        is_primary boolean NOT NULL DEFAULT false,
        notes text,
        metadata jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS order_staff_assignments (
        id text PRIMARY KEY NOT NULL,
        order_id text NOT NULL,
        order_item_id text,
        person_id text,
        role transaction_staff_assignment_role NOT NULL DEFAULT 'service_assignee',
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text,
        phone text,
        preferred_language text,
        is_primary boolean NOT NULL DEFAULT false,
        notes text,
        metadata jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transaction_pii_access_log (
        id text PRIMARY KEY NOT NULL,
        traveler_kind text NOT NULL,
        parent_id text,
        traveler_id text,
        actor_id text,
        actor_type text,
        caller_type text,
        action transaction_pii_access_action NOT NULL,
        outcome transaction_pii_access_outcome NOT NULL,
        reason text,
        metadata jsonb,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `)
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_transaction_pii_access_log_parent ON transaction_pii_access_log (parent_id)`,
    )
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_transaction_pii_access_log_participant ON transaction_pii_access_log (traveler_id)`,
    )
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_transaction_pii_access_log_actor ON transaction_pii_access_log (actor_id)`,
    )
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_transaction_pii_access_log_created_at ON transaction_pii_access_log (created_at)`,
    )
    process.env.KMS_PROVIDER = "env"
    process.env.KMS_ENV_KEY = generateEnvKmsKey()
    await cleanupTransactionsTestData(db)

    app = new Hono()
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      c.set("actor" as never, "staff")
      await next()
    })
    app.route("/", transactionsRoutes)
  })

  beforeEach(async () => {
    seq = 0
    await cleanupTransactionsTestData(db)
  })

  afterAll(async () => {
    const { closeTestDb } = await import("@voyantjs/db/test-utils")
    delete process.env.KMS_PROVIDER
    delete process.env.KMS_ENV_KEY
    process.env.TEST_DATABASE_URL = ORIGINAL_TEST_DATABASE_URL
    await closeTestDb()
  })

  /* ── seed helpers ─────────────────────────────────────── */

  async function seedOffer(overrides: Record<string, unknown> = {}) {
    const s = nextSeq()
    const res = await app.request("/offers", {
      method: "POST",
      ...json({
        offerNumber: nextRef("OFF", s),
        title: `Offer ${s}`,
        currency: "USD",
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedOfferParticipant(offerId: string, overrides: Record<string, unknown> = {}) {
    const s = nextSeq()
    const res = await app.request("/offer-travelers", {
      method: "POST",
      ...json({
        offerId,
        firstName: `First${s}`,
        lastName: `Last${s}`,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  it("rejects staff and contact-only roles on traveler routes", async () => {
    const offer = await seedOffer()

    const staffRes = await app.request("/offer-travelers", {
      method: "POST",
      ...json({
        offerId: offer.id,
        firstName: "Guide",
        lastName: "Local",
        participantType: "staff",
      }),
    })

    expect(staffRes.status).toBe(400)
    expect((await staffRes.json()).error).toContain("staff")

    const contactRes = await app.request("/offer-travelers", {
      method: "POST",
      ...json({
        offerId: offer.id,
        firstName: "Mihai",
        lastName: "Booker",
        participantType: "booker",
      }),
    })

    expect(contactRes.status).toBe(400)
    expect((await contactRes.json()).error).toContain("Invalid option")

    const order = await seedOrder()
    const orderContactRes = await app.request("/order-travelers", {
      method: "POST",
      ...json({
        orderId: order.id,
        firstName: "Ana",
        lastName: "Contact",
        participantType: "contact",
      }),
    })

    expect(orderContactRes.status).toBe(400)
    expect((await orderContactRes.json()).error).toContain("Invalid option")
  })

  it("stores staff separately when creating offer bundles", async () => {
    const { transactionsService } = await import("../../src/service.js")

    const created = await transactionsService.createOfferBundle(db, {
      offer: {
        offerNumber: nextRef("OFF", nextSeq()),
        title: "Guided offer",
        currency: "USD",
      },
      travelers: [
        {
          firstName: "Ana",
          lastName: "Traveler",
          participantType: "traveler",
          isPrimary: true,
        },
        {
          firstName: "Guide",
          lastName: "Local",
          participantType: "staff",
          isPrimary: false,
        },
      ],
      items: [
        {
          title: "Tour entry",
          sellCurrency: "USD",
        },
      ],
      itemTravelers: [
        { itemIndex: 0, participantIndex: 0, role: "traveler", isPrimary: true },
        { itemIndex: 0, participantIndex: 1, role: "service_assignee", isPrimary: false },
      ],
    })

    expect(created?.travelers).toHaveLength(1)

    const travelerRows = await db
      .select()
      .from(offerParticipants)
      .where(eq(offerParticipants.offerId, created!.offer.id))
    expect(travelerRows).toHaveLength(1)
    expect(travelerRows[0]?.participantType).toBe("traveler")

    const staffRows = await db
      .select()
      .from(offerStaffAssignments)
      .where(eq(offerStaffAssignments.offerId, created!.offer.id))
    expect(staffRows).toHaveLength(1)
    expect(staffRows[0]).toMatchObject({
      firstName: "Guide",
      lastName: "Local",
      role: "service_assignee",
    })
    expect(staffRows[0]?.offerItemId).toBeTruthy()
  })

  it("derives offer contact snapshots from primary contact assignments", async () => {
    const { transactionsService } = await import("../../src/service.js")

    const created = await transactionsService.createOfferBundle(db, {
      offer: {
        offerNumber: nextRef("OFF", nextSeq()),
        title: "Contacted offer",
        currency: "USD",
      },
      travelers: [
        {
          firstName: "Ana",
          lastName: "Traveler",
          participantType: "traveler",
          isPrimary: true,
        },
      ],
      contactAssignments: [
        {
          firstName: "Bianca",
          lastName: "Booker",
          role: "primary_contact",
          email: "bianca.booker@example.com",
          phone: "+40111111222",
          preferredLanguage: "ro",
          isPrimary: true,
        },
      ],
      items: [
        {
          title: "Tour entry",
          sellCurrency: "USD",
        },
      ],
      itemTravelers: [{ itemIndex: 0, participantIndex: 0, role: "traveler", isPrimary: true }],
    })

    expect(created?.offer.contactFirstName).toBe("Bianca")
    expect(created?.offer.contactLastName).toBe("Booker")
    expect(created?.offer.contactEmail).toBe("bianca.booker@example.com")
    expect(created?.offer.contactPhone).toBe("+40111111222")
    expect(created?.offer.contactPreferredLanguage).toBe("ro")

    const travelerRows = await db
      .select()
      .from(offerParticipants)
      .where(eq(offerParticipants.offerId, created!.offer.id))
    expect(travelerRows).toHaveLength(1)

    const contactRows = await db
      .select()
      .from(offerContactAssignments)
      .where(eq(offerContactAssignments.offerId, created!.offer.id))
    expect(contactRows).toHaveLength(1)
    expect(contactRows[0]).toMatchObject({
      firstName: "Bianca",
      lastName: "Booker",
      role: "primary_contact",
    })
    expect(contactRows[0]?.offerItemId).toBeNull()
  })

  it("stores explicit offer billing party snapshots", async () => {
    const { transactionsService } = await import("../../src/service.js")

    const created = await transactionsService.createOfferBundle(db, {
      offer: {
        offerNumber: nextRef("OFF", nextSeq()),
        title: "Company offer",
        currency: "EUR",
        organizationId: "org_123",
        contactPartyType: "company",
        contactFirstName: "Acme SRL",
        contactLastName: null,
        contactTaxId: "RO123456",
      },
      travelers: [
        {
          firstName: "Ana",
          lastName: "Traveler",
          participantType: "traveler",
          isPrimary: true,
        },
      ],
      items: [
        {
          title: "Tour entry",
          sellCurrency: "EUR",
        },
      ],
    })

    expect(created?.offer.contactPartyType).toBe("company")
    expect(created?.offer.contactFirstName).toBe("Acme SRL")
    expect(created?.offer.contactLastName).toBeNull()
    expect(created?.offer.contactTaxId).toBe("RO123456")
  })

  async function seedOfferItem(offerId: string, overrides: Record<string, unknown> = {}) {
    const s = nextSeq()
    const res = await app.request("/offer-items", {
      method: "POST",
      ...json({
        offerId,
        title: `Item ${s}`,
        sellCurrency: "USD",
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedOfferItemParticipant(
    offerItemId: string,
    participantId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await app.request("/offer-item-travelers", {
      method: "POST",
      ...json({
        offerItemId,
        travelerId: participantId,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedOrder(overrides: Record<string, unknown> = {}) {
    const s = nextSeq()
    const res = await app.request("/orders", {
      method: "POST",
      ...json({
        orderNumber: nextRef("ORD", s),
        title: `Order ${s}`,
        currency: "USD",
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedOrderParticipant(orderId: string, overrides: Record<string, unknown> = {}) {
    const s = nextSeq()
    const res = await app.request("/order-travelers", {
      method: "POST",
      ...json({
        orderId,
        firstName: `First${s}`,
        lastName: `Last${s}`,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedOrderItem(orderId: string, overrides: Record<string, unknown> = {}) {
    const s = nextSeq()
    const res = await app.request("/order-items", {
      method: "POST",
      ...json({
        orderId,
        title: `Item ${s}`,
        sellCurrency: "USD",
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedOrderItemParticipant(
    orderItemId: string,
    participantId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await app.request("/order-item-travelers", {
      method: "POST",
      ...json({
        orderItemId,
        travelerId: participantId,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  async function seedOrderTerm(
    parentId: { offerId?: string; orderId?: string },
    overrides: Record<string, unknown> = {},
  ) {
    const s = nextSeq()
    const res = await app.request("/order-terms", {
      method: "POST",
      ...json({
        ...parentId,
        title: `Term ${s}`,
        body: `Body of term ${s}`,
        ...overrides,
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    return body.data
  }

  /* ═══════════════════════════════════════════════════════
	   Offers
	   ═══════════════════════════════════════════════════════ */
  describe("Offers", () => {
    it("POST /offers → 201", async () => {
      const offer = await seedOffer()
      expect(offer.id).toMatch(/^ofr_/)
      expect(offer.offerNumber).toMatch(/^OFF-\d{13}-0001$/)
      expect(offer.title).toBe("Offer 0001")
      expect(offer.currency).toBe("USD")
      expect(offer.status).toBe("draft")
    })

    it("GET /offers/:id → 200", async () => {
      const offer = await seedOffer()
      const res = await app.request(`/offers/${offer.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(offer.id)
    })

    it("GET /offers/:id → 404 for missing", async () => {
      const res = await app.request("/offers/ofr_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /offers/:id → 200", async () => {
      const offer = await seedOffer()
      const res = await app.request(`/offers/${offer.id}`, {
        method: "PATCH",
        ...json({ title: "Updated Offer", status: "published", totalAmountCents: 50000 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.title).toBe("Updated Offer")
      expect(body.data.status).toBe("published")
      expect(body.data.totalAmountCents).toBe(50000)
    })

    it("PATCH /offers/:id → 404 for missing", async () => {
      const res = await app.request("/offers/ofr_nonexistent", {
        method: "PATCH",
        ...json({ title: "Nope" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /offers/:id → 200", async () => {
      const offer = await seedOffer()
      const res = await app.request(`/offers/${offer.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      const get = await app.request(`/offers/${offer.id}`)
      expect(get.status).toBe(404)
    })

    it("DELETE /offers/:id → 404 for missing", async () => {
      const res = await app.request("/offers/ofr_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /offers → list with pagination", async () => {
      await seedOffer()
      await seedOffer()
      const res = await app.request("/offers?limit=1&offset=0")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(2)
    })

    it("GET /offers → filter by status", async () => {
      await seedOffer({ status: "draft" })
      await seedOffer({ status: "published" })
      const res = await app.request("/offers?status=published")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe("published")
    })

    it("GET /offers → search by title", async () => {
      await seedOffer({ title: "Alpha Trip" })
      await seedOffer({ title: "Beta Tour" })
      const res = await app.request("/offers?search=Alpha")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].title).toBe("Alpha Trip")
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Offer Participants
	   ═══════════════════════════════════════════════════════ */
  describe("Offer Travelers", () => {
    it("POST /offer-travelers → 201", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      expect(participant.id).toMatch(/^ofpt_/)
      expect(participant.offerId).toBe(offer.id)
      expect(participant.participantType).toBe("traveler")
      expect(participant.isPrimary).toBe(false)
    })

    it("GET /offer-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const res = await app.request(`/offer-travelers/${participant.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /offer-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-travelers/ofpt_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /offer-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const res = await app.request(`/offer-travelers/${participant.id}`, {
        method: "PATCH",
        ...json({ isPrimary: true, participantType: "occupant" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.isPrimary).toBe(true)
      expect(body.data.participantType).toBe("occupant")
    })

    it("PATCH /offer-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-travelers/ofpt_nonexistent", {
        method: "PATCH",
        ...json({ isPrimary: true }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /offer-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const res = await app.request(`/offer-travelers/${participant.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /offer-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-travelers/ofpt_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /offer-travelers → list by offerId", async () => {
      const o1 = await seedOffer()
      const o2 = await seedOffer()
      await seedOfferParticipant(o1.id)
      await seedOfferParticipant(o1.id)
      await seedOfferParticipant(o2.id)

      const res = await app.request(`/offer-travelers?offerId=${o1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("stores offer participant travel identity encrypted and keeps generic responses non-sensitive", async () => {
      const offer = await seedOffer()
      const res = await app.request("/offer-travelers", {
        method: "POST",
        ...json({
          offerId: offer.id,
          firstName: "Ana",
          lastName: "Traveler",
          dateOfBirth: "1990-02-03",
          nationality: "RO",
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.hasTravelIdentity).toBe(true)
      expect(body.data).not.toHaveProperty("dateOfBirth")
      expect(body.data).not.toHaveProperty("nationality")

      const [stored] = await db
        .select()
        .from(offerParticipants)
        .where(eq(offerParticipants.id, body.data.id))

      expect(stored.identityEncrypted?.enc).toMatch(/^env:v1:/)
      expect(stored.identityEncrypted?.enc).not.toContain("1990-02-03")

      const detailsRes = await app.request(`/offer-travelers/${body.data.id}/travel-details`)
      expect(detailsRes.status).toBe(200)
      const details = await detailsRes.json()
      expect(details.data.travelerId).toBe(body.data.id)
      expect(details.data.participantId).toBeUndefined()
      expect(details.data.dateOfBirth).toBe("1990-02-03")
      expect(details.data.nationality).toBe("RO")
    })

    it("audits denied offer participant pii reads", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      await app.request(`/offer-travelers/${participant.id}/travel-details`, {
        method: "PATCH",
        ...json({ nationality: "RO" }),
      })

      const restrictedApp = new Hono()
      restrictedApp.use("*", async (c, next) => {
        c.set("db" as never, db)
        c.set("userId" as never, "test-customer-id")
        c.set("actor" as never, "customer")
        await next()
      })
      restrictedApp.route("/", (await import("../../src/routes.js")).transactionsRoutes)

      const denied = await restrictedApp.request(
        `/offer-travelers/${participant.id}/travel-details`,
      )
      expect(denied.status).toBe(403)
      expect(await denied.json()).toMatchObject({
        error: "Forbidden",
        code: "forbidden",
      })

      const rows = await db
        .select()
        .from(transactionPiiAccessLog)
        .where(eq(transactionPiiAccessLog.travelerId, participant.id))

      expect(
        rows.some(
          (row: { outcome: string; reason: string | null; travelerKind: string }) =>
            row.outcome === "denied" &&
            row.reason === "insufficient_scope" &&
            row.travelerKind === "offer",
        ),
      ).toBe(true)
    })
  })

  describe("Offer Staff Assignments", () => {
    it("supports CRUD and filtering on /offer-staff-assignments", async () => {
      const offer = await seedOffer()
      const otherOffer = await seedOffer()
      const offerItem = await seedOfferItem(offer.id)

      const createRes = await app.request("/offer-staff-assignments", {
        method: "POST",
        ...json({
          offerId: offer.id,
          offerItemId: offerItem.id,
          firstName: "Guide",
          lastName: "One",
          role: "service_assignee",
          email: "guide.one@example.com",
          isPrimary: true,
        }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data
      expect(created.id).toMatch(/^ofsa_/)
      expect(created.offerId).toBe(offer.id)
      expect(created.offerItemId).toBe(offerItem.id)

      await app.request("/offer-staff-assignments", {
        method: "POST",
        ...json({
          offerId: otherOffer.id,
          firstName: "Guide",
          lastName: "Two",
          role: "other",
        }),
      })

      const listRes = await app.request(
        `/offer-staff-assignments?offerId=${offer.id}&role=service_assignee`,
      )
      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.total).toBe(1)
      expect(listBody.data[0].id).toBe(created.id)

      const getRes = await app.request(`/offer-staff-assignments/${created.id}`)
      expect(getRes.status).toBe(200)
      expect((await getRes.json()).data.email).toBe("guide.one@example.com")

      const patchRes = await app.request(`/offer-staff-assignments/${created.id}`, {
        method: "PATCH",
        ...json({
          role: "other",
          notes: "Updated guide assignment",
          isPrimary: false,
        }),
      })
      expect(patchRes.status).toBe(200)
      const patched = (await patchRes.json()).data
      expect(patched.role).toBe("other")
      expect(patched.notes).toBe("Updated guide assignment")
      expect(patched.isPrimary).toBe(false)

      const deleteRes = await app.request(`/offer-staff-assignments/${created.id}`, {
        method: "DELETE",
      })
      expect(deleteRes.status).toBe(200)

      const afterDelete = await app.request(`/offer-staff-assignments/${created.id}`)
      expect(afterDelete.status).toBe(404)
    })
  })

  describe("Offer Contact Assignments", () => {
    it("supports CRUD and filtering on /offer-contact-assignments", async () => {
      const offer = await seedOffer()
      const otherOffer = await seedOffer()
      const offerItem = await seedOfferItem(offer.id)

      const createRes = await app.request("/offer-contact-assignments", {
        method: "POST",
        ...json({
          offerId: offer.id,
          offerItemId: offerItem.id,
          firstName: "Mihai",
          lastName: "Booker",
          role: "primary_contact",
          email: "mihai.booker@example.com",
          isPrimary: true,
        }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data
      expect(created.id).toMatch(/^ofca_/)
      expect(created.offerId).toBe(offer.id)
      expect(created.offerItemId).toBe(offerItem.id)

      await app.request("/offer-contact-assignments", {
        method: "POST",
        ...json({
          offerId: otherOffer.id,
          firstName: "Ana",
          lastName: "Contact",
          role: "other",
        }),
      })

      const listRes = await app.request(
        `/offer-contact-assignments?offerId=${offer.id}&role=primary_contact`,
      )
      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.total).toBe(1)
      expect(listBody.data[0].id).toBe(created.id)

      const getRes = await app.request(`/offer-contact-assignments/${created.id}`)
      expect(getRes.status).toBe(200)
      expect((await getRes.json()).data.email).toBe("mihai.booker@example.com")

      const patchRes = await app.request(`/offer-contact-assignments/${created.id}`, {
        method: "PATCH",
        ...json({
          role: "other",
          notes: "Updated contact assignment",
          isPrimary: false,
        }),
      })
      expect(patchRes.status).toBe(200)
      const patched = (await patchRes.json()).data
      expect(patched.role).toBe("other")
      expect(patched.notes).toBe("Updated contact assignment")
      expect(patched.isPrimary).toBe(false)

      const deleteRes = await app.request(`/offer-contact-assignments/${created.id}`, {
        method: "DELETE",
      })
      expect(deleteRes.status).toBe(200)

      const afterDelete = await app.request(`/offer-contact-assignments/${created.id}`)
      expect(afterDelete.status).toBe(404)
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Offer Items
	   ═══════════════════════════════════════════════════════ */
  describe("Offer Items", () => {
    it("POST /offer-items → 201", async () => {
      const offer = await seedOffer()
      const item = await seedOfferItem(offer.id)
      expect(item.id).toMatch(/^ofit_/)
      expect(item.offerId).toBe(offer.id)
      expect(item.itemType).toBe("unit")
      expect(item.status).toBe("draft")
      expect(item.quantity).toBe(1)
    })

    it("GET /offer-items/:id → 200", async () => {
      const offer = await seedOffer()
      const item = await seedOfferItem(offer.id)
      const res = await app.request(`/offer-items/${item.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /offer-items/:id → 404 for missing", async () => {
      const res = await app.request("/offer-items/ofit_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /offer-items/:id → 200", async () => {
      const offer = await seedOffer()
      const item = await seedOfferItem(offer.id)
      const res = await app.request(`/offer-items/${item.id}`, {
        method: "PATCH",
        ...json({ status: "priced", quantity: 3, unitSellAmountCents: 1500 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("priced")
      expect(body.data.quantity).toBe(3)
      expect(body.data.unitSellAmountCents).toBe(1500)
    })

    it("PATCH /offer-items/:id → 404 for missing", async () => {
      const res = await app.request("/offer-items/ofit_nonexistent", {
        method: "PATCH",
        ...json({ quantity: 5 }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /offer-items/:id → 200", async () => {
      const offer = await seedOffer()
      const item = await seedOfferItem(offer.id)
      const res = await app.request(`/offer-items/${item.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /offer-items/:id → 404 for missing", async () => {
      const res = await app.request("/offer-items/ofit_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /offer-items → list by offerId", async () => {
      const offer = await seedOffer()
      await seedOfferItem(offer.id)
      await seedOfferItem(offer.id)

      const res = await app.request(`/offer-items?offerId=${offer.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })

    it("GET /offer-items → filter by status", async () => {
      const offer = await seedOffer()
      await seedOfferItem(offer.id, { status: "draft" })
      await seedOfferItem(offer.id, { status: "priced" })

      const res = await app.request("/offer-items?status=priced")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe("priced")
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Offer Item Participants
	   ═══════════════════════════════════════════════════════ */
  describe("Offer Item Travelers", () => {
    it("POST /offer-item-travelers → 201", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const item = await seedOfferItem(offer.id)
      const link = await seedOfferItemParticipant(item.id, participant.id)
      expect(link.id).toMatch(/^ofip_/)
      expect(link.offerItemId).toBe(item.id)
      expect(link.travelerId).toBe(participant.id)
      expect(link.role).toBe("traveler")
    })

    it("GET /offer-item-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const item = await seedOfferItem(offer.id)
      const link = await seedOfferItemParticipant(item.id, participant.id)
      const res = await app.request(`/offer-item-travelers/${link.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /offer-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-item-travelers/ofip_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /offer-item-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const item = await seedOfferItem(offer.id)
      const link = await seedOfferItemParticipant(item.id, participant.id)
      const res = await app.request(`/offer-item-travelers/${link.id}`, {
        method: "PATCH",
        ...json({ role: "occupant", isPrimary: true }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.role).toBe("occupant")
      expect(body.data.isPrimary).toBe(true)
    })

    it("PATCH /offer-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-item-travelers/ofip_nonexistent", {
        method: "PATCH",
        ...json({ role: "occupant" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /offer-item-travelers/:id → 200", async () => {
      const offer = await seedOffer()
      const participant = await seedOfferParticipant(offer.id)
      const item = await seedOfferItem(offer.id)
      const link = await seedOfferItemParticipant(item.id, participant.id)
      const res = await app.request(`/offer-item-travelers/${link.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /offer-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/offer-item-travelers/ofip_nonexistent", {
        method: "DELETE",
      })
      expect(res.status).toBe(404)
    })

    it("GET /offer-item-travelers → list by offerItemId", async () => {
      const offer = await seedOffer()
      const p1 = await seedOfferParticipant(offer.id)
      const p2 = await seedOfferParticipant(offer.id)
      const item = await seedOfferItem(offer.id)
      await seedOfferItemParticipant(item.id, p1.id)
      await seedOfferItemParticipant(item.id, p2.id)

      const res = await app.request(`/offer-item-travelers?offerItemId=${item.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Orders
	   ═══════════════════════════════════════════════════════ */
  describe("Orders", () => {
    it("POST /orders → 201", async () => {
      const order = await seedOrder()
      expect(order.id).toMatch(/^ord_/)
      expect(order.orderNumber).toMatch(/^ORD-\d{13}-0001$/)
      expect(order.title).toBe("Order 0001")
      expect(order.currency).toBe("USD")
      expect(order.status).toBe("draft")
    })

    it("GET /orders/:id → 200", async () => {
      const order = await seedOrder()
      const res = await app.request(`/orders/${order.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(order.id)
    })

    it("GET /orders/:id → 404 for missing", async () => {
      const res = await app.request("/orders/ord_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /orders/:id → 200", async () => {
      const order = await seedOrder()
      const res = await app.request(`/orders/${order.id}`, {
        method: "PATCH",
        ...json({ title: "Updated Order", status: "confirmed", totalAmountCents: 75000 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.title).toBe("Updated Order")
      expect(body.data.status).toBe("confirmed")
      expect(body.data.totalAmountCents).toBe(75000)
    })

    it("PATCH /orders/:id → 404 for missing", async () => {
      const res = await app.request("/orders/ord_nonexistent", {
        method: "PATCH",
        ...json({ title: "Nope" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /orders/:id → 200", async () => {
      const order = await seedOrder()
      const res = await app.request(`/orders/${order.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
      const get = await app.request(`/orders/${order.id}`)
      expect(get.status).toBe(404)
    })

    it("DELETE /orders/:id → 404 for missing", async () => {
      const res = await app.request("/orders/ord_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /orders → list with pagination", async () => {
      await seedOrder()
      await seedOrder()
      const res = await app.request("/orders?limit=1&offset=0")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(2)
    })

    it("GET /orders → filter by status", async () => {
      await seedOrder({ status: "draft" })
      await seedOrder({ status: "confirmed" })
      const res = await app.request("/orders?status=confirmed")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe("confirmed")
    })

    it("GET /orders → search by title", async () => {
      await seedOrder({ title: "Summer Safari" })
      await seedOrder({ title: "Winter Trip" })
      const res = await app.request("/orders?search=Safari")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].title).toBe("Summer Safari")
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Order Participants
	   ═══════════════════════════════════════════════════════ */
  describe("Order Travelers", () => {
    it("POST /order-travelers → 201", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      expect(participant.id).toMatch(/^orpt_/)
      expect(participant.orderId).toBe(order.id)
      expect(participant.participantType).toBe("traveler")
    })

    it("GET /order-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const res = await app.request(`/order-travelers/${participant.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /order-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-travelers/orpt_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /order-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const res = await app.request(`/order-travelers/${participant.id}`, {
        method: "PATCH",
        ...json({ isPrimary: true, travelerCategory: "child" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.isPrimary).toBe(true)
      expect(body.data.travelerCategory).toBe("child")
    })

    it("PATCH /order-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-travelers/orpt_nonexistent", {
        method: "PATCH",
        ...json({ isPrimary: true }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /order-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const res = await app.request(`/order-travelers/${participant.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /order-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-travelers/orpt_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /order-travelers → list by orderId", async () => {
      const o1 = await seedOrder()
      const o2 = await seedOrder()
      await seedOrderParticipant(o1.id)
      await seedOrderParticipant(o1.id)
      await seedOrderParticipant(o2.id)

      const res = await app.request(`/order-travelers?orderId=${o1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("stores order participant travel identity encrypted and serves it through the dedicated route", async () => {
      const order = await seedOrder()
      const res = await app.request("/order-travelers", {
        method: "POST",
        ...json({
          orderId: order.id,
          firstName: "Mihai",
          lastName: "Traveler",
          dateOfBirth: "1988-01-02",
          nationality: "RO",
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.hasTravelIdentity).toBe(true)
      expect(body.data).not.toHaveProperty("dateOfBirth")
      expect(body.data).not.toHaveProperty("nationality")

      const [stored] = await db
        .select()
        .from(orderParticipants)
        .where(eq(orderParticipants.id, body.data.id))

      expect(stored.identityEncrypted?.enc).toMatch(/^env:v1:/)

      const detailsRes = await app.request(`/order-travelers/${body.data.id}/travel-details`)
      expect(detailsRes.status).toBe(200)
      const details = await detailsRes.json()
      expect(details.data.travelerId).toBe(body.data.id)
      expect(details.data.participantId).toBeUndefined()
      expect(details.data.dateOfBirth).toBe("1988-01-02")
      expect(details.data.nationality).toBe("RO")
    })
  })

  describe("Order Staff Assignments", () => {
    it("supports CRUD and filtering on /order-staff-assignments", async () => {
      const order = await seedOrder()
      const otherOrder = await seedOrder()
      const orderItem = await seedOrderItem(order.id)

      const createRes = await app.request("/order-staff-assignments", {
        method: "POST",
        ...json({
          orderId: order.id,
          orderItemId: orderItem.id,
          firstName: "Driver",
          lastName: "One",
          role: "service_assignee",
          phone: "+40123456789",
          isPrimary: true,
        }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data
      expect(created.id).toMatch(/^orsa_/)
      expect(created.orderId).toBe(order.id)
      expect(created.orderItemId).toBe(orderItem.id)

      await app.request("/order-staff-assignments", {
        method: "POST",
        ...json({
          orderId: otherOrder.id,
          firstName: "Driver",
          lastName: "Two",
          role: "other",
        }),
      })

      const listRes = await app.request(
        `/order-staff-assignments?orderId=${order.id}&role=service_assignee`,
      )
      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.total).toBe(1)
      expect(listBody.data[0].id).toBe(created.id)

      const getRes = await app.request(`/order-staff-assignments/${created.id}`)
      expect(getRes.status).toBe(200)
      expect((await getRes.json()).data.phone).toBe("+40123456789")

      const patchRes = await app.request(`/order-staff-assignments/${created.id}`, {
        method: "PATCH",
        ...json({
          role: "other",
          notes: "Updated driver assignment",
          isPrimary: false,
        }),
      })
      expect(patchRes.status).toBe(200)
      const patched = (await patchRes.json()).data
      expect(patched.role).toBe("other")
      expect(patched.notes).toBe("Updated driver assignment")
      expect(patched.isPrimary).toBe(false)

      const deleteRes = await app.request(`/order-staff-assignments/${created.id}`, {
        method: "DELETE",
      })
      expect(deleteRes.status).toBe(200)

      const afterDelete = await app.request(`/order-staff-assignments/${created.id}`)
      expect(afterDelete.status).toBe(404)
    })
  })

  describe("Order Contact Assignments", () => {
    it("supports CRUD and filtering on /order-contact-assignments", async () => {
      const order = await seedOrder()
      const otherOrder = await seedOrder()
      const orderItem = await seedOrderItem(order.id)

      const createRes = await app.request("/order-contact-assignments", {
        method: "POST",
        ...json({
          orderId: order.id,
          orderItemId: orderItem.id,
          firstName: "Ana",
          lastName: "Contact",
          role: "primary_contact",
          phone: "+40123456789",
          isPrimary: true,
        }),
      })
      expect(createRes.status).toBe(201)
      const created = (await createRes.json()).data
      expect(created.id).toMatch(/^orca_/)
      expect(created.orderId).toBe(order.id)
      expect(created.orderItemId).toBe(orderItem.id)

      await app.request("/order-contact-assignments", {
        method: "POST",
        ...json({
          orderId: otherOrder.id,
          firstName: "Driver",
          lastName: "Two",
          role: "other",
        }),
      })

      const listRes = await app.request(
        `/order-contact-assignments?orderId=${order.id}&role=primary_contact`,
      )
      expect(listRes.status).toBe(200)
      const listBody = await listRes.json()
      expect(listBody.total).toBe(1)
      expect(listBody.data[0].id).toBe(created.id)

      const getRes = await app.request(`/order-contact-assignments/${created.id}`)
      expect(getRes.status).toBe(200)
      expect((await getRes.json()).data.phone).toBe("+40123456789")

      const patchRes = await app.request(`/order-contact-assignments/${created.id}`, {
        method: "PATCH",
        ...json({
          role: "other",
          notes: "Updated order contact assignment",
          isPrimary: false,
        }),
      })
      expect(patchRes.status).toBe(200)
      const patched = (await patchRes.json()).data
      expect(patched.role).toBe("other")
      expect(patched.notes).toBe("Updated order contact assignment")
      expect(patched.isPrimary).toBe(false)

      const deleteRes = await app.request(`/order-contact-assignments/${created.id}`, {
        method: "DELETE",
      })
      expect(deleteRes.status).toBe(200)

      const afterDelete = await app.request(`/order-contact-assignments/${created.id}`)
      expect(afterDelete.status).toBe(404)
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Order Items
	   ═══════════════════════════════════════════════════════ */
  describe("Order Items", () => {
    it("POST /order-items → 201", async () => {
      const order = await seedOrder()
      const item = await seedOrderItem(order.id)
      expect(item.id).toMatch(/^orit_/)
      expect(item.orderId).toBe(order.id)
      expect(item.itemType).toBe("unit")
      expect(item.status).toBe("draft")
    })

    it("GET /order-items/:id → 200", async () => {
      const order = await seedOrder()
      const item = await seedOrderItem(order.id)
      const res = await app.request(`/order-items/${item.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /order-items/:id → 404 for missing", async () => {
      const res = await app.request("/order-items/orit_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /order-items/:id → 200", async () => {
      const order = await seedOrder()
      const item = await seedOrderItem(order.id)
      const res = await app.request(`/order-items/${item.id}`, {
        method: "PATCH",
        ...json({ status: "confirmed", quantity: 2 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.status).toBe("confirmed")
      expect(body.data.quantity).toBe(2)
    })

    it("PATCH /order-items/:id → 404 for missing", async () => {
      const res = await app.request("/order-items/orit_nonexistent", {
        method: "PATCH",
        ...json({ quantity: 5 }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /order-items/:id → 200", async () => {
      const order = await seedOrder()
      const item = await seedOrderItem(order.id)
      const res = await app.request(`/order-items/${item.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /order-items/:id → 404 for missing", async () => {
      const res = await app.request("/order-items/orit_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /order-items → list by orderId", async () => {
      const order = await seedOrder()
      await seedOrderItem(order.id)
      await seedOrderItem(order.id)

      const res = await app.request(`/order-items?orderId=${order.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })

    it("GET /order-items → filter by status", async () => {
      const order = await seedOrder()
      await seedOrderItem(order.id, { status: "draft" })
      await seedOrderItem(order.id, { status: "confirmed" })

      const res = await app.request("/order-items?status=confirmed")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe("confirmed")
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Order Item Participants
	   ═══════════════════════════════════════════════════════ */
  describe("Order Item Travelers", () => {
    it("POST /order-item-travelers → 201", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const item = await seedOrderItem(order.id)
      const link = await seedOrderItemParticipant(item.id, participant.id)
      expect(link.id).toMatch(/^orip_/)
      expect(link.orderItemId).toBe(item.id)
      expect(link.travelerId).toBe(participant.id)
      expect(link.role).toBe("traveler")
    })

    it("GET /order-item-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const item = await seedOrderItem(order.id)
      const link = await seedOrderItemParticipant(item.id, participant.id)
      const res = await app.request(`/order-item-travelers/${link.id}`)
      expect(res.status).toBe(200)
    })

    it("GET /order-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-item-travelers/orip_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /order-item-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const item = await seedOrderItem(order.id)
      const link = await seedOrderItemParticipant(item.id, participant.id)
      const res = await app.request(`/order-item-travelers/${link.id}`, {
        method: "PATCH",
        ...json({ role: "beneficiary", isPrimary: true }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.role).toBe("beneficiary")
      expect(body.data.isPrimary).toBe(true)
    })

    it("PATCH /order-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-item-travelers/orip_nonexistent", {
        method: "PATCH",
        ...json({ role: "occupant" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /order-item-travelers/:id → 200", async () => {
      const order = await seedOrder()
      const participant = await seedOrderParticipant(order.id)
      const item = await seedOrderItem(order.id)
      const link = await seedOrderItemParticipant(item.id, participant.id)
      const res = await app.request(`/order-item-travelers/${link.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /order-item-travelers/:id → 404 for missing", async () => {
      const res = await app.request("/order-item-travelers/orip_nonexistent", {
        method: "DELETE",
      })
      expect(res.status).toBe(404)
    })

    it("GET /order-item-travelers → list by orderItemId", async () => {
      const order = await seedOrder()
      const p1 = await seedOrderParticipant(order.id)
      const p2 = await seedOrderParticipant(order.id)
      const item = await seedOrderItem(order.id)
      await seedOrderItemParticipant(item.id, p1.id)
      await seedOrderItemParticipant(item.id, p2.id)

      const res = await app.request(`/order-item-travelers?orderItemId=${item.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })
  })

  /* ═══════════════════════════════════════════════════════
	   Order Terms
	   ═══════════════════════════════════════════════════════ */
  describe("Order Terms", () => {
    it("POST /order-terms → 201 with orderId", async () => {
      const order = await seedOrder()
      const term = await seedOrderTerm({ orderId: order.id })
      expect(term.id).toMatch(/^ortm_/)
      expect(term.orderId).toBe(order.id)
      expect(term.termType).toBe("terms_and_conditions")
      expect(term.acceptanceStatus).toBe("pending")
      expect(term.required).toBe(true)
    })

    it("POST /order-terms → 201 with offerId", async () => {
      const offer = await seedOffer()
      const term = await seedOrderTerm({ offerId: offer.id })
      expect(term.offerId).toBe(offer.id)
    })

    it("GET /order-terms/:id → 200", async () => {
      const order = await seedOrder()
      const term = await seedOrderTerm({ orderId: order.id })
      const res = await app.request(`/order-terms/${term.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(term.id)
    })

    it("GET /order-terms/:id → 404 for missing", async () => {
      const res = await app.request("/order-terms/ortm_nonexistent")
      expect(res.status).toBe(404)
    })

    it("PATCH /order-terms/:id → 200", async () => {
      const order = await seedOrder()
      const term = await seedOrderTerm({ orderId: order.id })
      const res = await app.request(`/order-terms/${term.id}`, {
        method: "PATCH",
        ...json({
          termType: "cancellation",
          acceptanceStatus: "accepted",
          title: "Updated Term",
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.termType).toBe("cancellation")
      expect(body.data.acceptanceStatus).toBe("accepted")
      expect(body.data.title).toBe("Updated Term")
    })

    it("PATCH /order-terms/:id → 404 for missing", async () => {
      const res = await app.request("/order-terms/ortm_nonexistent", {
        method: "PATCH",
        ...json({ title: "Nope" }),
      })
      expect(res.status).toBe(404)
    })

    it("DELETE /order-terms/:id → 200", async () => {
      const order = await seedOrder()
      const term = await seedOrderTerm({ orderId: order.id })
      const res = await app.request(`/order-terms/${term.id}`, { method: "DELETE" })
      expect(res.status).toBe(200)
    })

    it("DELETE /order-terms/:id → 404 for missing", async () => {
      const res = await app.request("/order-terms/ortm_nonexistent", { method: "DELETE" })
      expect(res.status).toBe(404)
    })

    it("GET /order-terms → list by orderId", async () => {
      const o1 = await seedOrder()
      const o2 = await seedOrder()
      await seedOrderTerm({ orderId: o1.id })
      await seedOrderTerm({ orderId: o1.id })
      await seedOrderTerm({ orderId: o2.id })

      const res = await app.request(`/order-terms?orderId=${o1.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.total).toBe(2)
    })

    it("GET /order-terms → filter by termType", async () => {
      const order = await seedOrder()
      await seedOrderTerm({ orderId: order.id }, { termType: "terms_and_conditions" })
      await seedOrderTerm({ orderId: order.id }, { termType: "cancellation" })

      const res = await app.request("/order-terms?termType=cancellation")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].termType).toBe("cancellation")
    })

    it("GET /order-terms → filter by acceptanceStatus", async () => {
      const order = await seedOrder()
      await seedOrderTerm({ orderId: order.id }, { acceptanceStatus: "pending" })
      await seedOrderTerm({ orderId: order.id }, { acceptanceStatus: "accepted" })

      const res = await app.request("/order-terms?acceptanceStatus=accepted")
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].acceptanceStatus).toBe("accepted")
    })
  })
})
