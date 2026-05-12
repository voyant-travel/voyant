"use client"

import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components/sheet"
import { cn } from "@voyantjs/ui/lib/utils"
import { Check, ExternalLink, Loader2, Minus } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"

export interface CatalogDetailAction {
  label: string
  onClick: (hit: CatalogSearchHit) => void
  variant?: "default" | "secondary" | "outline" | "ghost"
}

/**
 * Rich detail enrichment loaded on-demand when the sheet opens.
 * Fetched separately from the search index — the index keeps a lean
 * facetable projection; the enrichment carries everything else via the
 * catalog content service (description, itinerary, media, options,
 * policies, supplier).
 */
export interface CatalogDetailEnrichment {
  description?: string | null
  shortDescription?: string | null
  highlights?: ReadonlyArray<string>
  heroImageUrl?: string | null
  supplier?: string | null
  itinerary?: ReadonlyArray<{
    dayNumber: number
    title?: string | null
    description?: string | null
    location?: string | null
  }>
  media?: ReadonlyArray<{ url: string; type?: string; caption?: string | null }>
  options?: ReadonlyArray<{ id: string; name: string; description?: string | null }>
  policies?: ReadonlyArray<{ kind: string; body: string }>
  departures?: ReadonlyArray<{
    id: string
    startsAt: string
    endsAt?: string | null
    status?: string | null
    unlimited?: boolean | null
    capacity?: number | null
    remaining?: number | null
    lowestPriceCents?: number | null
    currency?: string | null
    note?: string | null
  }>
  /** Resolution metadata — drives the chips at the top. */
  servedLocale?: string
  matchKind?: string
  source?: string
  servedStale?: boolean
  synthesized?: boolean
  machineTranslated?: boolean
}

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
   * Called when the operator clicks a per-departure Book button. When
   * omitted, departures render without a book affordance — the
   * sheet-level `actions` (e.g. "Book this") still apply.
   */
  onBookDeparture?: (
    hit: CatalogSearchHit,
    departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
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
}

const HIDDEN_FIELDS = new Set([
  "id",
  "name",
  "description",
  "shortDescription",
  "status",
  "text_embedding",
  "embedding_model_id",
])

const SYSTEM_FIELD_PREFIXES = ["source.", "seller."] as const

const ARRAY_FIELDS = new Set(["tags", "highlights", "regions", "themes", "defaultBookingModes"])

/**
 * Right-side detail sheet for any catalog hit. Header shows the entity's
 * primary image, name, status, and id. Body is split into Description,
 * Highlights/Tags (when present), and a clean two-column attribute grid.
 * System provenance fields are tucked into a collapsible at the bottom.
 */
