import { z } from "zod"

import { PREFIXES, type PrefixKey, type PrefixValue } from "./typeid-prefixes.js"

export const TYPEID_SUFFIX_PATTERN = "[0-9a-hjkmnp-tv-z]{26}"

/**
 * Creates a Zod schema for validating TypeIDs with a specific prefix.
 */
export function typeIdSchema(prefix: PrefixKey | PrefixValue) {
  const prefixValue = prefix in PREFIXES ? PREFIXES[prefix as PrefixKey] : prefix
  const pattern = new RegExp(`^${prefixValue}_${TYPEID_SUFFIX_PATTERN}$`)

  return z.string().regex(pattern, {
    message: `Invalid TypeID: expected prefix "${prefixValue}_"`,
  })
}

/**
 * Creates a Zod schema for validating any TypeID.
 */
export function anyTypeIdSchema() {
  const pattern = new RegExp(`^[a-z][a-z0-9]{0,62}_${TYPEID_SUFFIX_PATTERN}$`)

  return z.string().regex(pattern, {
    message: "Invalid TypeID format",
  })
}

/**
 * Creates a Zod schema that accepts either a TypeID or null/undefined.
 */
export function typeIdSchemaOptional(prefix: PrefixKey | PrefixValue) {
  return typeIdSchema(prefix).nullable().optional()
}
