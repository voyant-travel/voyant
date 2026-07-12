import type { CatalogChartersRuntimeExtension } from "@voyant-travel/catalog/runtime-contracts"

import { charterCatalogPolicy } from "./catalog-policy.js"

export const catalogChartersRuntimeExtension = {
  fieldPolicy: charterCatalogPolicy,
} satisfies CatalogChartersRuntimeExtension