export function CatalogDetailSheet({
  hit,
  onOpenChange,
  formatters,
  actions,
  imageField = "thumbnailUrl",
  width = "5xl",
  headerExtras,
  onLoadDetail,
  onBookDeparture,
  renderBrochure,
  renderMedia,
  renderItineraryDay,
  renderExtraSections,
}: CatalogDetailSheetProps) {
  const open = hit != null
  const fields = hit?.document.fields ?? {}
  const name = stringOr(fields.name, "Untitled")
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

  const description = stringOr(enrichment?.description, null) ?? stringOr(fields.description, null)
  const shortDescription =
    stringOr(enrichment?.shortDescription, null) ?? stringOr(fields.shortDescription, null)
  const imageUrl = stringOr(enrichment?.heroImageUrl, null) ?? stringOr(fields[imageField], null)
  const resolvedHeaderExtras =
    hit && headerExtras
      ? typeof headerExtras === "function"
        ? headerExtras(hit, enrichment)
        : headerExtras
      : null
  const brochureContent = hit && renderBrochure ? renderBrochure(hit, enrichment) : null
  const mediaContent = hit && renderMedia ? renderMedia(hit, enrichment) : null
  const extraSections = hit && renderExtraSections ? renderExtraSections(hit, enrichment) : null

  const allEntries = Object.entries(fields).filter(([k]) => !HIDDEN_FIELDS.has(k))
  const arrayEntries: Array<[string, unknown]> = []
  const attributeEntries: Array<[string, unknown]> = []
  const systemEntries: Array<[string, unknown]> = []
  for (const [k, v] of allEntries) {
    if (SYSTEM_FIELD_PREFIXES.some((p) => k.startsWith(p))) systemEntries.push([k, v])
    else if (ARRAY_FIELDS.has(k) || Array.isArray(v)) arrayEntries.push([k, v])
    else attributeEntries.push([k, v])
  }

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
                    {hit?.id && (
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {hit.id}
                      </code>
                    )}
                    {enrichment?.servedLocale && (
                      <Badge variant="outline" className="font-normal">
                        {enrichment.servedLocale}
                      </Badge>
                    )}
                    {enrichment?.matchKind && enrichment.matchKind !== "exact" && (
                      <Badge variant="outline" className="font-normal">
                        match: {enrichment.matchKind}
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
                        stale
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
              {resolvedHeaderExtras && (
                <div className="flex shrink-0 items-center gap-2">{resolvedHeaderExtras}</div>
              )}
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
              {enrichmentLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground xl:col-span-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading full content…
                </div>
              )}

              <div className="flex min-w-0 flex-col gap-6">
                {(shortDescription || description) && (
                  <Section>
                    {shortDescription && (
                      <p className="text-sm font-medium leading-relaxed text-foreground">
                        {shortDescription}
                      </p>
                    )}
                    {description && (
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {description}
                      </p>
                    )}
                  </Section>
                )}

                {enrichment?.highlights && enrichment.highlights.length > 0 && (
                  <Section title="Highlights">
                    <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                      {enrichment.highlights.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </Section>
                )}

                {enrichment?.supplier && (
                  <Section title="Supplier">
                    <p className="text-sm text-foreground">{enrichment.supplier}</p>
                  </Section>
                )}

                {enrichment?.itinerary && enrichment.itinerary.length > 0 && (
                  <Section title="Itinerary">
                    <ol className="space-y-2">
                      {enrichment.itinerary.map((d) => (
                        <li key={d.dayNumber}>
                          {renderItineraryDay && hit ? (
                            renderItineraryDay(d, hit, enrichment)
                          ) : (
                            <DefaultItineraryDay day={d} />
                          )}
                        </li>
                      ))}
                    </ol>
                  </Section>
                )}

                {arrayEntries.length > 0 && (
                  <Section title="Tags & themes">
                    <div className="flex flex-col gap-3">
                      {arrayEntries.map(([key, value]) => (
                        <div key={key} className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            {humanize(key)}
                          </span>
                          <ArrayBadges value={value} />
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {attributeEntries.length > 0 && (
                  <Section title="Attributes">
                    <AttributeList entries={attributeEntries} formatters={formatters} />
                  </Section>
                )}

                {systemEntries.length > 0 && (
                  <details className="group rounded-lg border bg-muted/20">
                    <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-muted/40 group-open:border-b">
                      System
                    </summary>
                    <div className="px-4 py-3">
                      <AttributeList entries={systemEntries} formatters={formatters} />
                    </div>
                  </details>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-6">
                {enrichment?.departures && enrichment.departures.length > 0 && (
                  <Section title="Departures">
                    <ul className="divide-y rounded-md border">
                      {enrichment.departures.slice(0, 12).map((d) => {
                        const soldOut =
                          d.status === "sold_out" ||
                          d.status === "closed" ||
                          d.status === "cancelled" ||
                          (typeof d.remaining === "number" && d.remaining <= 0)
                        const availabilityLabel = formatDepartureAvailability(d)
                        return (
                          <li
                            key={d.id}
                            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{formatDeparture(d.startsAt)}</span>
                              {d.endsAt && (
                                <span className="text-xs text-muted-foreground">
                                  ends {formatDeparture(d.endsAt)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {availabilityLabel && (
                                <span className="text-xs text-muted-foreground">
                                  {availabilityLabel}
                                </span>
                              )}
                              {typeof d.lowestPriceCents === "number" && (
                                <span className="font-medium tabular-nums">
                                  {formatPriceCents(d.lowestPriceCents, d.currency)}
                                </span>
                              )}
                              {d.status && (
                                <Badge variant="outline" className="font-normal">
                                  {d.status}
                                </Badge>
                              )}
                              {onBookDeparture && hit && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={soldOut}
                                  onClick={() => onBookDeparture(hit, d)}
                                >
                                  Book
                                </Button>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </Section>
                )}

                {enrichment?.options && enrichment.options.length > 0 && (
                  <Section title="Options">
                    <ul className="space-y-1.5 text-sm">
                      {enrichment.options.map((o) => (
                        <li key={o.id} className="rounded-md border border-border px-3 py-2">
                          <div className="font-medium">{o.name}</div>
                          {o.description && (
                            <div className="text-xs text-muted-foreground">{o.description}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {enrichment?.policies && enrichment.policies.length > 0 && (
                  <Section title="Policies & terms">
                    <dl className="space-y-2 text-sm">
                      {enrichment.policies.map((p, idx) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: ordering is stable per render
                        <div key={`${p.kind}-${idx}`}>
                          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {p.kind.replace(/_/g, " ")}
                          </dt>
                          <dd className="mt-0.5 whitespace-pre-line text-muted-foreground">
                            {p.body}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Section>
                )}

                {brochureContent && <Section title="Brochure">{brochureContent}</Section>}

                {(mediaContent || (enrichment?.media && enrichment.media.length > 0)) && (
                  <Section title="Media">
                    {mediaContent ?? <DefaultMediaGrid media={enrichment?.media ?? []} />}
                  </Section>
                )}

                {extraSections}
              </div>
            </div>
          </div>

          {/* Footer */}
          {actions && actions.length > 0 && hit && (
            <SheetFooter className="border-t bg-muted/20 px-6 py-3">
              <div className="flex flex-wrap justify-end gap-2">
                {actions.map((a) => (
                  <Button
                    key={a.label}
                    variant={a.variant ?? "default"}
                    size="sm"
                    onClick={() => a.onClick(hit)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </SheetFooter>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DefaultItineraryDay({ day }: { day: CatalogDetailItineraryDay }) {
  return (
    <div className="rounded-md border border-border bg-muted/10 px-3 py-2 text-sm">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium text-muted-foreground">Day {day.dayNumber}</span>
        {day.title && <span className="font-medium">{day.title}</span>}
        {day.location && <span className="text-xs text-muted-foreground">· {day.location}</span>}
      </div>
      {day.description && <p className="mt-1 text-xs text-muted-foreground">{day.description}</p>}
    </div>
  )
}

function DefaultMediaGrid({ media }: { media: NonNullable<CatalogDetailEnrichment["media"]> }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {media.slice(0, 9).map((m, idx) =>
        m.type === "image" || m.type == null ? (
          <a
            // biome-ignore lint/suspicious/noArrayIndexKey: gallery is render-only and ordering is stable per response
            key={`${m.url}-${idx}`}
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="block aspect-square overflow-hidden rounded-md ring-1 ring-border hover:ring-primary"
          >
            <img
              src={m.url}
              alt={m.caption ?? ""}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </a>
        ) : (
          <a
            // biome-ignore lint/suspicious/noArrayIndexKey: gallery is render-only
            key={`${m.url}-${idx}`}
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="flex aspect-square items-center justify-center rounded-md bg-muted text-xs text-muted-foreground ring-1 ring-border hover:ring-primary"
          >
            {m.type}
          </a>
        ),
      )}
    </div>
  )
}

const SHEET_WIDTH_CLASSES: Record<string, string> = {
  md: "max-w-md!",
  lg: "max-w-lg!",
  xl: "max-w-xl!",
  "2xl": "max-w-2xl!",
  "3xl": "max-w-3xl!",
  "4xl": "max-w-4xl!",
  "5xl": "max-w-5xl!",
  "6xl": "max-w-6xl!",
}

function sheetWidthClass(width: CatalogDetailSheetWidth): string {
  return SHEET_WIDTH_CLASSES[width] ?? width
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}

function AttributeList({
  entries,
  formatters,
}: {
  entries: Array<[string, unknown]>
  formatters?: Record<string, (value: unknown) => ReactNode>
}) {
  return (
    <div className="divide-y rounded-lg border">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[140px_1fr] items-baseline gap-4 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">{humanize(key)}</span>
          <span className="text-sm break-words">
            {formatters?.[key] ? formatters[key](value) : defaultFormat(key, value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ArrayBadges({ value }: { value: unknown }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {value.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: array values aren't guaranteed unique (e.g. duplicate strings); the index disambiguates and the list is render-only.
        <Badge key={`${String(v)}-${i}`} variant="secondary" className="font-normal">
          {String(v)}
        </Badge>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Field formatting
// ─────────────────────────────────────────────────────────────────────────────

function defaultFormat(field: string, value: unknown): ReactNode {
  if (value == null || value === "") {
    return <span className="text-muted-foreground">—</span>
  }

  // Booleans (and string "true"/"false" — products schema stores some as strings)
  if (typeof value === "boolean" || value === "true" || value === "false") {
    const truthy = value === true || value === "true"
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-sm",
          truthy ? "text-emerald-600" : "text-muted-foreground",
        )}
      >
        {truthy ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        {truthy ? "Yes" : "No"}
      </span>
    )
  }

  // URLs (image, map, hero)
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        Open
        <ExternalLink className="h-3 w-3" />
      </a>
    )
  }

  // JSON-stringified ISO date — projection writes dates via JSON.stringify
  // so they arrive wrapped in quotes ("\"2026-04-30T17:41:01Z\"")
  if (typeof value === "string") {
    const stripped = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(stripped)) {
      const d = new Date(stripped)
      if (!Number.isNaN(d.getTime())) {
        return (
          <time dateTime={stripped} className="text-sm">
            {new Intl.DateTimeFormat(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            }).format(d)}
          </time>
        )
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(stripped)) {
      return <span className="text-sm">{stripped}</span>
    }
  }

  // Money fields stored as cents (integer string or number)
  if (/Cents$/.test(field)) {
    const num = typeof value === "number" ? value : Number(value)
    if (Number.isFinite(num)) {
      return (
        <span className="font-medium text-sm">
          {new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(num / 100)}
        </span>
      )
    }
  }

  // IDs — render in mono so they're visually distinct
  if (/Id$|^id$/.test(field) && typeof value === "string") {
    return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</code>
  }

  // Numeric strings (Typesense stores everything as string)
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
    return <span className="text-sm tabular-nums">{value}</span>
  }

  return <span className="text-sm">{String(value)}</span>
}

/**
 * Turn camelCase / snake_case / dotted paths into a human-readable label.
 * `defaultQuantity` → "Default quantity"
 * `seller.operator_id` → "Seller · operator id"
 * `text_embedding` → "Text embedding"
 */
function humanize(key: string): string {
  const pretty = key
    .replace(/\./g, " · ")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^(.)/, (m) => m.toUpperCase())
    .toLowerCase()
  return pretty.charAt(0).toUpperCase() + pretty.slice(1)
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

function stringOr<T>(value: unknown, fallback: T): string | T {
  return typeof value === "string" && value.length > 0 ? value : fallback
}

function formatDeparture(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function formatPriceCents(cents: number, currency?: string | null): string {
  if (!currency) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(cents / 100)
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDepartureAvailability(
  departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
): string | null {
  if (departure.unlimited) return "Unlimited"
  if (typeof departure.capacity === "number" && typeof departure.remaining === "number") {
    return `${departure.remaining} / ${departure.capacity} left`
  }
  if (typeof departure.remaining === "number") return `${departure.remaining} left`
  if (typeof departure.capacity === "number") return `${departure.capacity} capacity`
  if (departure.status && departure.status !== "open") return humanize(departure.status)
  return null
}
