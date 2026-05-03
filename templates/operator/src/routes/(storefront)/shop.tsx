"use client"

import { createFileRoute, Link } from "@tanstack/react-router"
import { useCatalogSearch } from "@voyantjs/catalog-react"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Input } from "@voyantjs/ui/components/input"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { useState } from "react"
import { z } from "zod"

/**
 * Storefront landing — real catalog browser backed by
 * `/v1/public/catalog/search` (Typesense slice scoped to
 * `audience: "customer"`).
 *
 * When the deployment hasn't configured Typesense (no
 * `TYPESENSE_HOST`), the search route 503s and we render an
 * instructions block instead — a usable experience either way.
 */
const shopSearchSchema = z.object({
  q: z.string().optional(),
  vertical: z.enum(["products", "cruises", "hospitality", "charters", "flights"]).optional(),
})

export const Route = createFileRoute("/(storefront)/shop")({
  component: StorefrontIndex,
  validateSearch: shopSearchSchema,
})

function StorefrontIndex(): React.ReactElement {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const vertical = search.vertical ?? "products"
  const [query, setQuery] = useState(search.q ?? "")

  const result = useCatalogSearch({
    surface: "public",
    vertical,
    query,
    mode: "keyword",
    pagination: { limit: 24 },
    enabled: true,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Browse and book</h1>
        <p className="text-muted-foreground">
          Customer-facing booking journey. Same engine the operator uses, served via{" "}
          <code>/v1/public/catalog/*</code> with an unauthenticated <code>customer</code> actor.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search products, tours, stays…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={vertical}
          onChange={(e) =>
            navigate({
              search: (s) => ({ ...s, vertical: e.target.value as typeof vertical }),
            })
          }
        >
          <option value="products">Tours & products</option>
          <option value="cruises">Cruises</option>
          <option value="hospitality">Stays</option>
          <option value="charters">Charters</option>
        </select>
      </div>

      {result.isError ? (
        <SearchUnavailable />
      ) : result.isLoading ? (
        <SearchSkeleton />
      ) : result.data && result.data.hits.length > 0 ? (
        <SearchResults vertical={vertical} hits={result.data.hits} />
      ) : (
        <SearchEmpty vertical={vertical} query={query} />
      )}
    </div>
  )
}

function SearchUnavailable(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Catalog search isn't configured</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          The search indexer is offline (typically because <code>TYPESENSE_HOST</code> isn't set).
          You can still demo the booking journey directly — pick a product id from the operator
          dashboard and visit:
        </p>
        <p>
          <code>/shop/book/products/&lt;productId&gt;?sourceKind=owned</code>
        </p>
      </CardContent>
    </Card>
  )
}

function SearchSkeleton(): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => `skel-${i}`).map((key) => (
        <Card key={key}>
          <CardContent className="space-y-2 pt-6">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface SearchHit {
  id: string
  document: { fields: Record<string, unknown> }
}

function SearchResults({
  vertical,
  hits,
}: {
  vertical: string
  hits: ReadonlyArray<SearchHit>
}): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {hits.map((hit) => {
        const fields = hit.document.fields
        const name = readString(fields.name) ?? readString(fields.title) ?? hit.id
        const description = readString(fields.description) ?? readString(fields.summary)
        const sourceKind = readString(fields.source_kind) ?? "owned"
        const sourceConnectionId = readString(fields.source_connection_id)
        const sourceRef = readString(fields.source_ref)
        const price = readNumber(fields.price_cents) ?? readNumber(fields.sell_amount_cents)
        const currency = readString(fields.currency) ?? readString(fields.sell_currency) ?? ""
        return (
          <Card key={hit.id}>
            <CardHeader>
              <CardTitle className="text-base">{name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {description ? (
                <p className="text-muted-foreground line-clamp-3">{description}</p>
              ) : null}
              {price != null ? (
                <p className="font-medium">
                  {(price / 100).toLocaleString(undefined, {
                    style: currency ? "currency" : "decimal",
                    currency: currency || undefined,
                  })}
                </p>
              ) : null}
              <Link
                to="/shop/book/$entityModule/$entityId"
                params={{ entityModule: vertical, entityId: hit.id }}
                search={{
                  sourceKind,
                  ...(sourceConnectionId ? { sourceConnectionId } : {}),
                  ...(sourceRef ? { sourceRef } : {}),
                }}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm hover:bg-primary/90"
              >
                Book
              </Link>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function SearchEmpty({ vertical, query }: { vertical: string; query: string }): React.ReactElement {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground text-sm">
          No {vertical} match {query ? <q>{query}</q> : "your filters"}. Try a broader query or a
          different vertical.
        </p>
      </CardContent>
    </Card>
  )
}

function readString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined
}

function readNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number.parseFloat(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}
