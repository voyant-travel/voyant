"use client"

import { Badge } from "@voyant-travel/ui/components/badge"
import { Button } from "@voyant-travel/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@voyant-travel/ui/components/sheet"
import { cn } from "@voyant-travel/ui/lib/utils"
import { type ReactNode, useEffect, useState } from "react"

import { useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import type {
  CatalogDeparturePricingRow,
  CatalogDetailEnrichment,
  CatalogSearchHit,
} from "../index.js"
import {
  formatTemplate,
  IdChip,
  initialsOf,
  ProductPriceFrom,
  sheetWidthClass,
  stringOr,
} from "./catalog-detail-parts.js"
import { CatalogDetailView } from "./catalog-detail-view.js"

export { CatalogDetailView, type CatalogDetailViewProps } from "./catalog-detail-view.js"

export interface CatalogDetailAction {
  label: string
  onClick: (hit: CatalogSearchHit) => void
  variant?: "default" | "secondary" | "outline" | "ghost"
  /**
   * Optional predicate to hide the action for specific hits — e.g. only
   * show "Open editor" when the hit is an owned product. Defaults to
   * always-visible when omitted.
   */
  visible?: (hit: CatalogSearchHit) => boolean
}

// `CatalogDetailEnrichment` (the on-demand detail view-model) now lives in the
// data layer (`@voyant-travel/catalog-react`) alongside the content client that
// produces it; re-exported here for back-compat with the catalog-ui surface.
export type { CatalogDetailEnrichment }

export type CatalogDetailSheetWidth =
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl"
  | "6xl"
  | string

export type CatalogDetailItineraryDay = NonNullable<CatalogDetailEnrichment["itinerary"]>[number]

export type CatalogDetailRenderSlot = (
  hit: CatalogSearchHit,
  enrichment: CatalogDetailEnrichment | null,
) => ReactNode

export interface CatalogDetailSheetProps {
  hit: CatalogSearchHit | null
  onOpenChange: (open: boolean) => void
  formatters?: Record<string, (value: unknown) => ReactNode>
  actions?: CatalogDetailAction[]
  imageField?: string
  /**
   * The catalog vertical this sheet renders. Used for per-vertical labels —
   * e.g. cruises label the "Options" tab "Cabins" since the options are cabin
   * categories.
   */
  vertical?: string
  /**
   * Sheet max-width token or class name. Defaults to `5xl` so rich catalog
   * details can use two columns on wide operator screens.
   */
  width?: CatalogDetailSheetWidth
  /** Secondary header content such as print/download icon buttons. */
  headerExtras?: ReactNode | CatalogDetailRenderSlot
  /**
   * Called once when the sheet opens for a hit. The result is rendered
   * in dedicated sections (description, highlights, itinerary, media,
   * options, policies). Errors swallowed silently — the sheet still
   * shows the indexed-projection fallback.
   */
  onLoadDetail?: (hit: CatalogSearchHit) => Promise<CatalogDetailEnrichment | null>
  /**
   * Called lazily when a departure (cruise sailing) row expands, to fetch live
   * per-cabin pricing + availability. Returns `null` when unavailable. The
   * caller binds the vertical; the sheet passes the cruise hit + sailing ref.
   */
  onLoadDeparturePricing?: (
    hit: CatalogSearchHit,
    sailingRef: string,
  ) => Promise<CatalogDeparturePricingRow[] | null>
  /**
   * Called when the operator clicks a per-departure Book button. When
   * omitted, departures render without a book affordance — the
   * sheet-level `actions` (e.g. "Book this") still apply.
   */
  onBookDeparture?: (
    hit: CatalogSearchHit,
    departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
  ) => void
  /**
   * Per-option book affordance. When set, the expanded departure panel
   * renders a Book button on each option row; the callback receives the
   * departure plus the chosen option so the booking journey can
   * pre-select it. Falls back to `onBookDeparture` when omitted.
   */
  onBookOption?: (
    hit: CatalogSearchHit,
    departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
    option: NonNullable<CatalogDetailEnrichment["options"]>[number],
  ) => void
  /** Dedicated brochure/print section rendered above media. */
  renderBrochure?: CatalogDetailRenderSlot
  /** Consumer-provided media rendering, replacing the default thumbnail grid. */
  renderMedia?: CatalogDetailRenderSlot
  /** Consumer-provided itinerary day renderer for richer day cards. */
  renderItineraryDay?: (
    day: CatalogDetailItineraryDay,
    hit: CatalogSearchHit,
    enrichment: CatalogDetailEnrichment,
  ) => ReactNode
  /** Additional consumer sections rendered above the footer actions. */
  renderExtraSections?: CatalogDetailRenderSlot
  /**
   * Render a clickable supplier link in the Attributes tab. When set,
   * the `supplierId` row uses this renderer instead of the plain
   * formatter — typically a router-aware Link to the supplier detail
   * page. Receives the supplier id and the display name (already
   * resolved by `formatters.supplierId`).
   */
  renderSupplierLink?: (supplierId: string, displayName: string) => ReactNode
  /**
   * When provided, the Tags row in the Overview tab swaps its read-only
   * chips for an inline add/remove editor. The callback is invoked with
   * the *next* tag list (after the local optimistic update); rejecting
   * the promise reverts to the indexed tags.
   *
   * Only the `tags` field — the operator-authored jsonb list — is
   * editable. Index-derived arrays (categories, regions, etc.) stay
   * read-only because they're computed from elsewhere.
   */
  onTagsChange?: (hit: CatalogSearchHit, tags: string[]) => Promise<void> | void
}

export function CatalogDetailSheet({
  hit,
  onOpenChange,
  formatters,
  actions,
  imageField = "thumbnailUrl",
  width = "5xl",
  vertical,
  headerExtras,
  onLoadDetail,
  onLoadDeparturePricing,
  onBookDeparture,
  onBookOption,
  renderBrochure,
  renderMedia,
  renderItineraryDay,
  renderExtraSections,
  renderSupplierLink,
  onTagsChange,
}: CatalogDetailSheetProps) {
  const catalogMessages = useCatalogUiMessagesOrDefault().catalogPage
  const messages = catalogMessages.detail
  const open = hit != null
  const fields = hit?.document.fields ?? {}
  const name = stringOr(fields.name, catalogMessages.fallbacks.detailName)
  const status = stringOr(fields.status, null)

  // Enrichment fetch — fires when the sheet opens for a hit. The
  // useEffect dep list includes hit.id so re-opening a different row
  // refetches; the result is local to the open instance, so closing
  // the sheet clears it.
  const [enrichment, setEnrichment] = useState<CatalogDetailEnrichment | null>(null)
  const [enrichmentLoading, setEnrichmentLoading] = useState(false)
  useEffect(() => {
    if (!hit || !onLoadDetail) {
      setEnrichment(null)
      setEnrichmentLoading(false)
      return
    }
    let cancelled = false
    setEnrichmentLoading(true)
    setEnrichment(null)
    onLoadDetail(hit)
      .then((result) => {
        if (!cancelled) {
          setEnrichment(result ?? null)
          setEnrichmentLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnrichment(null)
          setEnrichmentLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [hit, onLoadDetail])

  const imageUrl = stringOr(enrichment?.heroImageUrl, null) ?? stringOr(fields[imageField], null)
  const resolvedHeaderExtras =
    hit && headerExtras
      ? typeof headerExtras === "function"
        ? headerExtras(hit, enrichment)
        : headerExtras
      : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn("w-full p-0", sheetWidthClass(width))}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <SheetHeader className="border-b bg-muted/20 px-6 py-5">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="flex min-w-0 items-start gap-4">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-border"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-medium text-white ring-1 ring-border">
                    {initialsOf(name)}
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <SheetTitle className="text-base leading-snug">{name}</SheetTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {status && (
                      <Badge
                        variant={status === "active" || status === "live" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {status}
                      </Badge>
                    )}
                    {hit?.id && <IdChip id={hit.id} />}
                    {enrichment?.servedLocale && (
                      <Badge variant="outline" className="font-normal">
                        {enrichment.servedLocale}
                      </Badge>
                    )}
                    {enrichment?.matchKind && enrichment.matchKind !== "exact" && (
                      <Badge variant="outline" className="font-normal">
                        {formatTemplate(messages.matchPrefix, { kind: enrichment.matchKind })}
                      </Badge>
                    )}
                    {enrichment?.source && (
                      <Badge
                        variant={enrichment.source === "synthesized" ? "outline" : "secondary"}
                        className="font-normal"
                      >
                        {enrichment.source}
                      </Badge>
                    )}
                    {enrichment?.servedStale && (
                      <Badge variant="outline" className="font-normal">
                        {messages.stale}
                      </Badge>
                    )}
                    {enrichment?.machineTranslated && (
                      <Badge variant="outline" className="font-normal">
                        MT
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <ProductPriceFrom enrichment={enrichment} fields={fields} messages={messages} />
                {resolvedHeaderExtras && (
                  <div className="flex items-center gap-2">{resolvedHeaderExtras}</div>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Body — the shared tabbed detail view (also used full-page). */}
          <CatalogDetailView
            hit={hit}
            enrichment={enrichment}
            enrichmentLoading={enrichmentLoading}
            vertical={vertical}
            formatters={formatters}
            renderBrochure={renderBrochure}
            renderMedia={renderMedia}
            renderItineraryDay={renderItineraryDay}
            renderExtraSections={renderExtraSections}
            renderSupplierLink={renderSupplierLink}
            onLoadDeparturePricing={onLoadDeparturePricing}
            onBookDeparture={onBookDeparture}
            onBookOption={onBookOption}
            onTagsChange={onTagsChange}
            className="flex-1 overflow-y-auto px-6 py-5"
          />

          {/* Footer */}
          {(() => {
            if (!hit || !actions || actions.length === 0) return null
            const visibleActions = actions.filter((a) => (a.visible ? a.visible(hit) : true))
            if (visibleActions.length === 0) return null
            return (
              <SheetFooter className="border-t bg-muted/20 px-6 py-3">
                <div className="flex flex-wrap justify-end gap-2">
                  {visibleActions.map((a) => (
                    <Button
                      key={a.label}
                      variant={a.variant ?? "default"}
                      size="sm"
                      onClick={() => {
                        a.onClick(hit)
                        onOpenChange(false)
                      }}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              </SheetFooter>
            )
          })()}
        </div>
      </SheetContent>
    </Sheet>
  )
}
