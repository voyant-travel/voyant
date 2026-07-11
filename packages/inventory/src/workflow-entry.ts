import type { WorkflowDescriptor } from "@voyant-travel/core"
import { workflow } from "@voyant-travel/workflows"
import { generateProductPdf } from "./tasks/generate-pdf.js"
import type {
  ProductsGeneratePdfWorkflowInput,
  ProductsGeneratePdfWorkflowOutput,
  ProductsGeneratePdfWorkflowRuntime,
} from "./workflow-runtime.js"

export type CreateProductsGeneratePdfWorkflowOptions = ProductsGeneratePdfWorkflowRuntime

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
      return runGenerateProductPdf(options, input)
    },
  })
}

async function runGenerateProductPdf(
  options: ProductsGeneratePdfWorkflowRuntime,
  input: ProductsGeneratePdfWorkflowInput,
): Promise<ProductsGeneratePdfWorkflowOutput> {
  const db = await options.resolveDb()
  if (options.render) return options.render(db, input)

  const generated = await generateProductPdf(db, input.productId)
  return {
    base64: bytesToBase64(generated.pdfBytes),
    filename: generated.filename,
    sizeBytes: generated.sizeBytes,
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

export type {
  ProductsGeneratePdfWorkflowInput,
  ProductsGeneratePdfWorkflowOutput,
  ProductsGeneratePdfWorkflowRuntime,
} from "./workflow-runtime.js"
