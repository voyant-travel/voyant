import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ContractTemplateSyntaxError } from "../../src/contracts/service-shared.js"

const contractRecordMocks = vi.hoisted(() => ({
  createAttachment: vi.fn(),
  getContractById: vi.fn(),
  issueContract: vi.fn(),
}))

vi.mock("../../src/contracts/service-contracts.js", () => ({
  contractRecordsService: {
    createAttachment: contractRecordMocks.createAttachment,
    getContractById: contractRecordMocks.getContractById,
    issueContract: contractRecordMocks.issueContract,
  },
}))

import {
  type ContractDocumentGenerator,
  contractDocumentsService,
} from "../../src/contracts/service-documents.js"

describe("contractDocumentsService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createDbMock() {
    const where = vi.fn()
    const set = vi.fn(() => ({ where }))
    const update = vi.fn(() => ({ set }))

    return {
      db: { update } as never,
      set,
    }
  }

  it("returns render_unavailable when draft auto-issue hits invalid template syntax", async () => {
    const { db, set } = createDbMock()
    contractRecordMocks.getContractById.mockResolvedValue({
      id: "cont_draft",
      status: "draft",
      templateVersionId: "ctv_bad",
      renderedBody: null,
      renderedBodyFormat: "html",
      variables: {},
      metadata: { source: "booking" },
    })
    contractRecordMocks.issueContract.mockRejectedValue(
      new ContractTemplateSyntaxError([{ message: "expected variable name" }]),
    )
    const generator = vi.fn<ContractDocumentGenerator>()

    const result = await contractDocumentsService.generateContractDocument(
      db,
      "cont_draft",
      {
        kind: "document",
        replaceExisting: true,
        issueIfDraft: true,
      },
      { generator },
    )

    expect(result).toEqual({ status: "render_unavailable" })
    expect(generator).not.toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "booking",
          lastGenerationStatus: "render_unavailable",
          lastGenerationError: "expected variable name",
          lastGenerationAttemptedAt: expect.any(String),
        }),
      }),
    )
  })

  it("records generator failure details on contract metadata", async () => {
    const { db, set } = createDbMock()
    contractRecordMocks.getContractById.mockResolvedValue({
      id: "cont_ready",
      status: "issued",
      templateVersionId: null,
      renderedBody: "<p>Ready</p>",
      renderedBodyFormat: "html",
      variables: {},
      metadata: null,
    })
    const generator = vi.fn<ContractDocumentGenerator>().mockRejectedValue(new Error("R2 outage"))

    const result = await contractDocumentsService.generateContractDocument(
      db,
      "cont_ready",
      {
        kind: "document",
        replaceExisting: false,
        issueIfDraft: true,
      },
      { generator },
    )

    expect(result).toEqual({ status: "generator_failed" })
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          lastGenerationStatus: "generator_failed",
          lastGenerationError: "R2 outage",
          lastGenerationAttemptedAt: expect.any(String),
        }),
      }),
    )
  })

  it("clears stale generation failure metadata after a successful document generation", async () => {
    const { db, set } = createDbMock()
    contractRecordMocks.getContractById.mockResolvedValue({
      id: "cont_ready",
      status: "issued",
      templateVersionId: null,
      renderedBody: "<p>Ready</p>",
      renderedBodyFormat: "html",
      variables: {},
      metadata: {
        source: "booking",
        lastGenerationStatus: "generator_failed",
        lastGenerationError: "R2 outage",
        lastGenerationAttemptedAt: "2026-05-26T00:00:00.000Z",
      },
    })
    contractRecordMocks.createAttachment.mockResolvedValue({
      id: "catt_1",
      contractId: "cont_ready",
      kind: "document",
      name: "contract.pdf",
    })
    const generator = vi.fn<ContractDocumentGenerator>().mockResolvedValue({
      name: "contract.pdf",
      mimeType: "application/pdf",
    })

    const result = await contractDocumentsService.generateContractDocument(
      db,
      "cont_ready",
      {
        kind: "document",
        replaceExisting: false,
        issueIfDraft: true,
      },
      { generator },
    )

    expect(result.status).toBe("generated")
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { source: "booking" },
      }),
    )
  })
})
