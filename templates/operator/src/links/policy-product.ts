import { defineLink } from "@voyantjs/core"
import { inventoryProductCompatibilityLinkable as productLinkable } from "@voyantjs/inventory"
import { policyLinkable } from "@voyantjs/legal"

/**
 * A policy can apply to many products (cancellation rules, payment schedule,
 * etc.); a product can carry many policies (one per kind).
 */
export const policyProductLink = defineLink(
  { linkable: policyLinkable, isList: true },
  { linkable: productLinkable, isList: true },
)
