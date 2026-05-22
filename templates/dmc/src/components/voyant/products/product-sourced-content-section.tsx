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
import { formatMessage } from "@voyantjs/i18n"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { useAdminMessages } from "@/lib/admin-i18n"

import { getProductSourcedContentQueryOptions } from "./product-detail-shared"

export function ProductSourcedContentSection({ productId }: { productId: string }) {
  const t = useAdminMessages().products.sourcedContent
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
          <span>{t.title}</span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-normal">
            <Badge variant="secondary">{served_locale}</Badge>
            <Badge variant={match_kind === "exact" ? "default" : "outline"}>
              {t.matchPrefix}: {match_kind}
            </Badge>
            <Badge variant={source === "synthesized" ? "outline" : "default"}>{source}</Badge>
            {served_stale ? <Badge variant="outline">{t.staleBadge}</Badge> : null}
            {synthesized ? <Badge variant="outline">{t.synthesizedBadge}</Badge> : null}
            {machine_translated ? (
              <Badge variant="outline">{t.machineTranslatedBadge}</Badge>
            ) : null}
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
            <p className="text-xs text-muted-foreground">
              {formatMessage(t.viaSupplier, { supplier: content.product.supplier })}
            </p>
          ) : null}
        </div>

        {content.product.highlights?.length ? (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              {t.highlightsHeading}
            </div>
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
              {formatMessage(
                content.days.length === 1 ? t.itinerarySummarySingular : t.itinerarySummaryPlural,
                { count: content.days.length },
              )}
            </summary>
            <ol className="ml-4 mt-2 list-decimal space-y-1">
              {content.days.map((d) => (
                <li key={d.day_number}>
                  <span className="font-medium">
                    {d.title ?? formatMessage(t.dayFallback, { number: d.day_number })}
                  </span>
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
              {formatMessage(t.policiesSummary, { count: content.policies.length })}
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
