import { createToolRegistry, type ToolContext } from "@voyant-travel/tools"
import { describe, expect, it, vi } from "vitest"

import { createLegalContractDocumentToolServices } from "../../src/mcp-runtime.js"
import {
  createContractTemplateTool,
  generateBookingContractDocumentTool,
  legalContractDocumentTools,
  legalTools,
  previewBookingContractDocumentTool,
  regenerateBookingContractDocumentTool,
  sendLegalContractTool,
} from "../../src/tools.js"

function baseContext(): ToolContext {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "tenant-1",
    resolverScope: {
      locale: "en",
      audience: "staff",
      market: "default",
      actor: "staff",
    },
  }
}

describe("legal Tools", () => {
  it("publishes unique typed capabilities for both selected legal units", () => {
    expect(legalTools).toHaveLength(18)
    expect(legalContractDocumentTools).toHaveLength(4)
    const tools = [...legalTools, ...legalContractDocumentTools]
    expect(new Set(tools.map((tool) => tool.capabilityId)).size).toBe(tools.length)
    expect(tools.every((tool) => tool.audience?.allowed?.includes("staff"))).toBe(true)
    expect(() => createToolRegistry().registerAll(tools)).not.toThrow()
  })

  it("marks authoring and externally consequential lifecycle calls as guarded writes", () => {
    expect(createContractTemplateTool.requiredScopes).toEqual(["legal:write"])
    expect(createContractTemplateTool.riskPolicy).toMatchObject({
      destructive: false,
      reversible: true,
      confirmationRequired: true,
      sideEffects: ["data-write"],
    })
    expect(sendLegalContractTool.riskPolicy).toMatchObject({
      destructive: false,
      reversible: false,
      confirmationRequired: true,
      sideEffects: ["data-write", "email"],
    })
    expect(regenerateBookingContractDocumentTool.riskPolicy).toMatchObject({
      destructive: true,
      reversible: false,
      confirmationRequired: true,
    })
  })

  it("rejects contract-document access outside an exact staff audience", async () => {
    await expect(
      previewBookingContractDocumentTool.handler(
        { bookingId: "booking_1" },
        {
          ...baseContext(),
          audience: "customer",
          legalContractDocument: {
            previewBookingContract: vi.fn(),
            generateBookingContract: vi.fn(),
            resolveDelivery: vi.fn(),
          },
        },
      ),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_DENIED" })
  })

  it("preflights authorized delivery support before generating a document", async () => {
    const generateContract = vi.fn(async () => ({
      contractId: "contract_1",
      attachmentId: "attachment_1",
    }))
    const service = createLegalContractDocumentToolServices({
      runtime: {
        generateContract,
        previewContract: vi.fn(),
        resolveStorage: vi.fn(),
        guessMimeType: vi.fn(),
      },
      env: {},
      db: {},
      eventBus: {},
    })

    await expect(
      service.generateBookingContract({
        bookingId: "booking_1",
        force: false,
        includeDelivery: true,
      }),
    ).rejects.toThrow("does not support authorized delivery resolution")
    expect(generateContract).not.toHaveBeenCalled()
  })

  it("composes generation with provider-authorized delivery and hides storage details", async () => {
    const service = createLegalContractDocumentToolServices({
      runtime: {
        generateContract: vi.fn(async () => ({
          contractId: "contract_1",
          attachmentId: "attachment_1",
        })),
        previewContract: vi.fn(),
        resolveGeneratedDocument: vi.fn(async () => ({
          url: "https://documents.example.test/signed/attachment_1",
          filename: "contract.pdf",
          contentType: "application/pdf",
        })),
        resolveStorage: vi.fn(),
        guessMimeType: vi.fn(),
      },
      env: {},
      db: {},
      eventBus: {},
    })

    await expect(
      generateBookingContractDocumentTool.handler(
        { bookingId: "booking_1", includeDelivery: true },
        { ...baseContext(), legalContractDocument: service },
      ),
    ).resolves.toEqual({
      contractId: "contract_1",
      attachmentId: "attachment_1",
      delivery: {
        url: "https://documents.example.test/signed/attachment_1",
        filename: "contract.pdf",
        contentType: "application/pdf",
      },
    })
  })
})
