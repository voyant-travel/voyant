import { defineLink } from "@voyant-travel/core"
import { supplierLinkable } from "@voyant-travel/distribution/suppliers/linkables"
import { programLinkable } from "@voyant-travel/mice/linkables"
import { propertyLinkable } from "@voyant-travel/operations/places/linkables"

import { roomBlockLinkable } from "./linkables.js"

export const programRoomBlockLink = defineLink(programLinkable, {
  linkable: roomBlockLinkable,
  isList: true,
})

export const roomBlockPropertyLink = defineLink(propertyLinkable, {
  linkable: roomBlockLinkable,
  isList: true,
})

export const roomBlockSupplierLink = defineLink(supplierLinkable, {
  linkable: roomBlockLinkable,
  isList: true,
})
