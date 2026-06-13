import { sql } from "drizzle-orm"
import { Hono } from "hono"
import { afterAll, beforeAll, beforeEach, expect } from "vitest"

export const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL
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

export const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

let seq = 0
export function nextSeq() {
  seq++
  return String(seq).padStart(4, "0")
}

export function nextRef(prefix: string, seq: string) {
  const s = seq
  return `${prefix}-${Date.now()}-${s}`
}

async function cleanupTransactionsTestData(
  // biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: transactions; existing suppression is intentional pending typed cleanup.
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

export let app: Hono
// biome-ignore lint/suspicious/noExplicitAny: test db typing -- owner: transactions; existing suppression is intentional pending typed cleanup.
export let db: any

export function registerTransactionsRoutesTestHooks() {
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
}

export async function seedOffer(overrides: Record<string, unknown> = {}) {
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

export async function seedOfferParticipant(
  offerId: string,
  overrides: Record<string, unknown> = {},
) {
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

export async function seedOfferItem(offerId: string, overrides: Record<string, unknown> = {}) {
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

export async function seedOfferItemParticipant(
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

export async function seedOrder(overrides: Record<string, unknown> = {}) {
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

export async function seedOrderParticipant(
  orderId: string,
  overrides: Record<string, unknown> = {},
) {
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

export async function seedOrderItem(orderId: string, overrides: Record<string, unknown> = {}) {
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

export async function seedOrderItemParticipant(
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

export async function seedOrderTerm(
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
