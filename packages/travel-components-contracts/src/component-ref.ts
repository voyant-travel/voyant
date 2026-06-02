import { z } from "zod"

/**
 * Reference to a first-class Voyant catalog entity or source-resolvable entity.
 *
 * This is a pure payload shape. Persisted cross-package associations still use
 * plain text IDs plus template-level link definitions, not Drizzle FKs.
 */
export const componentRefSchema = z.object({
  entity_module: z.string(),
  entity_id: z.string(),
  source_kind: z.string().nullable().optional(),
  source_connection_id: z.string().nullable().optional(),
  source_ref: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
})

export type ComponentRef = z.infer<typeof componentRefSchema>
