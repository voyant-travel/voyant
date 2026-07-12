import { defineLink } from "@voyant-travel/core"
import {
  organizationLinkable,
  personLinkable,
} from "@voyant-travel/relationships/linkables"

import { inventoryProductCompatibilityLinkable as productLinkable } from "./linkables.js"

export const organizationProductLink = defineLink(organizationLinkable, {
  linkable: productLinkable,
  isList: true,
})

export const personProductLink = defineLink(personLinkable, {
  linkable: productLinkable,
  isList: true,
})
