import { describe, expect, it, vi } from "vitest"

import {
  createInventoryBrochureRuntime,
  createProductBrochurePrinter,
} from "../../src/brochure-runtime.js"

describe("brochure document renderer", () => {
  it("adapts the shared renderer to brochure output", async () => {
    const renderPdf = vi.fn(async () => new Uint8Array([37, 80, 68, 70]))
    const printer = createProductBrochurePrinter({ name: "gotenberg", renderPdf })
    const artifact = await printer({
      template: {
        title: "Alpine escape",
        body: "<h1>Alpine escape</h1>",
        bodyFormat: "html",
      } as never,
      context: { product: { id: "product_1" } } as never,
    })

    expect(artifact.body).toEqual(new Uint8Array([37, 80, 68, 70]))
    expect(artifact.metadata).toMatchObject({ renderer: "gotenberg", productId: "product_1" })
    expect(renderPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "print",
        page: expect.objectContaining({ format: "a4" }),
      }),
    )
  })

  it("resolves a self-hosted renderer from environment without custom workflow wiring", async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetch as typeof fetch
    try {
      const runtime = createInventoryBrochureRuntime({
        env: () => ({ VOYANT_DOCUMENT_RENDERER_URL: "https://renderer.example/pdf" }),
      })
      const printer = runtime.resolvePrinter?.({ env: {} } as never)
      expect(printer).not.toBeNull()
      await printer?.({
        template: { title: "Brochure", body: "Body", bodyFormat: "markdown" } as never,
        context: { product: { id: "product_1" } } as never,
      })
      expect(fetch).toHaveBeenCalledWith(
        "https://renderer.example/pdf",
        expect.objectContaining({ method: "POST" }),
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
