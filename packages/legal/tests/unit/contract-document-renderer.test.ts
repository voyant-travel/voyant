import { describe, expect, it, vi } from "vitest"

import {
  createBrowserRenderedPdfContractDocumentSerializer,
  createRenderedPdfContractDocumentSerializer,
} from "../../src/contracts/service-documents-browser.js"

describe("rendered contract PDF serializer", () => {
  it("uses the deployment document renderer without knowing its implementation", async () => {
    const renderPdf = vi.fn(async () => new Uint8Array([37, 80, 68, 70]))
    const serializer = createRenderedPdfContractDocumentSerializer({
      renderer: { name: "self-hosted-playwright", renderPdf },
    })

    const result = await serializer({
      db: {} as never,
      contract: {
        id: "contract_1",
        language: "en",
      } as never,
      templateVersion: null,
      renderedBody: "<h1>Configured by the operator</h1>",
      renderedBodyFormat: "html",
      variables: {},
      bindings: {},
    })

    expect(result.body).toEqual(new Uint8Array([37, 80, 68, 70]))
    expect(result.metadata).toMatchObject({ renderer: "self-hosted-playwright" })
    expect(renderPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "print",
        page: expect.objectContaining({ format: "a4", printBackground: true }),
        html: expect.stringContaining("Configured by the operator"),
      }),
    )
  })

  it("keeps the legacy structural cloud-client adapter compatible", async () => {
    const pdf = vi.fn(async () => new Uint8Array([1]))
    const serializer = createBrowserRenderedPdfContractDocumentSerializer({
      cloudClient: { browser: { pdf } },
    })

    await serializer({
      db: {} as never,
      contract: { id: "contract_legacy", language: "en" } as never,
      templateVersion: null,
      renderedBody: "Legacy",
      renderedBodyFormat: "markdown",
      variables: {},
      bindings: {},
    })

    expect(pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        pdfOptions: expect.objectContaining({ format: "a4" }),
        gotoOptions: expect.objectContaining({ timeout: 30_000 }),
      }),
    )
  })
})
