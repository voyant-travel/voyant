import { defineLink } from "@voyantjs/core"
import { productLinkable } from "@voyantjs/products"
import { personLinkable } from "@voyantjs/relationships"

/**
 * Each product has one owning person (the client); each person can own many products.
 *
 * Replaces the former `products.person_id` column with a link pivot table.
 */
export const personProductLink = defineLink(personLinkable, {
  linkable: productLinkable,
  isList: true,
})
