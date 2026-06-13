import { defineLink } from "@voyantjs/core"
import { productLinkable } from "@voyantjs/products"
import { organizationLinkable } from "@voyantjs/relationships"

/**
 * Each product has one owning organization (the client); each organization can
 * own many products.
 *
 * Replaces the former `products.organization_id` column with a link pivot table.
 */
export const organizationProductLink = defineLink(organizationLinkable, {
  linkable: productLinkable,
  isList: true,
})
