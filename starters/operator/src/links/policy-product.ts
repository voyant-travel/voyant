import { defineLink } from "@voyant-travel/core"
import { inventoryProductCompatibilityLinkable as productLinkable } from "@voyant-travel/inventory"
import { policyLinkable } from "@voyant-travel/legal"

/**
 * A policy can apply to many products (cancellation rules, payment schedule,
 * etc.); a product can carry many policies (one per kind).
 */
export const policyProductLink = defineLink(
  { linkable: policyLinkable, isList: true },
  { linkable: productLinkable, isList: true },
)
