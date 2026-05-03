/**
 * Sourced content preview — renders the catalog content service's
 * resolved view for the product, when one is available.
 *
 * - Owned products → query returns null → component renders nothing.
 * - Sourced products with a cached row → renders the rich content
 *   shape (product summary + days + media + policies) with metadata
 *   chips showing match_kind, source (cache / fresh / synthesized),
 *   and a "served stale" indicator.
 *
 * The section is read-only — overlays for sourced content live in
 * the catalog overlay store, not the product detail dialog. A future
 * "edit overlay" affordance will live here.
 */

import { useQuery } from "@tanstack/react-query"

import { getProductSourcedContentQueryOptions } from "./product-detail-shared"

export function ProductSourcedContentSection({ productId }: { productId: string }) {
  const query = useQuery(getProductSourcedContentQueryOptions(productId))

  if (query.isPending) {
    return null
  }

  const result = query.data
  if (!result) {
    // Owned product or no sourced-entry row — render nothing so this
    // section is invisible on the owned-detail surface.
    return null
  }

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
    <section className="rounded-md border border-border bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Sourced content preview</h3>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Chip>{served_locale}</Chip>
          <Chip variant={match_kind === "exact" ? "default" : "muted"}>match: {match_kind}</Chip>
          <Chip variant={source === "synthesized" ? "warning" : "default"}>{source}</Chip>
          {served_stale ? <Chip variant="warning">stale</Chip> : null}
          {synthesized ? <Chip variant="muted">synthesizer fallback</Chip> : null}
          {machine_translated ? <Chip variant="muted">MT</Chip> : null}
        </div>
      </header>

      <div className="space-y-3 text-sm">
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
      </div>
    </section>
  )
}

function Chip({
  children,
  variant = "default",
}: {
  children: React.ReactNode
  variant?: "default" | "muted" | "warning"
}) {
  const className =
    variant === "warning"
      ? "rounded-full bg-amber-100 px-2 py-0.5 text-amber-900"
      : variant === "muted"
        ? "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
        : "rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground"
  return <span className={className}>{children}</span>
}
