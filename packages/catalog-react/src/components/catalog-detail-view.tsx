"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyant-travel/ui/components/tabs"
import { Loader2 } from "lucide-react"
import { type ReactNode, useMemo } from "react"
import { useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import type {
  CatalogDeparturePricingRow,
  CatalogDetailEnrichment,
  CatalogSearchHit,
} from "../index.js"
import { CabinCard, ShipCard } from "./catalog-detail-cruise-cards.js"
import { DeparturesTable } from "./catalog-detail-departures.js"
import {
  ArrayBadges,
  AttributeList,
  DefaultMediaGrid,
  formatTemplate,
  humanize,
  InlineTagsEditor,
  Section,
  stringOr,
  toStringArray,
} from "./catalog-detail-parts.js"
import type { CatalogDetailItineraryDay, CatalogDetailRenderSlot } from "./catalog-detail-sheet.js"
import { MediaGallery } from "./media-gallery.js"

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
 * Array fields the index emits that don't carry operator-facing value in
 * the Tags & themes section — either duplicates of a friendlier sibling
 * (`destinationSlugs` ↔ `regions`/`countries`/`cities`; `categorySlugs`
 * ↔ `categoryIds`; `tagIds` ↔ `tagLabels`/`tags`) or noise derived from
 * other rendered fields (`departureMonths` is a roll-up of
 * `departureDates`). Hidden at render time; the underlying index still
 * carries them for facets/filters.
 */
const HIDDEN_ARRAY_FIELDS = new Set([
  // Departure surface lives in its own Departures tab now — the
  // raw date / month chip lists in Tags & themes are redundant.
  "departureDates",
  "departureMonths",
  "destinationIds",
  "destinationSlugs",
  // Three category projections cover the same relation: keep the
  // friendly localized `categories` list, drop the id + slug mirrors.
  "categoryIds",
  "categorySlugs",
  // `tagIds` + `tagLabels` mirror the relational tags table; keep only
  // the operator-authored `tags` jsonb column.
  "tagIds",
  "tagLabels",
  // Canonical geography id mirrors — the resolved name lists
  // (`countries`/`regions`/`ports`/`waterways`) carry the display values, so
  // the raw id columns are noise in the overview.
  "country_iso",
  "region_ids",
  "port_ids",
  "waterway_ids",
])

/**
 * Array-field label overrides for the Tags & themes section. Falls
 * through to `humanize(key)` when not present. Localized variants come
 * in via `messages.detail.arrayLabels` per locale — this stays as a
 * stable fallback for any call path that hasn't been wired yet.
 */
const ARRAY_LABEL_OVERRIDES: Record<string, string> = {
  // i18n-literal-ok: fallback when no localized override is provided
  categories: "Category",
}

/**
 * Right-side detail sheet for any catalog hit. Header shows the entity's
 * primary image, name, status, and id. Body is split into Description,
 * Highlights/Tags (when present), and a clean two-column attribute grid.
 * System provenance fields are tucked into a collapsible at the bottom.
 */

export interface CatalogDetailViewProps {
  hit: CatalogSearchHit | null
  enrichment: CatalogDetailEnrichment | null
  /** Show the "loading full content" hint above the tabs. */
  enrichmentLoading?: boolean
  vertical?: string
  formatters?: Record<string, (value: unknown) => ReactNode>
  renderBrochure?: CatalogDetailRenderSlot
  renderMedia?: CatalogDetailRenderSlot
  renderItineraryDay?: (
    day: CatalogDetailItineraryDay,
    hit: CatalogSearchHit,
    enrichment: CatalogDetailEnrichment,
  ) => ReactNode
  renderExtraSections?: CatalogDetailRenderSlot
  renderSupplierLink?: (supplierId: string, displayName: string) => ReactNode
  onLoadDeparturePricing?: (
    hit: CatalogSearchHit,
    sailingRef: string,
  ) => Promise<CatalogDeparturePricingRow[] | null>
  onBookDeparture?: (
    hit: CatalogSearchHit,
    departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
  ) => void
  onBookOption?: (
    hit: CatalogSearchHit,
    departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
    option: NonNullable<CatalogDetailEnrichment["options"]>[number],
  ) => void
  onTagsChange?: (hit: CatalogSearchHit, tags: string[]) => Promise<void> | void
  /** Wrapper className — the sheet scrolls (`flex-1 overflow-y-auto px-6 py-5`),
   *  a full-page host can pass its own (or nothing). */
  className?: string
}

/**
 * The tabbed detail BODY for a catalog hit — overview, itinerary, ship,
 * cabins/rooms/options, departures/sailings (with live cabin pricing), media,
 * policies, attributes. Layout-agnostic: it owns no modal/page chrome, so it's
 * shared by {@link CatalogDetailSheet} (in a Sheet) and the operator's
 * full-page, new-tab detail route. Enrichment is passed in (the host owns the
 * fetch) since the host header also needs it.
 */
export function CatalogDetailView({
  hit,
  enrichment,
  enrichmentLoading = false,
  vertical,
  formatters,
  renderBrochure,
  renderMedia,
  renderItineraryDay,
  renderExtraSections,
  renderSupplierLink,
  onLoadDeparturePricing,
  onBookDeparture,
  onBookOption,
  onTagsChange,
  className,
}: CatalogDetailViewProps) {
  const catalogMessages = useCatalogUiMessagesOrDefault().catalogPage
  const messages = catalogMessages.detail
  // Cruises sell cabin categories, not generic options — label the tab "Cabins".
  const optionsLabel = vertical === "cruises" ? messages.cabins : messages.options
  // In the cruise industry a scheduled departure is a "sailing".
  const departuresLabel = vertical === "cruises" ? messages.sailings : messages.departures
  const fields = hit?.document.fields ?? {}
  const name = stringOr(fields.name, catalogMessages.fallbacks.detailName)
  const description = stringOr(enrichment?.description, null) ?? stringOr(fields.description, null)
  const shortDescription =
    stringOr(enrichment?.shortDescription, null) ?? stringOr(fields.shortDescription, null)
  const brochureContent = hit && renderBrochure ? renderBrochure(hit, enrichment) : null
  const hasCustomMediaRenderer = hit != null && renderMedia != null
  const mediaContent = hit && renderMedia ? renderMedia(hit, enrichment) : null
  const shouldRenderMediaSection = hasCustomMediaRenderer
    ? mediaContent !== null && mediaContent !== undefined && mediaContent !== false
    : enrichment?.media != null && enrichment.media.length > 0
  const extraSections = hit && renderExtraSections ? renderExtraSections(hit, enrichment) : null

  const { arrayEntries, attributeEntries, systemEntries } = useMemo(() => {
    const allEntries = Object.entries(fields).filter(([k]) => !HIDDEN_FIELDS.has(k))
    const array: Array<[string, unknown]> = []
    const attrs: Array<[string, unknown]> = []
    const system: Array<[string, unknown]> = []
    for (const [k, v] of allEntries) {
      if (SYSTEM_FIELD_PREFIXES.some((p) => k.startsWith(p))) system.push([k, v])
      else if (ARRAY_FIELDS.has(k) || Array.isArray(v)) {
        if (HIDDEN_ARRAY_FIELDS.has(k)) continue
        if (k !== "tags" && Array.isArray(v) && v.length === 0) continue
        array.push([k, v])
      } else attrs.push([k, v])
    }
    return { arrayEntries: array, attributeEntries: attrs, systemEntries: system }
  }, [fields])

  const overviewGalleryImages = useMemo(() => {
    const urls: string[] = []
    if (enrichment?.heroImageUrl) urls.push(enrichment.heroImageUrl)
    for (const option of enrichment?.options ?? []) {
      const cover = option.images?.[0]
      if (cover) urls.push(cover)
    }
    return Array.from(new Set(urls))
  }, [enrichment])

  const reshapedAttributeEntries: Array<[string, unknown]> = (() => {
    const map = new Map(attributeEntries)
    const out: Array<[string, unknown]> = []
    let didAmount = false
    for (const [k, v] of attributeEntries) {
      if (k === "pax") continue
      if (k === "sellCurrency") continue
      if (k === "sellAmountCents") {
        const currency = stringOr(map.get("sellCurrency"), "USD") as string
        out.push(["sellAmount", { amountCents: v, currency }])
        didAmount = true
        continue
      }
      out.push([k, v])
    }
    if (!didAmount && map.has("sellCurrency")) {
      out.push(["sellCurrency", map.get("sellCurrency")])
    }
    return out
  })()

  const hasItinerary = (enrichment?.itinerary?.length ?? 0) > 0
  const hasShip = enrichment?.ship != null
  const hasOptions = (enrichment?.options?.length ?? 0) > 0
  const hasDepartures = (enrichment?.departures?.length ?? 0) > 0
  const hasPolicies = (enrichment?.policies?.length ?? 0) > 0
  const hasAttributes =
    reshapedAttributeEntries.length > 0 || arrayEntries.length > 0 || systemEntries.length > 0

  return (
    <div className={className}>
      {enrichmentLoading && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {messages.loadingFullContent}
        </div>
      )}
      <Tabs defaultValue="overview" className="gap-4">
        <TabsList>
          <TabsTrigger value="overview">{messages.tabs.overview}</TabsTrigger>
          {hasItinerary && <TabsTrigger value="itinerary">{messages.itinerary}</TabsTrigger>}
          {hasShip && <TabsTrigger value="ship">{messages.ship}</TabsTrigger>}
          {hasOptions && <TabsTrigger value="options">{optionsLabel}</TabsTrigger>}
          {hasDepartures && <TabsTrigger value="departures">{departuresLabel}</TabsTrigger>}
          {shouldRenderMediaSection && <TabsTrigger value="media">{messages.media}</TabsTrigger>}
          {hasPolicies && <TabsTrigger value="policies">{messages.policies}</TabsTrigger>}
          {hasAttributes && <TabsTrigger value="attributes">{messages.attributes}</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6">
          {overviewGalleryImages.length > 1 && (
            <Section title={messages.media}>
              <MediaGallery
                images={overviewGalleryImages}
                alt={name}
                className="w-full max-w-lg"
                imageClassName="h-56 w-full"
              />
            </Section>
          )}

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
            <Section title={messages.highlights}>
              <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                {enrichment.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </Section>
          )}

          {enrichment?.supplier && (
            <Section title={messages.supplier}>
              <p className="text-sm text-foreground">{enrichment.supplier}</p>
            </Section>
          )}

          {arrayEntries.length > 0 && (
            <Section title={messages.tagsThemes}>
              <div className="flex flex-col gap-3">
                {arrayEntries.map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {ARRAY_LABEL_OVERRIDES[key] ?? humanize(key)}
                    </span>
                    {key === "tags" && hit && onTagsChange ? (
                      <InlineTagsEditor
                        hit={hit}
                        value={toStringArray(value)}
                        onChange={onTagsChange}
                        placeholder={messages.tagsInputPlaceholder}
                      />
                    ) : (
                      <ArrayBadges value={value} />
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {brochureContent && <Section title={messages.brochure}>{brochureContent}</Section>}

          {extraSections}
        </TabsContent>

        {hasItinerary && (
          <TabsContent value="itinerary" className="flex flex-col gap-2">
            <ol className="space-y-2">
              {enrichment?.itinerary?.map((d) => (
                <li key={d.dayNumber}>
                  {renderItineraryDay && hit ? (
                    renderItineraryDay(d, hit, enrichment)
                  ) : (
                    <DefaultItineraryDay day={d} dayLabel={messages.day} />
                  )}
                </li>
              ))}
            </ol>
          </TabsContent>
        )}

        {hasShip && enrichment?.ship && (
          <TabsContent value="ship">
            <ShipCard ship={enrichment.ship} messages={messages} />
          </TabsContent>
        )}

        {hasOptions && (
          <TabsContent value="options">
            <ul className="space-y-3">
              {enrichment?.options?.map((o) => (
                <CabinCard key={o.id} cabin={o} messages={messages} />
              ))}
            </ul>
          </TabsContent>
        )}

        {hasDepartures && enrichment?.departures && (
          <TabsContent value="departures">
            <DeparturesTable
              hit={hit}
              vertical={vertical}
              departures={enrichment.departures}
              options={enrichment?.options ?? []}
              onLoadDeparturePricing={onLoadDeparturePricing}
              productSellAmountCents={
                typeof fields.sellAmountCents === "number"
                  ? fields.sellAmountCents
                  : typeof fields.sellAmountCents === "string"
                    ? Number(fields.sellAmountCents) || null
                    : null
              }
              productSellCurrency={
                typeof fields.sellCurrency === "string" ? fields.sellCurrency : null
              }
              onBookDeparture={onBookDeparture}
              onBookOption={onBookOption}
              messages={messages}
            />
          </TabsContent>
        )}

        {shouldRenderMediaSection && (
          <TabsContent value="media">
            {mediaContent ?? <DefaultMediaGrid media={enrichment?.media ?? []} />}
          </TabsContent>
        )}

        {hasPolicies && (
          <TabsContent value="policies">
            <dl className="space-y-2 text-sm">
              {enrichment?.policies?.map((p, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: ordering is stable per render -- owner: catalog-react; existing suppression is intentional pending typed cleanup.
                <div key={`${p.kind}-${idx}`}>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {p.kind.replace(/_/g, " ")}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line text-muted-foreground">{p.body}</dd>
                </div>
              ))}
            </dl>
          </TabsContent>
        )}

        {hasAttributes && (
          <TabsContent value="attributes" className="flex flex-col gap-6">
            {reshapedAttributeEntries.length > 0 && (
              <AttributeList
                entries={reshapedAttributeEntries}
                formatters={formatters}
                messages={catalogMessages}
                renderSupplierLink={renderSupplierLink}
              />
            )}
            {systemEntries.length > 0 && (
              <details className="group rounded-lg border bg-muted/20">
                <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-muted/40 group-open:border-b">
                  {messages.system}
                </summary>
                <div className="px-4 py-3">
                  <AttributeList
                    entries={systemEntries}
                    formatters={formatters}
                    messages={catalogMessages}
                  />
                </div>
              </details>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function DefaultItineraryDay({
  day,
  dayLabel,
}: {
  day: CatalogDetailItineraryDay
  dayLabel: string
}) {
  return (
    <div className="flex gap-3 rounded-md border border-border bg-muted/10 p-3 text-sm">
      {day.heroImageUrl ? (
        <img
          src={day.heroImageUrl}
          alt={day.title ?? formatTemplate(dayLabel, { day: day.dayNumber })}
          className="h-20 w-28 shrink-0 rounded-md object-cover ring-1 ring-border"
          loading="lazy"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {formatTemplate(dayLabel, { day: day.dayNumber })}
          </span>
          {day.title && <span className="font-medium">{day.title}</span>}
          {day.location && <span className="text-xs text-muted-foreground">· {day.location}</span>}
        </div>
        {day.description && (
          <p className="text-xs leading-relaxed text-muted-foreground">{day.description}</p>
        )}
      </div>
    </div>
  )
}
