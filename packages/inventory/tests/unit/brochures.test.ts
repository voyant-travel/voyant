import { createLocalStorageProvider } from "@voyant-travel/storage/providers/local"
import { describe, expect, it, vi } from "vitest"

vi.mock("../../src/tasks/generate-pdf.js", () => ({
  generateProductPdf: vi.fn(async () => ({
    pdfBytes: new Uint8Array([1, 2, 3]),
    filename: "brochure.pdf",
    sizeBytes: 3,
  })),
}))

vi.mock("../../src/tasks/brochure-templates.js", () => ({
  createDefaultProductBrochureTemplate: vi.fn(() => ({
    bodyFormat: "markdown",
    body: "# Default brochure",
  })),
  loadProductBrochureTemplateContext: vi.fn(async () => ({
    product: {
      id: "prod_123",
      name: "Voyant Brochure Product",
    },
    days: [],
    generatedAt: new Date("2026-04-14T09:00:00.000Z"),
  })),
  renderProductBrochureTemplate: vi.fn(async () => ({
    body: "# Printed brochure",
    bodyFormat: "markdown",
    title: "Voyant Brochure Product",
    filename: "template-brochure.pdf",
    variables: {},
    metadataLines: ["Generated in test"],
  })),
}))

vi.mock("../../src/service.js", () => ({
  productsService: {
    upsertBrochure: vi.fn(
      async (_db: unknown, productId: string, input: Record<string, unknown>) => ({
        id: "product_media_brochure",
        productId,
        dayId: null,
        mediaType: "document",
        name: input.name,
        url: input.url,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        altText: input.altText,
        sortOrder: input.sortOrder,
        isCover: false,
        isBrochure: true,
        isBrochureCurrent: true,
        brochureVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
  },
}))

describe("generateAndStoreProductBrochure", () => {
  it("uploads generated PDFs and persists them as canonical brochures", async () => {
    const { generateAndStoreProductBrochure } = await import("../../src/tasks/brochures.js")
    const storage = createLocalStorageProvider({ baseUrl: "https://files.example/" })

    const result = await generateAndStoreProductBrochure({} as never, "prod_123", {
      storage,
    })

    expect(result.filename).toBe("brochure.pdf")
    expect(result.storageKey).toBe("brochures/products/prod_123/brochure.pdf")
    expect(result.url).toBe("https://files.example/brochures/products/prod_123/brochure.pdf")
    expect(result.brochure.isBrochure).toBe(true)
    expect(result.brochure.isBrochureCurrent).toBe(true)
    expect(result.brochure.storageKey).toBe(result.storageKey)
  }, 15_000)

  it("renders brochure templates through a custom printer and persists printer metadata", async () => {
    const { generateAndStoreProductBrochure } = await import("../../src/tasks/brochures.js")
    const storage = createLocalStorageProvider({ baseUrl: "https://files.example/" })
    const printer = vi.fn(async () => ({
      body: new Uint8Array([9, 8, 7, 6]),
      mimeType: "application/pdf",
      fileSize: 4,
      metadata: {
        renderer: "custom-printer",
        provider: "browserbase",
      },
    }))

    const result = await generateAndStoreProductBrochure({} as never, "prod_123", {
      storage,
      template: {
        bodyFormat: "markdown",
        body: "# Custom brochure",
      },
      printer,
      filename: ({ filename }) => `custom-${filename}`,
    })

    expect(printer).toHaveBeenCalledOnce()
    expect(result.filename).toBe("custom-template-brochure.pdf")
    expect(result.storageKey).toBe("brochures/products/prod_123/custom-template-brochure.pdf")
    expect(result.url).toBe(
      "https://files.example/brochures/products/prod_123/custom-template-brochure.pdf",
    )
    expect(result.metadata).toEqual({
      renderer: "custom-printer",
      provider: "browserbase",
    })
    expect(result.brochure.mimeType).toBe("application/pdf")
    expect(result.brochure.fileSize).toBe(4)
  })
})
