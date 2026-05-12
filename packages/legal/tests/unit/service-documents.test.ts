import { beforeEach, describe, expect, it, vi } from "vitest"

import { ContractTemplateSyntaxError } from "../../src/contracts/service-shared.js"

const contractRecordMocks = vi.hoisted(() => ({
  getContractById: vi.fn(),
  issueContract: vi.fn(),
}))

vi.mock("../../src/contracts/service-contracts.js", () => ({
  contractRecordsService: {
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
  })

  it("returns render_unavailable when draft auto-issue hits invalid template syntax", async () => {
    contractRecordMocks.getContractById.mockResolvedValue({
      id: "cont_draft",
      status: "draft",
      templateVersionId: "ctv_bad",
      renderedBody: null,
      renderedBodyFormat: "html",
      variables: {},
    })
    contractRecordMocks.issueContract.mockRejectedValue(
      new ContractTemplateSyntaxError([{ message: "expected variable name" }]),
    )
    const generator = vi.fn<ContractDocumentGenerator>()

    const result = await contractDocumentsService.generateContractDocument(
      {} as never,
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
  })
})
