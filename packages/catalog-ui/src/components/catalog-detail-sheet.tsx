"use client"

import type { CatalogSearchHit } from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { cn } from "@voyantjs/ui/lib/utils"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  X,
} from "lucide-react"
import {
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import type { CatalogUiMessages } from "../i18n/messages.js"
import type { CatalogDeparturePricingRow } from "./catalog-enrichment-fetchers.js"
import { MediaGallery } from "./media-gallery.js"

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
  /** The vessel a cruise sails on (Ship tab). */
  ship?: {
    id?: string | null
    name: string
    shipType?: string | null
    description?: string | null
    deckPlanUrl?: string | null
    deckPlans?: Array<{
      name: string
      level?: number | null
      imageUrl?: string | null
    }>
    capacity?: number | null
    decks?: number | null
    yearBuilt?: number | null
    images?: string[]
  } | null
  itinerary?: ReadonlyArray<{
    dayNumber: number
    title?: string | null
    description?: string | null
    location?: string | null
    date?: string | null
    arrivalTime?: string | null
    departureTime?: string | null
    isAtSea?: boolean | null
    /** Optional hero image rendered alongside the day card. */
    heroImageUrl?: string | null
  }>
  media?: ReadonlyArray<{ url: string; type?: string; caption?: string | null }>
  options?: ReadonlyArray<{
    id: string
    name: string
    description?: string | null
    code?: string | null
    type?: string | null
    images?: string[]
    floorplanImages?: string[]
    squareFeet?: string | null
    gradeCodes?: string[]
    wheelchairAccessible?: boolean
    capacityMax?: number | null
    amenities?: string[]
  }>
  policies?: ReadonlyArray<{ kind: string; body: string }>
  departures?: ReadonlyArray<{
    id: string
    sourceRef?: string | null
    startsAt: string
    endsAt?: string | null
    durationNights?: number | null
    status?: string | null
    embarkationPort?: string | null
    disembarkationPort?: string | null
    unlimited?: boolean | null
    capacity?: number | null
    remaining?: number | null
    lowestPriceCents?: number | null
    currency?: string | null
    note?: string | null
    itinerary?: ReadonlyArray<{
      dayNumber: number
      title?: string | null
      description?: string | null
      location?: string | null
      date?: string | null
      arrivalTime?: string | null
      departureTime?: string | null
      isAtSea?: boolean | null
    }>
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
  // Cruises sell cabin categories, not generic options — label the tab "Cabins".
  const optionsLabel = vertical === "cruises" ? messages.cabins : messages.options
  // In the cruise industry a scheduled departure is a "sailing".
  const departuresLabel = vertical === "cruises" ? messages.sailings : messages.departures
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
        // Skip empty arrays (e.g. ports/themes/waterways with no values) so the
        // overview doesn't show bare "—" rows. `tags` stays — it renders the
        // inline editor used to add the first tag.
        if (k !== "tags" && Array.isArray(v) && v.length === 0) continue
        array.push([k, v])
      } else attrs.push([k, v])
    }
    return { arrayEntries: array, attributeEntries: attrs, systemEntries: system }
  }, [fields])

  // Overview media gallery — the cruise cover plus one photo per cabin type.
  // Cruise-level media upstream is just the hero, so we surface the rich cabin
  // imagery here as a visual summary. Only shown when there's more than the
  // single hero (i.e. cabins carry photos).
  const overviewGalleryImages = useMemo(() => {
    const urls: string[] = []
    if (enrichment?.heroImageUrl) urls.push(enrichment.heroImageUrl)
    for (const option of enrichment?.options ?? []) {
      const cover = option.images?.[0]
      if (cover) urls.push(cover)
    }
    return Array.from(new Set(urls))
  }, [enrichment])

  // ─── Attribute reshaping ──────────────────────────────────────────────
  // Indexed projections expose `sellAmountCents` + `sellCurrency` as two
  // separate facetable fields, plus `pax`/`supplierId`/`visibility` as
  // raw values. Operators don't think in cents and don't need to see a
  // standalone currency row — collapse those into a single "Sell amount"
  // row formatted with the currency, drop `pax` from the list, and let
  // visibility render as a Badge. `supplierId` is renamed to "Supplier".
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
    // Edge case: `sellCurrency` is present but `sellAmountCents` isn't —
    // surface it as a plain row so we don't drop info silently.
    if (!didAmount && map.has("sellCurrency")) {
      out.push(["sellCurrency", map.get("sellCurrency")])
    }
    return out
  })()

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

          {/* Body */}
          {(() => {
            const hasItinerary = (enrichment?.itinerary?.length ?? 0) > 0
            const hasShip = enrichment?.ship != null
            const hasOptions = (enrichment?.options?.length ?? 0) > 0
            const hasDepartures = (enrichment?.departures?.length ?? 0) > 0
            const hasPolicies = (enrichment?.policies?.length ?? 0) > 0
            const hasAttributes =
              reshapedAttributeEntries.length > 0 ||
              arrayEntries.length > 0 ||
              systemEntries.length > 0
            return (
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {enrichmentLoading && (
                  <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {messages.loadingFullContent}
                  </div>
                )}
                <Tabs defaultValue="overview" className="gap-4">
                  <TabsList>
                    <TabsTrigger value="overview">{messages.tabs.overview}</TabsTrigger>
                    {hasItinerary && (
                      <TabsTrigger value="itinerary">{messages.itinerary}</TabsTrigger>
                    )}
                    {hasShip && <TabsTrigger value="ship">{messages.ship}</TabsTrigger>}
                    {hasOptions && <TabsTrigger value="options">{optionsLabel}</TabsTrigger>}
                    {hasDepartures && (
                      <TabsTrigger value="departures">{departuresLabel}</TabsTrigger>
                    )}
                    {shouldRenderMediaSection && (
                      <TabsTrigger value="media">{messages.media}</TabsTrigger>
                    )}
                    {hasPolicies && <TabsTrigger value="policies">{messages.policies}</TabsTrigger>}
                    {hasAttributes && (
                      <TabsTrigger value="attributes">{messages.attributes}</TabsTrigger>
                    )}
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

                    {brochureContent && (
                      <Section title={messages.brochure}>{brochureContent}</Section>
                    )}

                    {extraSections}
                  </TabsContent>

                  {hasItinerary && (
                    <TabsContent value="itinerary" className="flex flex-col gap-2">
                      <ol className="space-y-2">
                        {enrichment!.itinerary!.map((d) => (
                          <li key={d.dayNumber}>
                            {renderItineraryDay && hit ? (
                              renderItineraryDay(d, hit, enrichment!)
                            ) : (
                              <DefaultItineraryDay day={d} dayLabel={messages.day} />
                            )}
                          </li>
                        ))}
                      </ol>
                    </TabsContent>
                  )}

                  {hasShip && (
                    <TabsContent value="ship">
                      <ShipCard ship={enrichment!.ship!} messages={messages} />
                    </TabsContent>
                  )}

                  {hasOptions && (
                    <TabsContent value="options">
                      <ul className="space-y-3">
                        {enrichment!.options!.map((o) => (
                          <CabinCard key={o.id} cabin={o} messages={messages} />
                        ))}
                      </ul>
                    </TabsContent>
                  )}

                  {hasDepartures && (
                    <TabsContent value="departures">
                      <DeparturesTable
                        hit={hit}
                        vertical={vertical}
                        departures={enrichment!.departures!}
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
                        {enrichment!.policies!.map((p, idx) => (
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
          })()}

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

/**
 * Header-side "From {price}" indicator. Prefers per-departure
 * `lowestPriceCents` minimums (only counting open/limited slots); falls
 * back to the product's indexed `sellAmountCents` so always-on products
 * still surface a price. Renders nothing when neither source has a
 * value — the rest of the sheet still carries pricing detail elsewhere.
 */
function ProductPriceFrom({
  enrichment,
  fields,
  messages,
}: {
  enrichment: CatalogDetailEnrichment | null
  fields: Record<string, unknown>
  messages: CatalogUiMessages["catalogPage"]["detail"]
}) {
  const departureMin = (enrichment?.departures ?? []).reduce<{
    amount: number
    currency: string | null
  } | null>((acc, d) => {
    if (typeof d.lowestPriceCents !== "number") return acc
    if (d.status === "sold_out" || d.status === "closed" || d.status === "cancelled") return acc
    if (acc && acc.amount <= d.lowestPriceCents) return acc
    return { amount: d.lowestPriceCents, currency: d.currency ?? null }
  }, null)
  const fallbackAmount =
    typeof fields.sellAmountCents === "number"
      ? fields.sellAmountCents
      : typeof fields.sellAmountCents === "string"
        ? Number(fields.sellAmountCents)
        : null
  const fallbackCurrency = typeof fields.sellCurrency === "string" ? fields.sellCurrency : null

  const amount = departureMin?.amount ?? (Number.isFinite(fallbackAmount) ? fallbackAmount : null)
  const currency = departureMin?.currency ?? fallbackCurrency
  if (amount == null) return null

  return (
    <div className="flex flex-col items-end whitespace-nowrap">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {messages.priceFromLabel}
      </span>
      <span className="font-semibold text-base tabular-nums">
        {formatPriceCents(amount, currency ?? undefined)}
      </span>
    </div>
  )
}

type DepartureEntry = NonNullable<CatalogDetailEnrichment["departures"]>[number]
type DepartureOption = NonNullable<CatalogDetailEnrichment["options"]>[number]

type SortColumn = "date" | "status" | "availability" | "priceFrom"
type SortDirection = "asc" | "desc"

interface MonthOption {
  value: string // "YYYY-MM"
  label: string
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function collectMonthOptions(departures: ReadonlyArray<DepartureEntry>): MonthOption[] {
  const formatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" })
  const map = new Map<string, MonthOption>()
  for (const d of departures) {
    const date = new Date(d.startsAt)
    if (Number.isNaN(date.getTime())) continue
    const key = monthKey(date)
    if (!map.has(key)) map.set(key, { value: key, label: formatter.format(date) })
  }
  // i18n-literal-ok: numeric sort comparator return value
  return Array.from(map.values()).sort((a, b) => (a.value < b.value ? -1 : 1))
}

function normaliseStatus(d: DepartureEntry): string {
  if (d.status) return d.status
  return "open"
}

function collectStatusOptions(departures: ReadonlyArray<DepartureEntry>): string[] {
  const set = new Set<string>()
  for (const d of departures) set.add(normaliseStatus(d))
  return Array.from(set).sort()
}

function isDepartureBookable(d: DepartureEntry): boolean {
  if (d.status === "sold_out" || d.status === "closed" || d.status === "cancelled") return false
  if (typeof d.remaining === "number" && d.remaining <= 0) return false
  return new Date(d.startsAt).getTime() > Date.now()
}

const ALL_FILTER_VALUE = "__all__"

/**
 * Flat departures table with sortable columns and filter controls
 * (month/year, status, min-availability). Sold-out / closed / past
 * rows render dimmed and are not clickable. Bookable rows expand to
 * reveal a per-option row with its own remaining capacity and Book
 * button.
 */
function DeparturesTable({
  hit,
  vertical,
  departures,
  options,
  productSellAmountCents,
  productSellCurrency,
  onBookDeparture,
  onBookOption,
  onLoadDeparturePricing,
  messages,
}: {
  hit: CatalogSearchHit | null
  vertical?: string
  departures: ReadonlyArray<DepartureEntry>
  options: NonNullable<CatalogDetailEnrichment["options"]>
  productSellAmountCents: number | null
  productSellCurrency: string | null
  onBookDeparture?: (hit: CatalogSearchHit, departure: DepartureEntry) => void
  onBookOption?: (hit: CatalogSearchHit, departure: DepartureEntry, option: DepartureOption) => void
  onLoadDeparturePricing?: (
    hit: CatalogSearchHit,
    sailingRef: string,
  ) => Promise<CatalogDeparturePricingRow[] | null>
  messages: CatalogUiMessages["catalogPage"]["detail"]
}) {
  const tableMessages = messages.departuresTable
  // Cruises call a scheduled departure a "sailing" — pick the cruise wording.
  const isCruise = vertical === "cruises"
  const noUpcomingLabel = isCruise ? messages.noUpcomingSailings : messages.noUpcomingDepartures
  const noResultsLabel = isCruise ? tableMessages.noResultsSailings : tableMessages.noResults
  const monthOptions = useMemo(() => collectMonthOptions(departures), [departures])
  const statusOptions = useMemo(() => collectStatusOptions(departures), [departures])

  const [monthFilter, setMonthFilter] = useState<string>(ALL_FILTER_VALUE)
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER_VALUE)
  const [minAvailability, setMinAvailability] = useState<string>("")
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "date",
    direction: "asc",
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  )

  const filtersActive =
    monthFilter !== ALL_FILTER_VALUE || statusFilter !== ALL_FILTER_VALUE || minAvailability !== ""

  const filtered = useMemo(() => {
    const minAvail = minAvailability ? Number(minAvailability) : null
    return departures.filter((d) => {
      const date = new Date(d.startsAt)
      if (monthFilter !== ALL_FILTER_VALUE) {
        if (Number.isNaN(date.getTime())) return false
        if (monthKey(date) !== monthFilter) return false
      }
      if (statusFilter !== ALL_FILTER_VALUE && normaliseStatus(d) !== statusFilter) {
        return false
      }
      if (minAvail != null && Number.isFinite(minAvail)) {
        const remaining = typeof d.remaining === "number" ? d.remaining : null
        if (remaining == null) return false
        if (remaining < minAvail) return false
      }
      return true
    })
  }, [departures, monthFilter, statusFilter, minAvailability])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const dir = sort.direction === "asc" ? 1 : -1
    list.sort((a, b) => {
      switch (sort.column) {
        case "date":
          return (new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()) * dir
        case "status":
          return normaliseStatus(a).localeCompare(normaliseStatus(b)) * dir
        case "availability": {
          const av = typeof a.remaining === "number" ? a.remaining : -1
          const bv = typeof b.remaining === "number" ? b.remaining : -1
          return (av - bv) * dir
        }
        case "priceFrom": {
          const av = a.lowestPriceCents ?? productSellAmountCents ?? -1
          const bv = b.lowestPriceCents ?? productSellAmountCents ?? -1
          return (av - bv) * dir
        }
        default:
          return 0
      }
    })
    return list
  }, [filtered, sort, productSellAmountCents])

  const toggleSort = (column: SortColumn) => {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    )
  }

  const clearFilters = () => {
    setMonthFilter(ALL_FILTER_VALUE)
    setStatusFilter(ALL_FILTER_VALUE)
    setMinAvailability("")
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Select value={monthFilter} onValueChange={(v) => setMonthFilter(v ?? ALL_FILTER_VALUE)}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue placeholder={tableMessages.anyMonth} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>{tableMessages.anyMonth}</SelectItem>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? ALL_FILTER_VALUE)}
          >
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue placeholder={tableMessages.anyStatus} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>{tableMessages.anyStatus}</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabelFor(status, tableMessages)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Input
            type="number"
            min={0}
            value={minAvailability}
            onChange={(event) => setMinAvailability(event.target.value)}
            placeholder={tableMessages.minAvailability}
            className="h-9 w-[140px] text-sm"
          />
        </div>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
            <X className="mr-1 h-3.5 w-3.5" />
            {tableMessages.clearFilters}
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-md border bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
          {filtersActive ? noResultsLabel : noUpcomingLabel}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <SortableHeader
                  className="text-left"
                  column="date"
                  sort={sort}
                  onToggle={toggleSort}
                >
                  {tableMessages.date}
                </SortableHeader>
                <SortableHeader
                  className="text-left"
                  column="status"
                  sort={sort}
                  onToggle={toggleSort}
                >
                  {tableMessages.status}
                </SortableHeader>
                <SortableHeader
                  className="text-right"
                  column="availability"
                  sort={sort}
                  onToggle={toggleSort}
                >
                  {tableMessages.availability}
                </SortableHeader>
                <SortableHeader
                  className="text-right"
                  column="priceFrom"
                  sort={sort}
                  onToggle={toggleSort}
                >
                  {tableMessages.priceFrom}
                </SortableHeader>
                <th className="w-[36px] px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const bookable = isDepartureBookable(d)
                const isExpanded = expandedId === d.id
                const date = new Date(d.startsAt)
                const statusKey = normaliseStatus(d)
                const remaining = typeof d.remaining === "number" ? d.remaining : null
                const priceCents = d.lowestPriceCents ?? productSellAmountCents
                const priceCurrency = d.currency ?? productSellCurrency ?? undefined
                return (
                  <Fragment key={d.id}>
                    <tr
                      className={cn(
                        "border-b last:border-b-0 transition-colors",
                        bookable ? "cursor-pointer hover:bg-muted/40" : "cursor-default opacity-50",
                      )}
                      onClick={() => {
                        if (!bookable) return
                        setExpandedId((current) => (current === d.id ? null : d.id))
                      }}
                    >
                      <td className="px-3 py-2 font-medium">{dateTimeFormatter.format(date)}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={bookable ? "outline" : "secondary"}
                          className="w-fit font-normal capitalize"
                        >
                          {statusLabelFor(statusKey, tableMessages)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {remaining != null ? remaining : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {priceCents != null ? formatPriceCents(priceCents, priceCurrency) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {bookable ? (
                          isExpanded ? (
                            <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                          )
                        ) : null}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b last:border-b-0 bg-muted/20">
                        <td colSpan={5} className="px-3 py-3">
                          <DepartureDetailPanel
                            hit={hit}
                            departure={d}
                            options={options}
                            productSellAmountCents={productSellAmountCents}
                            productSellCurrency={productSellCurrency}
                            onBookDeparture={onBookDeparture}
                            onBookOption={onBookOption}
                            onLoadDeparturePricing={onLoadDeparturePricing}
                            messages={messages}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SortableHeader({
  column,
  sort,
  onToggle,
  children,
  className,
}: {
  column: SortColumn
  sort: { column: SortColumn; direction: SortDirection }
  onToggle: (column: SortColumn) => void
  children: ReactNode
  className?: string
}) {
  const active = sort.column === column
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown
  return (
    <th className={cn("px-3 py-2", className)}>
      <button
        type="button"
        onClick={() => onToggle(column)}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          // i18n-literal-ok: tailwind utilities, not user copy
          className?.includes("text-right") ? "ml-auto flex-row-reverse" : null,
        )}
      >
        <Icon className="h-3 w-3" />
        {children}
      </button>
    </th>
  )
}

function statusLabelFor(
  status: string,
  tableMessages: CatalogUiMessages["catalogPage"]["detail"]["departuresTable"],
): string {
  switch (status) {
    case "sold_out":
      return tableMessages.soldOut
    case "closed":
      return tableMessages.closed
    case "cancelled":
      return tableMessages.cancelled
    case "open":
      return tableMessages.open
    default:
      return status.replace(/_/g, " ")
  }
}

/**
 * Per-departure expansion panel. Lists the bookable options with their
 * own remaining capacity, "from" price, and Book button. Today the
 * seeded availability_slots track capacity at the product level (not
 * per option), so per-option remaining mirrors the departure total —
 * once `availability_slots.option_id` is populated, the per-option
 * number will diverge automatically.
 */
function DepartureDetailPanel({
  hit,
  departure,
  options,
  productSellAmountCents,
  productSellCurrency,
  onBookDeparture,
  onBookOption,
  onLoadDeparturePricing,
  messages,
}: {
  hit: CatalogSearchHit | null
  departure: DepartureEntry
  options: NonNullable<CatalogDetailEnrichment["options"]>
  productSellAmountCents: number | null
  productSellCurrency: string | null
  onBookDeparture?: (hit: CatalogSearchHit, departure: DepartureEntry) => void
  onBookOption?: (hit: CatalogSearchHit, departure: DepartureEntry, option: DepartureOption) => void
  onLoadDeparturePricing?: (
    hit: CatalogSearchHit,
    sailingRef: string,
  ) => Promise<CatalogDeparturePricingRow[] | null>
  messages: CatalogUiMessages["catalogPage"]["detail"]
}) {
  const tableMessages = messages.departuresTable
  const currency = departure.currency ?? productSellCurrency ?? undefined
  const departurePriceCents = departure.lowestPriceCents ?? productSellAmountCents
  const departureRemaining = typeof departure.remaining === "number" ? departure.remaining : null

  // Live per-cabin pricing (cruises). This panel only mounts when its departure
  // row is expanded, so fetch lazily here — pricing is volatile-live, never
  // baked into the cached content.
  const [livePricing, setLivePricing] = useState<CatalogDeparturePricingRow[] | null>(null)
  const sailingRef = departure.sourceRef ?? null
  useEffect(() => {
    if (!hit || !onLoadDeparturePricing || !sailingRef) return
    let cancelled = false
    onLoadDeparturePricing(hit, sailingRef).then(
      (rows) => {
        if (!cancelled) setLivePricing(rows)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [hit, onLoadDeparturePricing, sailingRef])

  // Index the cheapest live price per cabin code. The upstream cabin ref is
  // `<shipId>_<code>`, so the code is the trailing segment — matched against the
  // option's `code`.
  const livePriceByCode = useMemo(() => {
    const byCode = new Map<string, { cents: number; currency: string; availability: string }>()
    for (const row of livePricing ?? []) {
      const code = row.cabinExternalId.slice(row.cabinExternalId.lastIndexOf("_") + 1)
      const cents = Math.round(Number(row.pricePerPerson) * 100)
      if (!Number.isFinite(cents)) continue
      const existing = byCode.get(code)
      if (!existing || cents < existing.cents) {
        byCode.set(code, { cents, currency: row.currency, availability: row.availability })
      }
    }
    return byCode
  }, [livePricing])

  const handleBook = (option: DepartureOption) => {
    if (!hit) return
    if (onBookOption) {
      onBookOption(hit, departure, option)
    } else if (onBookDeparture) {
      onBookDeparture(hit, departure)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {tableMessages.optionsHeading}
      </div>
      {options.length === 0 ? (
        <div className="text-xs text-muted-foreground">{tableMessages.noOptions}</div>
      ) : (
        <ul className="divide-y rounded-md border bg-background">
          {options.map((option) => {
            const canBook =
              isDepartureBookable(departure) &&
              hit != null &&
              (onBookOption != null || onBookDeparture != null)
            const livePrice = option.code ? livePriceByCode.get(option.code) : undefined
            return (
              <li
                key={option.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{option.name}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {livePrice ? (
                    <>
                      <span className="text-right text-xs capitalize text-muted-foreground">
                        {livePrice.availability.replace(/_/g, " ")}
                      </span>
                      <div className="text-right text-xs text-muted-foreground">
                        {tableMessages.priceFrom}{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          {formatPriceCents(livePrice.cents, livePrice.currency)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-right text-xs text-muted-foreground">
                        {departureRemaining != null ? (
                          <span className="tabular-nums">
                            <span className="font-medium text-foreground">
                              {departureRemaining}
                            </span>{" "}
                            {tableMessages.remainingLabel}
                          </span>
                        ) : (
                          "—"
                        )}
                      </div>
                      {departurePriceCents != null && (
                        <div className="text-right text-xs text-muted-foreground">
                          {tableMessages.priceFrom}{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {formatPriceCents(departurePriceCents, currency)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {canBook && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleBook(option)
                      }}
                    >
                      {messages.book}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
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
  messages,
  renderSupplierLink,
}: {
  entries: Array<[string, unknown]>
  formatters?: Record<string, (value: unknown) => ReactNode>
  messages: CatalogUiMessages["catalogPage"]
  renderSupplierLink?: (supplierId: string, displayName: string) => ReactNode
}) {
  return (
    <div className="divide-y rounded-lg border">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[140px_1fr] items-baseline gap-4 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">{attributeLabel(key, messages)}</span>
          <span className="text-sm break-words">
            {renderAttributeValue(key, value, { formatters, messages, renderSupplierLink })}
          </span>
        </div>
      ))}
    </div>
  )
}

function attributeLabel(key: string, messages: CatalogUiMessages["catalogPage"]): string {
  const overrides = messages.detail.attributeLabels
  if (key === "sellAmount") return overrides.sellAmount
  if (key === "supplierId") return overrides.supplierId
  return humanize(key)
}

function renderAttributeValue(
  key: string,
  value: unknown,
  ctx: {
    formatters?: Record<string, (value: unknown) => ReactNode>
    messages: CatalogUiMessages["catalogPage"]
    renderSupplierLink?: (supplierId: string, displayName: string) => ReactNode
  },
): ReactNode {
  const { formatters, messages, renderSupplierLink } = ctx

  // Synthetic "Sell amount" — value is `{ amountCents, currency }`,
  // emitted by the attribute-reshaping pass above.
  if (key === "sellAmount" && value && typeof value === "object" && "amountCents" in value) {
    const amountCents = (value as { amountCents: unknown }).amountCents
    const currency = (value as { currency?: unknown }).currency
    const cents = typeof amountCents === "number" ? amountCents : Number(amountCents)
    if (!Number.isFinite(cents)) return <span className="text-muted-foreground">—</span>
    return (
      <span className="font-medium tabular-nums">
        {formatPriceCents(cents, typeof currency === "string" ? currency : undefined)}
      </span>
    )
  }

  // Supplier — render an operator-supplied link to the supplier record,
  // falling back to the plain formatter when no renderer is wired.
  if (key === "supplierId" && renderSupplierLink && typeof value === "string" && value) {
    const displayName =
      typeof formatters?.[key] === "function"
        ? String((formatters[key] as (v: unknown) => unknown)(value) ?? value)
        : value
    return renderSupplierLink(value, displayName)
  }

  // Visibility — render as a badge so it reads at a glance.
  if (key === "visibility" && typeof value === "string" && value) {
    return (
      <Badge variant={value === "public" ? "default" : "secondary"} className="capitalize">
        {value}
      </Badge>
    )
  }

  return formatters?.[key] ? formatters[key]!(value) : defaultFormat(key, value, messages)
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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string" && v.length > 0)
}

/**
 * Inline tag editor used by the catalog detail sheet. Holds a local
 * working list so chip add/remove feels immediate; the indexed `value`
 * re-syncs whenever the hit refetches after a successful mutation.
 */
function InlineTagsEditor({
  hit,
  value,
  onChange,
  placeholder,
}: {
  hit: CatalogSearchHit
  value: string[]
  onChange: (hit: CatalogSearchHit, next: string[]) => Promise<void> | void
  placeholder: string
}) {
  const messages = useCatalogUiMessagesOrDefault().catalogPage.detail
  // Seed the working set from the indexed value on each *hit change*
  // only. The catalog search refetches after every mutation, but
  // Typesense reindex is asynchronous — for a few seconds after the
  // PATCH the indexed hit still carries the pre-mutation tags. If we
  // re-synced from `value` on every render, those stale tags would
  // clobber the chip the user just added. Pinning the seed to `hit.id`
  // means a different product re-seeds, but our own optimistic state
  // sticks while the index catches up.
  const [tags, setTags] = useState<string[]>(value)
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const seededIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (seededIdRef.current === hit.id) return
    seededIdRef.current = hit.id
    setTags(value)
    setDraft("")
  }, [hit.id, value])

  const commit = async (next: string[]) => {
    const previous = tags
    setTags(next)
    setPending(true)
    try {
      await onChange(hit, next)
    } catch {
      setTags(previous)
    } finally {
      setPending(false)
    }
  }

  const addTag = () => {
    const trimmed = draft.trim().replace(/,+$/, "")
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setDraft("")
      return
    }
    void commit([...tags, trimmed])
    setDraft("")
  }

  const removeTag = (tag: string) => {
    void commit(tags.filter((t) => t !== tag))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addTag()
      return
    }
    if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      event.preventDefault()
      removeTag(tags[tags.length - 1] as string)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 font-normal">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="rounded-full hover:text-destructive"
              onClick={() => removeTag(tag)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
          onClick={() => inputRef.current?.focus()}
        >
          <Plus className="h-3 w-3" />
          {messages.addTag}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) addTag()
          }}
          placeholder={placeholder}
          className="h-8 max-w-xs text-sm"
        />
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Field formatting
// ─────────────────────────────────────────────────────────────────────────────

function defaultFormat(
  field: string,
  value: unknown,
  messages: CatalogUiMessages["catalogPage"],
): ReactNode {
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
        {truthy ? messages.values.yes : messages.values.no}
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
        {messages.values.open}
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

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? "" : String(value)
  })
}

/**
 * Compact, copyable id chip. Sourced cruise ids embed the full upstream
 * SourceRef (`crus_sr_<base64url>`) so they're long; truncate the display,
 * keep the full id on hover (`title`), and copy it on click.
 */
function IdChip({ id }: { id: string }): ReactNode {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={id}
      onClick={() => {
        void navigator.clipboard?.writeText(id).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          },
          () => undefined,
        )
      }}
      className="inline-flex max-w-[14rem] items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="truncate">{id}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-60" />
      )}
    </button>
  )
}

/**
 * One cabin in the cruise Cabins tab: photo gallery (carousel + lightbox),
 * name + size/capacity, description, and amenity chips.
 */
function CabinCard({
  cabin,
  messages,
}: {
  cabin: NonNullable<CatalogDetailEnrichment["options"]>[number]
  messages: CatalogUiMessages["catalogPage"]["detail"]
}): ReactNode {
  const desc = cabin.description?.trim() ?? ""
  const meta = [
    cabin.squareFeet ? `${cabin.squareFeet} sqft` : null,
    cabin.capacityMax ? `sleeps ${cabin.capacityMax}` : null,
    cabin.gradeCodes && cabin.gradeCodes.length > 0
      ? `grades ${cabin.gradeCodes.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
  // The upstream amenity list leads with the cabin size + a copy of the
  // description; drop those so the chips show genuine, non-duplicated perks.
  const amenities = (cabin.amenities ?? []).filter(
    (a) => a.trim() !== desc && !/^stateroom size/i.test(a.trim()),
  )
  return (
    <li className="flex gap-4 rounded-lg border border-border p-3">
      <MediaGallery images={cabin.images ?? []} alt={cabin.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h4 className="font-medium text-sm">{cabin.name}</h4>
          {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
          {cabin.wheelchairAccessible && (
            <Badge variant="outline" className="text-[10px]">
              {messages.wheelchairAccessible}
            </Badge>
          )}
        </div>
        {desc && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
        {(cabin.floorplanImages?.length ?? 0) > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {messages.floorPlan}
            </div>
            <MediaGallery
              images={cabin.floorplanImages ?? []}
              alt={`${cabin.name} floor plan`}
              className="w-44"
              imageClassName="h-28 w-44 object-contain bg-muted"
            />
          </div>
        )}
        {amenities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {amenities.slice(0, 6).map((a) => (
              <span
                key={a}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {a}
              </span>
            ))}
            {amenities.length > 6 && (
              <span className="px-1 text-[10px] text-muted-foreground">
                +{amenities.length - 6}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * The vessel a cruise sails on: gallery + name/type, key specs (capacity,
 * decks, year built) and a description.
 */
function ShipCard({
  ship,
  messages,
}: {
  ship: NonNullable<CatalogDetailEnrichment["ship"]>
  messages: CatalogUiMessages["catalogPage"]["detail"]
}): ReactNode {
  const desc = ship.description?.trim() ?? ""
  const specs = [
    ship.shipType ? { label: messages.shipSpecs.type, value: ship.shipType } : null,
    ship.capacity
      ? {
          label: messages.shipSpecs.capacity,
          value: formatTemplate(messages.shipSpecs.capacityGuests, { count: ship.capacity }),
        }
      : null,
    ship.decks ? { label: messages.shipSpecs.decks, value: String(ship.decks) } : null,
    ship.yearBuilt ? { label: messages.shipSpecs.yearBuilt, value: String(ship.yearBuilt) } : null,
  ].filter((s): s is { label: string; value: string } => s != null)
  const images = ship.images ?? []
  const deckPlanUrls = [
    ...(ship.deckPlanUrl ? [ship.deckPlanUrl] : []),
    ...(ship.deckPlans ?? []).flatMap((deck) => (deck.imageUrl ? [deck.imageUrl] : [])),
  ]
  const deckPlanImages = Array.from(new Set(deckPlanUrls.filter(isRenderableImageUrl)))
  const deckPlanDocuments = Array.from(
    new Set(deckPlanUrls.filter((url) => !isRenderableImageUrl(url))),
  )
  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 && (
        <MediaGallery
          images={images}
          alt={ship.name}
          className="w-full max-w-lg"
          imageClassName="h-56 w-full"
        />
      )}
      {deckPlanImages.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {messages.deckPlan}
          </div>
          <MediaGallery
            images={deckPlanImages}
            alt={`${ship.name} deck plan`}
            className="w-full max-w-lg"
            imageClassName="h-56 w-full object-contain bg-muted"
          />
        </div>
      )}
      {deckPlanDocuments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {deckPlanDocuments.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-3 w-3" />
              {messages.openDeckPlan}
            </a>
          ))}
        </div>
      )}
      <div>
        <h3 className="text-base font-medium text-foreground">{ship.name}</h3>
        {ship.shipType && <p className="mt-0.5 text-xs text-muted-foreground">{ship.shipType}</p>}
      </div>
      {(ship.deckPlans?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {ship.deckPlans!.map((deck) => (
            <span
              key={`${deck.level ?? ""}-${deck.name}`}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {deck.level != null ? `Deck ${deck.level}: ${deck.name}` : deck.name}
            </span>
          ))}
        </div>
      )}
      {specs.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {specs.map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </dt>
              <dd className="text-sm text-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {desc && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{desc}</p>
      )}
    </div>
  )
}

function isRenderableImageUrl(url: string): boolean {
  if (url.startsWith("data:image/")) return true
  const path = url.split(/[?#]/, 1)[0]?.toLowerCase() ?? ""
  return /\.(avif|gif|jpe?g|png|svg|webp)$/.test(path)
}
