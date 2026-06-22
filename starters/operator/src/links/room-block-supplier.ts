import { roomBlockLinkable } from "@voyant-travel/accommodations"
import { defineLink } from "@voyant-travel/core"
import { supplierLinkable } from "@voyant-travel/distribution"

/**
 * Each room block is negotiated with one supplier; a supplier can back many
 * blocks. See RFC voyant#1489.
 */
export const roomBlockSupplierLink = defineLink(supplierLinkable, {
  linkable: roomBlockLinkable,
  isList: true,
})
