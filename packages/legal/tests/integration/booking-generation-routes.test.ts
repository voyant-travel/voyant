import { bookings } from "@voyantjs/bookings/schema"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createContractsAdminRoutes } from "../../src/contracts/routes.js"
import {
  contractAttachments,
  contractNumberSeries,
  contracts,
  contractTemplates,
  contractTemplateVersions,
} from "../../src/contracts/schema.js"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

describe.skipIf(!DB_AVAILABLE)("booking contract generation routes", () => {
  let adminApp: Hono
  let db: PostgresJsDatabase
  let generatedNames: string[]

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyantjs/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)

    adminApp = new Hono()
    adminApp.use("*", async (c, next) => {
      c.set("db" as never, db)
      await next()
    })
    adminApp.route(
      "/",
      createContractsAdminRoutes({
        documentGenerator: async ({ contract }) => {
          const name = `contract-${generatedNames.length + 1}.pdf`
          generatedNames.push(name)
          return {
            kind: "document",
            name,
            mimeType: "application/pdf",
            fileSize: 1024,
            storageKey: `contracts/${contract.id}/${name}`,
            metadata: { source: "legal-test" },
          }
        },
      }),
    )
  })

  beforeEach(async () => {
    const { cleanupTestDb } = await import("@voyantjs/db/test-utils")
    await cleanupTestDb(db)
    generatedNames = []
  })

  it("generates a booking contract from the default template and active series", async () => {
    const [template] = await db
      .insert(contractTemplates)
      .values({
        name: "Default Customer Contract",
        slug: "default-customer-contract",
        scope: "customer",
        language: "en",
        body: "Contract for {{ booking.number }}",
        active: true,
        isDefault: true,
      })
      .returning()

    const [version] = await db
      .insert(contractTemplateVersions)
      .values({
        templateId: template.id,
        version: 1,
        body: "Contract for {{ booking.number }}",
      })
      .returning()

    await db
      .update(contractTemplates)
      .set({ currentVersionId: version.id })
      .where(eq(contractTemplates.id, template.id))

    await db.insert(contractNumberSeries).values({
      name: "Customer Contracts",
      prefix: "CC",
      separator: "-",
      padLength: 4,
      resetStrategy: "never",
      scope: "customer",
      active: true,
    })

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: "BK-ROUTE-001",
        status: "confirmed",
        sellCurrency: "EUR",
        sellAmountCents: 125000,
        startDate: "2026-07-01",
        pax: 2,
      })
      .returning()

    const res = await adminApp.request(`/bookings/${booking.id}/generate-document`, {
      method: "POST",
      ...json({}),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.contract).toMatchObject({
      bookingId: booking.id,
      status: "issued",
      templateVersionId: version.id,
      contractNumber: "CC-0001",
    })
    expect(body.data.attachment).toMatchObject({
      contractId: body.data.contract.id,
      kind: "document",
      name: "contract-1.pdf",
    })
    expect(body.data.contract.renderedBody).toBe("Contract for BK-ROUTE-001")
  })

  it("does not reuse an existing contract from another scope", async () => {
    const [template] = await db
      .insert(contractTemplates)
      .values({
        name: "Default Supplier Contract",
        slug: "default-supplier-contract",
        scope: "supplier",
        language: "en",
        body: "Supplier contract for {{ booking.number }}",
        active: true,
        isDefault: true,
      })
      .returning()

    const [version] = await db
      .insert(contractTemplateVersions)
      .values({
        templateId: template.id,
        version: 1,
        body: "Supplier contract for {{ booking.number }}",
      })
      .returning()

    await db
      .update(contractTemplates)
      .set({ currentVersionId: version.id })
      .where(eq(contractTemplates.id, template.id))

    await db.insert(contractNumberSeries).values({
      name: "Supplier Contracts",
      prefix: "SC",
      separator: "-",
      padLength: 4,
      resetStrategy: "never",
      scope: "supplier",
      active: true,
    })

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: "BK-ROUTE-002",
        status: "confirmed",
        sellCurrency: "EUR",
        sellAmountCents: 125000,
        startDate: "2026-07-01",
        pax: 2,
      })
      .returning()

    const [customerContract] = await db
      .insert(contracts)
      .values({
        title: "Existing customer contract",
        scope: "customer",
        status: "issued",
        bookingId: booking.id,
      })
      .returning()

    await db.insert(contractAttachments).values({
      contractId: customerContract.id,
      kind: "document",
      name: "customer-contract.pdf",
    })

    const res = await adminApp.request(`/bookings/${booking.id}/generate-document`, {
      method: "POST",
      ...json({ scope: "supplier" }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.contract).toMatchObject({
      bookingId: booking.id,
      scope: "supplier",
      status: "issued",
      templateVersionId: version.id,
      contractNumber: "SC-0001",
    })
    expect(body.data.contract.id).not.toBe(customerContract.id)

    const rows = await db.select().from(contracts).where(eq(contracts.bookingId, booking.id))
    expect(rows.map((row) => row.scope).sort()).toEqual(["customer", "supplier"])
  })
})
