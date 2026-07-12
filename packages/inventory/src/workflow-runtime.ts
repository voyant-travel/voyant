import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { ProductBrochurePrinter } from "./tasks/brochure-printers.js"
import {
  createDefaultProductBrochureTemplate,
  loadProductBrochureTemplateContext,
  renderProductBrochureTemplate,
} from "./tasks/brochure-templates.js"

export interface ProductsGeneratePdfWorkflowInput {
  productId: string
}

export interface ProductsGeneratePdfWorkflowOutput {
  base64: string
  filename: string
  sizeBytes: number
}

export const PRODUCTS_GENERATE_PDF_WORKFLOW_RUNTIME_KEY =
  "inventory.workflows.generate-product-pdf.runtime" as const

export interface ProductsGeneratePdfWorkflowRuntime {
  resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
  render?: (
    db: PostgresJsDatabase,
    input: ProductsGeneratePdfWorkflowInput,
  ) => ProductsGeneratePdfWorkflowOutput | Promise<ProductsGeneratePdfWorkflowOutput>
}

export interface ProductsGeneratePdfWorkflowRuntimeOptions {
  resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
  resolvePrinter: () => ProductBrochurePrinter | Promise<ProductBrochurePrinter>
}

/** Inventory owns brochure assembly; deployments provide only the PDF printer. */
export function createProductsGeneratePdfWorkflowRuntime(
  options: ProductsGeneratePdfWorkflowRuntimeOptions,
): ProductsGeneratePdfWorkflowRuntime {
  return {
    resolveDb: options.resolveDb,
    render: async (db, input) => {
      const context = await loadProductBrochureTemplateContext(db, input.productId)
      const rendered = await renderProductBrochureTemplate(
        createDefaultProductBrochureTemplate(),
        context,
      )
      const printed = await (await options.resolvePrinter())({ template: rendered, context })
      return {
        base64: bytesToBase64(printed.body),
        filename: rendered.filename,
        sizeBytes: printed.fileSize ?? printed.body.byteLength,
      }
    },
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}
