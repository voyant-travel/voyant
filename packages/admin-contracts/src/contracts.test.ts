import { describe, expect, it } from "vitest"

import {
  allOperations,
  bookingsOperations,
  crmOperations,
  deploymentCapabilitiesSchema,
  financeOperations,
  getOperation,
  type InferInput,
  type InferOutput,
  legalOperations,
  operationCapabilities,
  productsOperations,
} from "./index.js"

describe("@voyantjs/admin-contracts operation descriptors", () => {
  it("applies defineOperation defaults (inputLocation / envelope / idempotent)", () => {
    const get = bookingsOperations.get
    expect(get.inputLocation).toBe("query") // GET → query
    expect(get.envelope).toBe("data")
    expect(get.idempotent).toBe(false)

    const confirm = bookingsOperations.confirm
    expect(confirm.inputLocation).toBe("body") // POST → body
    expect(confirm.idempotent).toBe(true)
    expect(confirm.classification).toBe("requires_confirmation")
    expect(confirm.capabilityKey).toBe("booking.status.confirm")
  })

  it("builds paths from params and exposes stable templates", () => {
    expect(bookingsOperations.confirm.path({ id: "book_123" })).toBe(
      "/v1/admin/bookings/book_123/confirm",
    )
    expect(bookingsOperations.confirm.pathTemplate).toBe("/v1/admin/bookings/:id/confirm")
    expect(financeOperations.payments.record.path({ id: "inv_9" })).toBe(
      "/v1/admin/finance/invoices/inv_9/payments",
    )
  })

  it("validates input against the operation schema", () => {
    type ConfirmInput = InferInput<typeof bookingsOperations.confirm>
    const input: ConfirmInput = { note: "ok", suppressNotifications: true }
    expect(bookingsOperations.confirm.input.parse(input)).toMatchObject({ note: "ok" })

    const bad = financeOperations.payments.record.input.safeParse({
      amountCents: -1,
      currency: "EUR",
      paymentMethod: "cash",
      paymentDate: "2026-06-01",
    })
    expect(bad.success).toBe(false) // negative amount rejected
  })

  it("parses a list (raw envelope) and a single (data envelope) output shape", () => {
    const list: InferOutput<typeof bookingsOperations.list> = bookingsOperations.list.output.parse({
      data: [
        {
          id: "book_1",
          bookingNumber: "B-1",
          status: "confirmed",
          createdAt: "2026-06-01T00:00:00Z",
          updatedAt: "2026-06-01T00:00:00Z",
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    })
    expect(list.data[0]?.bookingNumber).toBe("B-1")
    expect(bookingsOperations.list.envelope).toBe("raw")

    const invoice = financeOperations.invoices.get.output.parse({
      id: "inv_1",
      invoiceNumber: "INV-1",
      invoiceType: "invoice",
      status: "issued",
      bookingId: "book_1",
      currency: "EUR",
      totalCents: 10000,
      paidCents: 0,
      balanceDueCents: 10000,
      issueDate: "2026-06-01",
      dueDate: "2026-06-30",
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
    })
    expect(invoice.invoiceType).toBe("invoice")
  })
})

describe("@voyantjs/admin-contracts registry", () => {
  it("flattens every domain operation and looks them up by id", () => {
    const ids = allOperations.map((op) => op.id)
    // Spot-check representative ids per domain rather than a brittle exact list
    // (the catalogue grows). Uniqueness/well-formedness is covered by
    // consistency.test.ts.
    for (const id of [
      "bookings.list",
      "bookings.confirm",
      "finance.invoices.get",
      "finance.payments.record",
      "crm.people.list",
      "crm.people.create",
      "crm.people.documents.reveal",
      "crm.organizations.delete",
      "legal.contracts.create",
      "legal.contracts.void",
      "legal.policies.evaluate",
      "products.list",
      "products.get",
    ]) {
      expect(ids, id).toContain(id)
    }
    expect(getOperation("finance.payments.record")?.scopes).toEqual(["finance:write"])
    expect(getOperation("crm.people.documents.reveal")?.scopes).toEqual([
      "crm:read",
      "crm-pii:read",
    ])
    expect(getOperation("crm.people.delete")?.scopes).toEqual(["crm:delete"])
    expect(getOperation("nope.missing")).toBeUndefined()
  })

  it("list inputs match the real route filters (no advertised-but-stripped fields)", () => {
    // Legal policies: the route accepts kind/language/search — NOT status.
    // A descriptor that advertised `status` would silently strip it server-side.
    const policyList = legalOperations.policies.list.input.parse({
      language: "en",
      search: "refund",
      status: "active",
    }) as Record<string, unknown>
    expect(policyList.language).toBe("en")
    expect(policyList.search).toBe("refund")
    expect("status" in policyList).toBe(false)

    // Legal contracts derive the full route filter set (scope/supplierId/etc.).
    const contractList = legalOperations.contracts.list.input.parse({
      scope: "customer",
      supplierId: "supp_1",
    }) as Record<string, unknown>
    expect(contractList.supplierId).toBe("supp_1")

    // CRM people derive organizationId + search from the route schema.
    const peopleList = crmOperations.people.list.input.parse({
      organizationId: "org_1",
      search: "ada",
    }) as Record<string, unknown>
    expect(peopleList.organizationId).toBe("org_1")

    // Products: the filter field is `productTypeId`, not `productType`.
    const productList = productsOperations.list.input.parse({
      productTypeId: "ptype_1",
    }) as Record<string, unknown>
    expect(productList.productTypeId).toBe("ptype_1")
  })

  it("projects to a deployment capability descriptor", () => {
    const capabilities = {
      contractVersion: "0.1.0",
      modules: ["bookings", "finance"],
      operations: operationCapabilities(),
    }
    expect(deploymentCapabilitiesSchema.safeParse(capabilities).success).toBe(true)
    const confirm = capabilities.operations.find((o) => o.id === "bookings.confirm")
    expect(confirm).toMatchObject({
      method: "POST",
      pathTemplate: "/v1/admin/bookings/:id/confirm",
      classification: "requires_confirmation",
    })
  })
})
