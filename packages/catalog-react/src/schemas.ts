import { z } from "zod"

const indexerDocumentSchema = z.object({
  id: z.string(),
  fields: z.record(z.string(), z.unknown()),
  embeddings: z.record(z.string(), z.array(z.number())).optional(),
  embedding_model_id: z.string().optional(),
})

const searchHitSchema = z.object({
  id: z.string(),
  score: z.number(),
  document: indexerDocumentSchema,
  highlights: z.record(z.string(), z.unknown()).optional(),
})

export const catalogSearchResponseSchema = z.object({
  vertical: z.string(),
  mode: z.enum(["keyword", "hybrid", "semantic"]),
  total: z.number(),
  hits: z.array(searchHitSchema),
  facets: z.record(z.string(), z.array(z.unknown())).optional(),
})

export type CatalogSearchResponse = z.infer<typeof catalogSearchResponseSchema>
export type CatalogSearchHit = z.infer<typeof searchHitSchema>
export type CatalogSearchDocument = z.infer<typeof indexerDocumentSchema>
