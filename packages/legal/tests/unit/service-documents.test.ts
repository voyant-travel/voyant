import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ContractTemplateSyntaxError } from "../../src/contracts/service-shared.js"

const contractRecordMocks = vi.hoisted(() => ({
  createAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  getContractById: vi.fn(),
  issueContract: vi.fn(),
}))

vi.mock("../../src/contracts/service-contracts.js", () => ({
  contractRecordsService: {
    createAttachment: contractRecordMocks.createAttachment,
    deleteAttachment: contractRecordMocks.deleteAttachment,
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
    const db = {
      update,
      transaction: vi.fn(async (callback) => callback(db)),
    }

    return {
      db: db as never,
      set,
      transaction: db.transaction,
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

  it("rolls back draft auto-issue when the generator fails", async () => {
    const { db, set, transaction } = createDbMock()
    const draftContract = {
      id: "cont_draft",
      status: "draft",
      templateVersionId: null,
      renderedBody: "<p>Ready</p>",
      renderedBodyFormat: "html",
      variables: {},
      metadata: { source: "booking" },
    }
    contractRecordMocks.getContractById
      .mockResolvedValueOnce(draftContract)
      .mockResolvedValueOnce(draftContract)
      .mockResolvedValueOnce(draftContract)
    contractRecordMocks.issueContract.mockResolvedValue({
      status: "issued",
      contract: {
        ...draftContract,
        status: "issued",
        contractNumber: "CC-0001",
      },
      event: {
        transition: "issued",
      },
    })
    const generator = vi
      .fn<ContractDocumentGenerator>()
      .mockRejectedValue(new Error("Invalid API token"))
    const eventBus = { emit: vi.fn() }

    const result = await contractDocumentsService.generateContractDocument(
      db,
      "cont_draft",
      {
        kind: "document",
        replaceExisting: true,
        issueIfDraft: true,
      },
      { generator, eventBus },
    )

    expect(result).toEqual({ status: "generator_failed" })
    expect(transaction).toHaveBeenCalledOnce()
    expect(contractRecordMocks.issueContract).toHaveBeenCalledWith(db, "cont_draft")
    expect(contractRecordMocks.createAttachment).not.toHaveBeenCalled()
    expect(eventBus.emit).not.toHaveBeenCalled()
    expect(set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "booking",
          lastGenerationStatus: "generator_failed",
          lastGenerationError: "Invalid API token",
          lastGenerationAttemptedAt: expect.any(String),
        }),
      }),
    )
  })

  it("rolls back draft auto-issue when rendering is unavailable after issue", async () => {
    const { db, set, transaction } = createDbMock()
    const draftContract = {
      id: "cont_draft",
      status: "draft",
      templateVersionId: null,
      renderedBody: null,
      renderedBodyFormat: "html",
      variables: {},
      metadata: { source: "booking" },
    }
    contractRecordMocks.getContractById
      .mockResolvedValueOnce(draftContract)
      .mockResolvedValueOnce(draftContract)
      .mockResolvedValueOnce(draftContract)
    contractRecordMocks.issueContract.mockResolvedValue({
      status: "issued",
      contract: {
        ...draftContract,
        status: "issued",
        contractNumber: "CC-0001",
      },
      event: {
        transition: "issued",
      },
    })
    const generator = vi.fn<ContractDocumentGenerator>()
    const eventBus = { emit: vi.fn() }

    const result = await contractDocumentsService.generateContractDocument(
      db,
      "cont_draft",
      {
        kind: "document",
        replaceExisting: true,
        issueIfDraft: true,
      },
      { generator, eventBus },
    )

    expect(result).toEqual({ status: "render_unavailable" })
    expect(transaction).toHaveBeenCalledOnce()
    expect(contractRecordMocks.issueContract).toHaveBeenCalledWith(db, "cont_draft")
    expect(generator).not.toHaveBeenCalled()
    expect(contractRecordMocks.createAttachment).not.toHaveBeenCalled()
    expect(eventBus.emit).not.toHaveBeenCalled()
    expect(set).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "booking",
          lastGenerationStatus: "render_unavailable",
          lastGenerationError: "Contract has no rendered body available for document generation",
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
