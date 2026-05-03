/**
 * Sourced content preview — renders the catalog content service's
 * resolved view for the product when one is available.
 *
 * Owned products → query returns null → component renders nothing.
 * Sourced products → renders the rich content shape (summary + days
 * + policies) with metadata badges showing match_kind, source, and
 * stale state.
 */

import { useQuery } from "@tanstack/react-query"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"

import { getProductSourcedContentQueryOptions } from "./product-detail-shared"

export function ProductSourcedContentSection({ productId }: { productId: string }) {
  const query = useQuery(getProductSourcedContentQueryOptions(productId))

  if (query.isPending) return null

  const result = query.data
  if (!result) return null // Owned product or no sourced-entry row.

  const {
    content,
    served_locale,
    match_kind,
    source,
    served_stale,
    synthesized,
    machine_translated,
  } = result.data

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Sourced content preview</span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-normal">
            <Badge variant="secondary">{served_locale}</Badge>
            <Badge variant={match_kind === "exact" ? "default" : "outline"}>
              match: {match_kind}
            </Badge>
            <Badge variant={source === "synthesized" ? "outline" : "default"}>{source}</Badge>
            {served_stale ? <Badge variant="outline">stale</Badge> : null}
            {synthesized ? <Badge variant="outline">synthesizer fallback</Badge> : null}
            {machine_translated ? <Badge variant="outline">MT</Badge> : null}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div>
          <div className="font-medium">{content.product.name}</div>
          {content.product.description ? (
            <p className="text-muted-foreground">{content.product.description}</p>
          ) : null}
          {content.product.supplier ? (
            <p className="text-xs text-muted-foreground">via {content.product.supplier}</p>
          ) : null}
        </div>

        {content.product.highlights?.length ? (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Highlights</div>
            <ul className="ml-4 list-disc text-muted-foreground">
              {content.product.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {content.days.length ? (
          <details className="text-muted-foreground">
            <summary className="cursor-pointer text-xs font-medium">
              Itinerary ({content.days.length} {content.days.length === 1 ? "day" : "days"})
            </summary>
            <ol className="ml-4 mt-2 list-decimal space-y-1">
              {content.days.map((d) => (
                <li key={d.day_number}>
                  <span className="font-medium">{d.title ?? `Day ${d.day_number}`}</span>
                  {d.location ? <span className="text-xs"> · {d.location}</span> : null}
                  {d.description ? <p className="text-xs">{d.description}</p> : null}
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        {content.policies.length ? (
          <details className="text-muted-foreground">
            <summary className="cursor-pointer text-xs font-medium">
              Policies ({content.policies.length})
            </summary>
            <dl className="ml-4 mt-2 space-y-1 text-xs">
              {content.policies.map((p, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: ordering is stable per render
                <div key={`${p.kind}-${idx}`}>
                  <dt className="font-medium capitalize">{p.kind.replace("_", " ")}</dt>
                  <dd>{p.body}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </CardContent>
    </Card>
  )
}
