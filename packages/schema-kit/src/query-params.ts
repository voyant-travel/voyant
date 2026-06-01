import { z } from "zod"

/**
 * Zod schema for boolean query parameters.
 *
 * `z.coerce.boolean()` is broken for query strings: `"false"` coerces to
 * `Boolean("false")` → `true`. This schema correctly handles `"true"` and
 * `"false"` string values from URL search params.
 */
export const booleanQueryParam = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1")
