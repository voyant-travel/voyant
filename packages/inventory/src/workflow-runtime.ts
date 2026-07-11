import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

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
