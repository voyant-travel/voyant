import { describe, expect, it, vi } from "vitest"

import {
  createHttpDocumentRenderer,
  createHttpDocumentRendererFromEnv,
  documentRendererPort,
} from "../../src/document-rendering.js"

describe("document rendering", () => {
  it("posts the portable PDF contract to a configured HTTP renderer", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response(new Uint8Array([37, 80, 68, 70])),
    )
    const renderer = createHttpDocumentRenderer({
      endpoint: "https://renderer.example/pdf",
      headers: { authorization: "Bearer secret" },
      fetch,
    })

    await expect(renderer.renderPdf({ html: "<h1>Hello</h1>" })).resolves.toEqual(
      new Uint8Array([37, 80, 68, 70]),
    )
    expect(fetch).toHaveBeenCalledWith(
      "https://renderer.example/pdf",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ html: "<h1>Hello</h1>" }),
      }),
    )
    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers)
    expect(headers.get("authorization")).toBe("Bearer secret")
    expect(headers.get("accept")).toBe("application/pdf")
  })

  it("resolves the zero-code environment adapter with deployment authentication", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(new Uint8Array([1])))
    const renderer = createHttpDocumentRendererFromEnv(
      {
        VOYANT_DOCUMENT_RENDERER_URL: "https://renderer.example/pdf",
        VOYANT_DOCUMENT_RENDERER_TOKEN: "secret",
        VOYANT_DOCUMENT_RENDERER_NAME: "self-hosted-playwright",
        VOYANT_CLOUD_DEPLOYMENT_ID: "dpl_1",
      },
      { fetch },
    )

    expect(renderer?.name).toBe("self-hosted-playwright")
    await renderer?.renderPdf({ html: "hello" })
    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers)
    expect(headers.get("authorization")).toBe("Bearer secret")
    expect(headers.get("x-voyant-deployment-id")).toBe("dpl_1")
  })

  it("keeps the renderer optional when no URL is configured", () => {
    expect(createHttpDocumentRendererFromEnv({})).toBeNull()
  })

  it("rejects invalid runtime port implementations", () => {
    expect(() => documentRendererPort.test({ name: "", renderPdf: vi.fn() })).toThrow(
      "documents.renderer",
    )
  })
})
