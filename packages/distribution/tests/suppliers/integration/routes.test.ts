import {
  supplierAvailability,
  supplierContracts,
  supplierRates,
  supplierServices,
  suppliersHonoModule,
} from "@voyant-travel/distribution"
import { handleApiError } from "@voyant-travel/hono"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL

describe.skipIf(!DB_AVAILABLE)("Supplier routes", () => {
  let app: Hono
  let db: PostgresJsDatabase

  beforeAll(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    db = createTestDb()
    await cleanupTestDb(db)

    app = new Hono()
    app.onError(handleApiError)
    app.use("*", async (c, next) => {
      c.set("db" as never, db)
      c.set("userId" as never, "test-user-id")
      await next()
    })
    app.route("/", suppliersHonoModule.adminRoutes)
  })

  beforeEach(async () => {
    const { createTestDb, cleanupTestDb } = await import("@voyant-travel/db/test-utils")
    await cleanupTestDb(createTestDb())
  })

  it("creates a supplier", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Hotel",
        type: "hotel",
        status: "active",
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe("Test Hotel")
  })

  it("round-trips supplier reservation timeout", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Timed Supplier",
        type: "experience",
        status: "active",
        reservationTimeoutMinutes: 18,
      }),
    })

    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    expect(created.data.reservationTimeoutMinutes).toBe(18)

    const updateRes = await app.request(`/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationTimeoutMinutes: 0 }),
    })

    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.data.reservationTimeoutMinutes).toBe(0)
  })

  it("does not apply insert defaults on empty supplier patches", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Pending Tagged Supplier",
        type: "experience",
        status: "pending",
        tags: ["preferred"],
      }),
    })

    expect(createRes.status).toBe(201)
    const created = await createRes.json()

    const updateRes = await app.request(`/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })

    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.data.status).toBe("pending")
    expect(updated.data.tags).toEqual(["preferred"])
  })

  it("clears supplier identity projection fields with explicit nulls", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Clearable Supplier",
        type: "experience",
        status: "active",
        email: "ops@clearable.example",
        phone: "+40700000000",
        website: "https://clearable.example",
        address: "Projection Street 1",
        city: "Cluj-Napoca",
        country: "RO",
        contactName: "Projection Ops",
        contactEmail: "contact@clearable.example",
        contactPhone: "+40700000001",
      }),
    })

    expect(createRes.status).toBe(201)
    const created = await createRes.json()

    const updateRes = await app.request(`/${created.data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: null,
        phone: null,
        website: null,
        address: null,
        city: null,
        country: null,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
      }),
    })

    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.data).toMatchObject({
      email: null,
      phone: null,
      website: null,
      address: null,
      city: null,
      country: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
    })

    const getRes = await app.request(`/${created.data.id}`, { method: "GET" })

    expect(getRes.status).toBe(200)
    const retrieved = await getRes.json()
    expect(retrieved.data).toMatchObject({
      email: null,
      phone: null,
      website: null,
      address: null,
      city: null,
      country: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
    })
  })

  it("does not delete unmanaged contact points when clearing top-level supplier fields", async () => {
    const supplier = await createSupplier("Unmanaged Contact Supplier")

    const createContactPointRes = await app.request(`/${supplier.id}/contact-points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "email",
        label: "primary",
        value: "unmanaged@example.test",
        normalizedValue: "unmanaged@example.test",
        isPrimary: true,
        metadata: { source: "manual" },
      }),
    })

    expect(createContactPointRes.status).toBe(201)
    const createdContactPoint = await createContactPointRes.json()

    const updateRes = await app.request(`/${supplier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: null }),
    })

    expect(updateRes.status).toBe(200)

    const listContactPointsRes = await app.request(`/${supplier.id}/contact-points`, {
      method: "GET",
    })

    expect(listContactPointsRes.status).toBe(200)
    const contactPoints = await listContactPointsRes.json()
    expect(contactPoints.data).toEqual([
      expect.objectContaining({
        id: createdContactPoint.data.id,
        value: "unmanaged@example.test",
        metadata: { source: "manual" },
      }),
    ])
  })

  it("lists suppliers", async () => {
    const res = await app.request("/", { method: "GET" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeInstanceOf(Array)
  })

  it("rejects invalid supplier availability dates before writing", async () => {
    const supplier = await createSupplier("Invalid Availability Supplier")

    const res = await app.request(`/${supplier.id}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "not-a-date", available: true }),
    })

    expect(res.status).toBe(400)

    const rows = await db
      .select()
      .from(supplierAvailability)
      .where(eq(supplierAvailability.supplierId, supplier.id))
    expect(rows).toHaveLength(0)
  })

  it("upserts duplicate supplier availability dates with the latest values", async () => {
    const supplier = await createSupplier("Upsert Availability Supplier")

    const createRes = await app.request(`/${supplier.id}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { date: "2026-07-02", available: true, notes: "first state" },
        { date: "2026-07-02", available: false, notes: "latest state" },
      ]),
    })

    expect(createRes.status).toBe(201)
    const created = await createRes.json()
    expect(created.data).toHaveLength(1)
    expect(created.data[0]).toMatchObject({
      date: "2026-07-02",
      available: false,
      notes: "latest state",
    })

    const updateRes = await app.request(`/${supplier.id}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2026-07-02", available: true, notes: "replacement state" }),
    })

    expect(updateRes.status).toBe(201)
    const updated = await updateRes.json()
    expect(updated.data).toHaveLength(1)
    expect(updated.data[0]).toMatchObject({
      date: "2026-07-02",
      available: true,
      notes: "replacement state",
    })

    const listRes = await app.request(`/${supplier.id}/availability`, { method: "GET" })

    expect(listRes.status).toBe(200)
    const listed = await listRes.json()
    expect(listed.data).toHaveLength(1)
    expect(listed.data[0]).toMatchObject({
      date: "2026-07-02",
      available: true,
      notes: "replacement state",
    })
  })

  it("returns not found for empty availability batches on missing suppliers", async () => {
    const res = await app.request("/supplier_missing/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    })

    expect(res.status).toBe(404)
  })

  it("searches suppliers through the supplier directory projection", async () => {
    const createRes = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Projection Tours",
        type: "experience",
        status: "active",
        email: "ops@projection.example",
        address: "Projection Street 1",
        city: "Cluj-Napoca",
        country: "RO",
        contactName: "Projection Ops",
        contactEmail: "contact@projection.example",
      }),
    })

    expect(createRes.status).toBe(201)

    const res = await app.request("/?search=projection%20ops", { method: "GET" })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.name).toBe("Projection Tours")
    expect(body.data[0]?.contactEmail).toBe("contact@projection.example")
  })

  it("rejects partial rate updates that would reverse existing ranges", async () => {
    const supplier = await createSupplier("Partial Rate Range Supplier")
    const service = await createService(supplier.id, "Partial rate service")
    const rate = await createRate(supplier.id, service.id, "Partial range rate", {
      validFrom: "2026-09-01",
      validTo: "2026-09-10",
      minPax: 2,
      maxPax: 8,
    })

    const invalidDateRes = await app.request(
      `/${supplier.id}/services/${service.id}/rates/${rate.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validTo: "2026-08-31" }),
      },
    )

    expect(invalidDateRes.status).toBe(400)

    const invalidPaxRes = await app.request(
      `/${supplier.id}/services/${service.id}/rates/${rate.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minPax: 9 }),
      },
    )

    expect(invalidPaxRes.status).toBe(400)

    const [row] = await db.select().from(supplierRates).where(eq(supplierRates.id, rate.id))
    expect(row).toMatchObject({
      validFrom: "2026-09-01",
      validTo: "2026-09-10",
      minPax: 2,
      maxPax: 8,
    })
  })

  it("rejects partial contract updates that would reverse existing terms", async () => {
    const supplier = await createSupplier("Partial Contract Range Supplier")
    const contract = await createContract(supplier.id, "AGR-PARTIAL", {
      startDate: "2026-07-01",
      endDate: "2026-12-31",
      renewalDate: "2026-10-01",
    })

    const invalidEndRes = await app.request(`/${supplier.id}/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: "2026-06-30" }),
    })

    expect(invalidEndRes.status).toBe(400)

    const invalidRenewalRes = await app.request(`/${supplier.id}/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ renewalDate: "2027-01-01" }),
    })

    expect(invalidRenewalRes.status).toBe(400)

    const [row] = await db
      .select()
      .from(supplierContracts)
      .where(eq(supplierContracts.id, contract.id))
    expect(row).toMatchObject({
      startDate: "2026-07-01",
      endDate: "2026-12-31",
      renewalDate: "2026-10-01",
    })
  })

  it("rejects service mutations through the wrong supplier path without changing the service", async () => {
    const supplierA = await createSupplier("Service Supplier A")
    const supplierB = await createSupplier("Service Supplier B")
    const service = await createService(supplierA.id, "Original service")

    const updateRes = await app.request(`/${supplierB.id}/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Wrong supplier update" }),
    })

    expect(updateRes.status).toBe(404)

    const [updatedRow] = await db
      .select()
      .from(supplierServices)
      .where(eq(supplierServices.id, service.id))
    expect(updatedRow?.name).toBe("Original service")

    const deleteRes = await app.request(`/${supplierB.id}/services/${service.id}`, {
      method: "DELETE",
    })

    expect(deleteRes.status).toBe(404)

    const [deletedRow] = await db
      .select()
      .from(supplierServices)
      .where(eq(supplierServices.id, service.id))
    expect(deletedRow?.name).toBe("Original service")
  })

  it("rejects rate mutations through the wrong parent path without changing the rate", async () => {
    const supplierA = await createSupplier("Rate Supplier A")
    const supplierB = await createSupplier("Rate Supplier B")
    const service = await createService(supplierA.id, "Rate service")
    const otherService = await createService(supplierA.id, "Other rate service")
    const rate = await createRate(supplierA.id, service.id, "Original rate")

    const wrongSupplierUpdateRes = await app.request(
      `/${supplierB.id}/services/${service.id}/rates/${rate.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Wrong supplier rate update", amountCents: 9900 }),
      },
    )

    expect(wrongSupplierUpdateRes.status).toBe(404)

    const [wrongSupplierRow] = await db
      .select()
      .from(supplierRates)
      .where(eq(supplierRates.id, rate.id))
    expect(wrongSupplierRow?.name).toBe("Original rate")
    expect(wrongSupplierRow?.amountCents).toBe(4500)

    const wrongServiceUpdateRes = await app.request(
      `/${supplierA.id}/services/${otherService.id}/rates/${rate.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Wrong service rate update", amountCents: 8800 }),
      },
    )

    expect(wrongServiceUpdateRes.status).toBe(404)

    const [wrongServiceRow] = await db
      .select()
      .from(supplierRates)
      .where(eq(supplierRates.id, rate.id))
    expect(wrongServiceRow?.name).toBe("Original rate")
    expect(wrongServiceRow?.amountCents).toBe(4500)

    const wrongSupplierDeleteRes = await app.request(
      `/${supplierB.id}/services/${service.id}/rates/${rate.id}`,
      { method: "DELETE" },
    )

    expect(wrongSupplierDeleteRes.status).toBe(404)

    const wrongServiceDeleteRes = await app.request(
      `/${supplierA.id}/services/${otherService.id}/rates/${rate.id}`,
      { method: "DELETE" },
    )

    expect(wrongServiceDeleteRes.status).toBe(404)

    const [deletedRow] = await db.select().from(supplierRates).where(eq(supplierRates.id, rate.id))
    expect(deletedRow?.name).toBe("Original rate")
  })

  it("rejects contract mutations through the wrong supplier path without changing the contract", async () => {
    const supplierA = await createSupplier("Contract Supplier A")
    const supplierB = await createSupplier("Contract Supplier B")
    const contract = await createContract(supplierA.id, "AGR-ORIGINAL")

    const updateRes = await app.request(`/${supplierB.id}/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreementNumber: "AGR-WRONG", status: "terminated" }),
    })

    expect(updateRes.status).toBe(404)

    const [updatedRow] = await db
      .select()
      .from(supplierContracts)
      .where(eq(supplierContracts.id, contract.id))
    expect(updatedRow?.agreementNumber).toBe("AGR-ORIGINAL")
    expect(updatedRow?.status).toBe("active")

    const deleteRes = await app.request(`/${supplierB.id}/contracts/${contract.id}`, {
      method: "DELETE",
    })

    expect(deleteRes.status).toBe(404)

    const [deletedRow] = await db
      .select()
      .from(supplierContracts)
      .where(eq(supplierContracts.id, contract.id))
    expect(deletedRow?.agreementNumber).toBe("AGR-ORIGINAL")
  })

  async function createSupplier(name: string) {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "experience", status: "active" }),
    })

    expect(res.status).toBe(201)
    return (await res.json()).data as { id: string }
  }

  async function createService(supplierId: string, name: string) {
    const res = await app.request(`/${supplierId}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceType: "experience", name }),
    })

    expect(res.status).toBe(201)
    return (await res.json()).data as { id: string }
  }

  async function createRate(
    supplierId: string,
    serviceId: string,
    name: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await app.request(`/${supplierId}/services/${serviceId}/rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        currency: "EUR",
        amountCents: 4500,
        unit: "per_person",
        ...overrides,
      }),
    })

    expect(res.status).toBe(201)
    return (await res.json()).data as { id: string }
  }

  async function createContract(
    supplierId: string,
    agreementNumber: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await app.request(`/${supplierId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agreementNumber,
        startDate: "2026-01-01",
        status: "active",
        ...overrides,
      }),
    })

    expect(res.status).toBe(201)
    return (await res.json()).data as { id: string }
  }
})
