import type { CatalogDemoRuntimeExtension } from "@voyant-travel/catalog/runtime-contracts"

import { createDemoCatalogAdapter } from "./adapter.js"

export const catalogDemoRuntimeExtension = {
  createSourceAdapter: createDemoCatalogAdapter,
} satisfies CatalogDemoRuntimeExtension
