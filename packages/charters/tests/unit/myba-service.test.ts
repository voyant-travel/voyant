import { describe, expect, it } from "vitest"

import type { BookingCharterDetail } from "../../src/booking-extension.js"
import { type CharterContractsService, mybaService } from "../../src/service-myba.js"

/**
 * Tiny in-memory shim for the parts of the drizzle DB the MYBA service
 * calls. We only exercise the chained `select().from().where().limit()`
 * read used to fetch the detail row + the chained
 * `update().set().where().returning()` used to write back the
 * mybaContractId. Mirrors the behavior closely enough that we don't
 * need a real Postgres for unit-level coverage.
 */
function fakeDb(initial: BookingCharterDetail | null) {
  let row = initial
  const db = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  return Promise.resolve(row ? [row] : [])
                },
              }
            },
          }
        },
      }
    },
    update() {
      return {
        set(patch: Partial<BookingCharterDetail>) {
          return {
            where() {
              return {
                returning() {
                  if (!row) return Promise.resolve([])
                  row = { ...row, ...patch } as BookingCharterDetail
                  return Promise.resolve([row])
                },
              }
            },
          }
        },
      }
    },
  } as Parameters<typeof mybaService.generateContract>[0]
  return { db, peek: () => row }
}

const baseDetail: BookingCharterDetail = {
  bookingId: "book_abc123",
  bookingMode: "whole_yacht",
  source: "local",
  sourceProvider: null,
  sourceRef: null,
  voyageId: "chrv_voy",
  suiteId: null,
  yachtId: "chry_yat",
  voyageDisplayName: "Mediterranean Spring",
  suiteDisplayName: null,
  yachtName: "M/Y Test",
  charterAreaSnapshot: "Western Mediterranean",
  guestCount: 8,
  quotedCurrency: "EUR",
  quotedSuitePrice: null,
  quotedPortFee: null,
  quotedCharterFee: "5000000.00",
  apaPercent: "30.00",
  apaAmount: "1500000.00",
  quotedTotal: "6500000.00",
  mybaTemplateIdSnapshot: "ctpl_default",
  mybaContractId: null,
  apaPaidAmount: "0.00",
  apaSpentAmount: "0.00",
  apaRefundAmount: "0.00",
  apaSettledAt: null,
  connectorBookingRef: null,
  connectorStatus: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeContractsService(
  overrides: Partial<CharterContractsService> = {},
): CharterContractsService {
  const defaults: CharterContractsService = {
    getDefaultTemplate: async () => ({
      id: "ctpl_default",
      currentVersionId: "ctv_1",
      slug: "myba",
    }),
    getTemplateById: async (_db, id) => ({ id, currentVersionId: "ctv_99", slug: "explicit" }),
    createContract: async () => ({ id: "cont_generated" }),
  }
  return { ...defaults, ...overrides }
}

describe("mybaService.generateContract", () => {
  it("returns not_found when the booking has no charter detail row", async () => {
    const { db } = fakeDb(null)
    const result = await mybaService.generateContract(db, makeContractsService(), {
      bookingId: "book_missing",
    })
    expect(result.status).toBe("not_found")
  })

  it("returns wrong_mode for per_suite bookings", async () => {
    const { db } = fakeDb({ ...baseDetail, bookingMode: "per_suite" })
    const result = await mybaService.generateContract(db, makeContractsService(), {
      bookingId: baseDetail.bookingId,
    })
    expect(result.status).toBe("wrong_mode")
  })

  it("returns ok with existing contractId when already generated (idempotent)", async () => {
    const { db } = fakeDb({ ...baseDetail, mybaContractId: "cont_existing" })
    const result = await mybaService.generateContract(db, makeContractsService(), {
      bookingId: baseDetail.bookingId,
    })
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.contractId).toBe("cont_existing")
  })

  it("uses snapshotted templateId by default", async () => {
    const { db } = fakeDb(baseDetail)
    let askedTemplateId: string | null = null
    const result = await mybaService.generateContract(
      db,
      makeContractsService({
        getTemplateById: async (_db, id) => {
          askedTemplateId = id
          return { id, currentVersionId: "ctv_snap", slug: "snapshot-template" }
        },
      }),
      { bookingId: baseDetail.bookingId },
    )
    expect(result.status).toBe("ok")
    expect(askedTemplateId).toBe("ctpl_default")
  })

  it("falls back to default template when no snapshot is present", async () => {
    const { db } = fakeDb({ ...baseDetail, mybaTemplateIdSnapshot: null })
    let defaultRequested = false
    const result = await mybaService.generateContract(
      db,
      makeContractsService({
        getDefaultTemplate: async () => {
          defaultRequested = true
          return { id: "ctpl_fallback", currentVersionId: "ctv_fb", slug: "myba" }
        },
      }),
      { bookingId: baseDetail.bookingId },
    )
    expect(result.status).toBe("ok")
    expect(defaultRequested).toBe(true)
  })

  it("returns no_template when neither snapshot nor default exists", async () => {
    const { db } = fakeDb({ ...baseDetail, mybaTemplateIdSnapshot: null })
    const result = await mybaService.generateContract(
      db,
      makeContractsService({ getDefaultTemplate: async () => null }),
      { bookingId: baseDetail.bookingId },
    )
    expect(result.status).toBe("no_template")
  })

  it("returns template_not_found when the snapshotted templateId no longer resolves", async () => {
    const { db } = fakeDb(baseDetail)
    const result = await mybaService.generateContract(
      db,
      makeContractsService({ getTemplateById: async () => null }),
      { bookingId: baseDetail.bookingId },
    )
    expect(result.status).toBe("template_not_found")
    if (result.status === "template_not_found") expect(result.templateId).toBe("ctpl_default")
  })

  it("explicit templateIdOverride wins over snapshot", async () => {
    const { db } = fakeDb(baseDetail)
    let askedTemplateId: string | null = null
    const result = await mybaService.generateContract(
      db,
      makeContractsService({
        getTemplateById: async (_db, id) => {
          askedTemplateId = id
          return { id, currentVersionId: "ctv_o", slug: "override" }
        },
      }),
      { bookingId: baseDetail.bookingId, templateIdOverride: "ctpl_override" },
    )
    expect(result.status).toBe("ok")
    expect(askedTemplateId).toBe("ctpl_override")
  })

  it("passes booking variables (currency, charterFee, apa…) into createContract", async () => {
    const { db } = fakeDb(baseDetail)
    let receivedVars: Record<string, unknown> | undefined
    await mybaService.generateContract(
      db,
      makeContractsService({
        createContract: async (_db, data) => {
          receivedVars = data.variables ?? undefined
          return { id: "cont_xyz" }
        },
      }),
      {
        bookingId: baseDetail.bookingId,
        extraVariables: { brokerCommissionPercent: "20.00" },
      },
    )
    expect(receivedVars).toMatchObject({
      bookingId: baseDetail.bookingId,
      currency: "EUR",
      charterFee: "5000000.00",
      apaPercent: "30.00",
      apaAmount: "1500000.00",
      total: "6500000.00",
      brokerCommissionPercent: "20.00",
    })
  })

  it("writes the new contractId back into booking_charter_details", async () => {
    const { db, peek } = fakeDb(baseDetail)
    const result = await mybaService.generateContract(
      db,
      makeContractsService({ createContract: async () => ({ id: "cont_new" }) }),
      { bookingId: baseDetail.bookingId },
    )
    expect(result.status).toBe("ok")
    expect(peek()?.mybaContractId).toBe("cont_new")
  })
})
