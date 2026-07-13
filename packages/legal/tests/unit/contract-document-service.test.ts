import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AutoGenerateContractOptions } from "../../src/contracts/service-auto-generate-types.js"

// Mock the auto-generate pipeline so the test exercises the service
// orchestration (generator resolution, series seeding, booking lookup, result
// mapping) without a real database or template render.
const autoGenerateContractForBooking = vi.fn()
vi.mock("../../src/contracts/service-auto-generate.js", () => ({
  autoGenerateContractForBooking: (...args: unknown[]) => autoGenerateContractForBooking(...args),
}))

// Mock the contracts service used by ensureDefaultContractSeries +
// resetContractDocumentForBooking.
const findActiveByPrefixScope = vi.fn()
const createSeries = vi.fn()
vi.mock("../../src/contracts/service.js", () => ({
  contractsService: {
    findActiveByPrefixScope: (...args: unknown[]) => findActiveByPrefixScope(...args),
    createSeries: (...args: unknown[]) => createSeries(...args),
    listContracts: vi.fn(async () => ({ data: [] })),
    listAttachments: vi.fn(async () => []),
    deleteAttachment: vi.fn(),
  },
}))

const { createContractDocumentService } = await import(
  "../../src/contracts/contract-document-service.js"
)

/**
 * Build a stub db whose `select(...).from(...).where(...).limit(...)` chain
 * resolves to a single booking row. Mimics the thenable drizzle query builder.
 */
function stubDb(bookingNumber: string | null): PostgresJsDatabase {
  const rows = bookingNumber === null ? [] : [{ bookingNumber }]
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  }
  return { select: () => chain } as PostgresJsDatabase
}

const AUTO_OPTIONS: AutoGenerateContractOptions = {
  enabled: true,
  templateSlug: "customer-sales-agreement",
  scope: "customer",
  seriesPrefixScope: { prefix: "CTR-2026-", scope: "customer" },
}

function makeService(generator: unknown | null) {
  return createContractDocumentService({
    resolveGenerator: () => generator as never,
    autoGenerateOptions: AUTO_OPTIONS,
    defaultSeries: {
      name: "customer-contracts",
      prefix: "CTR-2026-",
      scope: "customer",
    },
    resolveBindings: () => ({ DOCUMENTS_BASE_URL: "https://docs.example" }),
    resolveBookingPiiService: () => null,
  })
}

describe("contract document service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findActiveByPrefixScope.mockResolvedValue({ id: "ser_1" })
  })

  it("generate -> seeds series, persists, returns ids", async () => {
    autoGenerateContractForBooking.mockResolvedValue({
      status: "ok",
      contractId: "ctr_1",
      attachmentId: "att_1",
    })
    const service = makeService({})
    const result = await service.generate(stubDb("BK-1"), undefined, "bkg_1")

    expect(result).toEqual({ contractId: "ctr_1", attachmentId: "att_1" })
    expect(autoGenerateContractForBooking).toHaveBeenCalledTimes(1)
    // booking number from the lookup is forwarded into the auto-generate call
    expect(autoGenerateContractForBooking.mock.calls[0]?.[1]).toMatchObject({
      bookingId: "bkg_1",
      bookingNumber: "BK-1",
    })
  })

  it("generate -> seeds the default series when missing", async () => {
    findActiveByPrefixScope.mockResolvedValue(null)
    autoGenerateContractForBooking.mockResolvedValue({
      status: "ok",
      contractId: "ctr_2",
      attachmentId: "att_2",
    })
    await makeService({}).generate(stubDb("BK-2"), undefined, "bkg_2")
    expect(findActiveByPrefixScope).toHaveBeenCalledWith(expect.anything(), "CTR-2026-", "customer")
    expect(createSeries).toHaveBeenCalledTimes(1)
    expect(createSeries).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: "customer-contracts",
        prefix: "CTR-2026-",
        scope: "customer",
      }),
    )
  })

  it("preview -> returns rendered html", async () => {
    autoGenerateContractForBooking.mockResolvedValue({
      status: "preview",
      html: "<p>Preview</p>",
      templateName: "Customer agreement",
      templateLanguage: "en",
    })
    const result = await makeService({}).preview(stubDb("BK-3"), "bkg_3")
    expect(result).toEqual({
      html: "<p>Preview</p>",
      templateName: "Customer agreement",
      templateLanguage: "en",
    })
    // preview forwards previewMode through the options
    expect(autoGenerateContractForBooking.mock.calls[0]?.[2]).toMatchObject({ previewMode: true })
  })

  it("generate -> returns null when storage/generator not configured", async () => {
    const result = await makeService(null).generate(stubDb("BK-4"), undefined, "bkg_4")
    expect(result).toBeNull()
    expect(autoGenerateContractForBooking).not.toHaveBeenCalled()
  })

  it("generate -> throws with reason on a document failure", async () => {
    autoGenerateContractForBooking.mockResolvedValue({
      status: "document_failed",
      reason: "r2 upload boom",
    })
    await expect(makeService({}).generate(stubDb("BK-5"), undefined, "bkg_5")).rejects.toThrow(
      /document_failed \(r2 upload boom\)/,
    )
  })

  it("preview -> returns null when the template can't be found", async () => {
    autoGenerateContractForBooking.mockResolvedValue({ status: "template_not_found" })
    const result = await makeService({}).preview(stubDb("BK-6"), "bkg_6")
    expect(result).toBeNull()
  })
})
