import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { CatalogPage } from "@/components/voyant/catalog/catalog-page"

/**
 * Search params for `/catalog`. Reflects the active tab, the search query,
 * and the current page so refresh / share / back-forward all preserve
 * state. Filters stay local for now — encoding the per-tab facet+range
 * shape in the URL would balloon it; a follow-up can add `f`/`r` keys.
 */
const catalogSearchSchema = z.object({
  tab: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  market: z.string().optional(),
  locale: z.string().optional(),
})

export type CatalogSearchParams = z.infer<typeof catalogSearchSchema>

export const Route = createFileRoute("/_workspace/catalog")({
  component: CatalogPage,
  validateSearch: catalogSearchSchema,
})
