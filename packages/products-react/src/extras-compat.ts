/**
 * Temporary product-authoring compatibility shim.
 *
 * `@voyantjs/inventory-react/extras` is the v1 target, but this historical
 * Products React package cannot import Inventory React without creating a
 * facade cycle. Keep the legacy dependency isolated here until the authoring
 * components physically move to Inventory React.
 */

export type { ProductExtraRecord } from "@voyantjs/extras-react"
export {
  useProductExtraMutation,
  useProductExtras,
} from "@voyantjs/extras-react"
