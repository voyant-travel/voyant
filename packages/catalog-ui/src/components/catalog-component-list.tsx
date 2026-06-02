"use client"

import { Badge } from "@voyantjs/ui/components/badge"

import type { CatalogDetailComponent } from "./catalog-component-enrichment.js"

export function ProductComponentsList({
  components,
}: {
  components: ReadonlyArray<CatalogDetailComponent>
}) {
  const sorted = [...components].sort((a, b) => {
    const aq = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER
    const bq = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER
    if (aq !== bq) return aq - bq
    return a.title.localeCompare(b.title)
  })

  return (
    <ul className="space-y-3">
      {sorted.map((component) => (
        <ProductComponentCard key={component.id} component={component} />
      ))}
    </ul>
  )
}

function ProductComponentCard({ component }: { component: CatalogDetailComponent }) {
  const cover = component.media?.find((item) => item.type === "image" || item.type == null)
  const detailLines = component.detailLines ?? []

  return (
    <li className="flex gap-3 rounded-md border bg-muted/10 p-3 text-sm">
      {cover ? (
        <img
          src={cover.url}
          alt={cover.caption ?? component.title}
          className="h-20 w-28 shrink-0 rounded-md object-cover ring-1 ring-border"
          loading="lazy"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium">{component.title}</div>
            {component.summary && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {component.summary}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <Badge variant="secondary" className="font-normal capitalize">
              {component.kind.replace(/_/g, " ")}
            </Badge>
            {component.priceDisposition && (
              <Badge variant="outline" className="font-normal capitalize">
                {component.priceDisposition.replace(/_/g, " ")}
              </Badge>
            )}
            {component.selection && component.selection !== "fixed" && (
              <Badge variant="outline" className="font-normal capitalize">
                {component.selection.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>

        {component.description && (
          <p className="text-xs leading-relaxed text-muted-foreground">{component.description}</p>
        )}

        {detailLines.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {detailLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        {component.choices && component.choices.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {component.choices.map((choice) => (
              <Badge
                key={choice.id}
                variant={choice.isDefault ? "default" : "outline"}
                className="font-normal"
              >
                {choice.title}
              </Badge>
            ))}
          </div>
        )}

        {component.tags && component.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {component.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}
