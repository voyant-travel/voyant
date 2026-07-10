import type { WorkflowDescriptor } from "@voyant-travel/core"
import { workflow } from "@voyant-travel/workflows"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { generateProductPdf } from "./tasks/generate-pdf.js"

export interface ProductsGeneratePdfWorkflowInput {
  productId: string
}

export interface ProductsGeneratePdfWorkflowOutput {
  base64: string
  filename: string
  sizeBytes: number
}

export interface CreateProductsGeneratePdfWorkflowOptions {
  resolveDb: () => PostgresJsDatabase | Promise<PostgresJsDatabase>
  render?: (
    db: PostgresJsDatabase,
    input: ProductsGeneratePdfWorkflowInput,
  ) => ProductsGeneratePdfWorkflowOutput | Promise<ProductsGeneratePdfWorkflowOutput>
}

export const productsGeneratePdfWorkflowManifest = {
  id: "products.generate-pdf",
  config: {
    defaultRuntime: "node" as const,
  },
} satisfies WorkflowDescriptor

/** Register the inventory-owned PDF workflow with deployment-supplied runtime access. */
export function createProductsGeneratePdfWorkflow(
  options: CreateProductsGeneratePdfWorkflowOptions,
) {
  return workflow<ProductsGeneratePdfWorkflowInput, ProductsGeneratePdfWorkflowOutput>({
    ...productsGeneratePdfWorkflowManifest.config,
    id: productsGeneratePdfWorkflowManifest.id,
    async run(input) {
      const db = await options.resolveDb()
      if (options.render) return options.render(db, input)

      const generated = await generateProductPdf(db, input.productId)
      return {
        base64: bytesToBase64(generated.pdfBytes),
        filename: generated.filename,
        sizeBytes: generated.sizeBytes,
      }
    },
  })
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}
