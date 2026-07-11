import type { WorkflowDescriptor } from "@voyant-travel/core"
import { workflow } from "@voyant-travel/workflows"
import { generateProductPdf } from "./tasks/generate-pdf.js"
import {
  PRODUCTS_GENERATE_PDF_WORKFLOW_RUNTIME_KEY,
  type ProductsGeneratePdfWorkflowInput,
  type ProductsGeneratePdfWorkflowOutput,
  type ProductsGeneratePdfWorkflowRuntime,
} from "./workflow-runtime.js"

export type CreateProductsGeneratePdfWorkflowOptions = ProductsGeneratePdfWorkflowRuntime

export const productsGeneratePdfWorkflowManifest = {
  id: "products.generate-pdf",
  config: {
    defaultRuntime: "node" as const,
  },
} satisfies WorkflowDescriptor

export const productsGeneratePdfWorkflow = workflow<
  ProductsGeneratePdfWorkflowInput,
  ProductsGeneratePdfWorkflowOutput
>({
  ...productsGeneratePdfWorkflowManifest.config,
  id: productsGeneratePdfWorkflowManifest.id,
  async run(input, ctx) {
    return runGenerateProductPdf(
      ctx.services.resolve<ProductsGeneratePdfWorkflowRuntime>(
        PRODUCTS_GENERATE_PDF_WORKFLOW_RUNTIME_KEY,
      ),
      input,
    )
  },
})

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

export {
  PRODUCTS_GENERATE_PDF_WORKFLOW_RUNTIME_KEY,
  type ProductsGeneratePdfWorkflowInput,
  type ProductsGeneratePdfWorkflowOutput,
  type ProductsGeneratePdfWorkflowRuntime,
} from "./workflow-runtime.js"
