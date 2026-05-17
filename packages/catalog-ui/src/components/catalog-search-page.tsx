"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { type CatalogSearchHit, useCatalogSearch } from "@voyantjs/catalog-react"
import { Button } from "@voyantjs/ui/components/button"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { Input } from "@voyantjs/ui/components/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import {
  type CatalogDetailAction,
  type CatalogDetailEnrichment,
  type CatalogDetailRenderSlot,
  CatalogDetailSheet,
  type CatalogDetailSheetProps,
} from "./catalog-detail-sheet.js"
import { CatalogFacetedFilter } from "./catalog-faceted-filter.js"
import { CatalogRangeFilter, type CatalogRangeFilterValue } from "./catalog-range-filter.js"

/**
 * Declares a filter on a tab. Two kinds:
 *   - `facet`  (default) — multi-select against live facet buckets. Hidden
 *                          when the search response yields no buckets and
 *                          nothing is currently selected.
 *   - `range`  — numeric min/max range. Always visible (no facet response
 *                  needed). Use `format: "currency"` for money fields
 *                  stored as integer cents (e.g. `sellAmountCents`).
 */
export type CatalogFilterField = CatalogFacetFilterField | CatalogRangeFilterField

export interface CatalogFacetFilterField {
  kind?: "facet"
  /** Field name on the indexer document (e.g. "status", "bookingMode"). */
  field: string
  /** Human-readable group label (already localized). */
  label: string
  /**
   * Optional value formatter. Use it when the underlying field is an ID and
   * you want the dropdown to show the human-readable label instead — e.g.
   * resolving `lineSupplierId` against a `Map<id, name>`. Returns the raw
   * value as a string by default.
   */
  formatValue?: (value: string | number) => string
}

export interface CatalogRangeFilterField {
  kind: "range"
  field: string
  label: string
  step?: number
  minPlaceholder?: string
  maxPlaceholder?: string
  /** When the field stores cents, set `"currency"` + `currency`. */
  format?: "number" | "currency"
  currency?: string
}

/**
 * One tab in the catalog search page. Each tab maps to a single vertical
 * (`products`, `cruises`, `hospitality`, etc.) and supplies its own column
 * definitions so per-vertical UI packages own their own visual language.
 */
export interface CatalogSearchTab {
  /** Stable id used as the TabsTrigger value + queryKey segment. */
  id: string
  /** Human-readable tab label (already localized). */
  label: string
  /** The catalog vertical to query — mapped to the slice's `vertical`. */
  vertical: string
  /**
   * Per-tab column definitions for the results data table. Each column
   * receives the full `CatalogSearchHit` and projects whatever fields the
   * vertical's indexer document carries.
   */
  columns: ColumnDef<CatalogSearchHit, unknown>[]
  /**
   * Optional facet declarations. When set, the page requests these as
   * `facets` in the search request and renders a chip group per field
   * above the results. Click-to-toggle multi-select; selections are
   * passed back as `filters[]`.
   */
  filterFields?: CatalogFilterField[]
  /**
   * Optional empty-state ReactNode — shown when the tab has no hits for
   * the current query. Defaults to a simple "no results" message.
   */
  emptyState?: ReactNode
  /**
   * Indexer field that carries the entity's primary image URL. Defaults
   * to `thumbnailUrl`. Cruises / charters use `heroImageUrl`.
   */
  imageField?: string
  /**
   * Optional per-field formatters used by the detail sheet to render
   * human-readable values (e.g. resolve `lineSupplierId` → supplier name).
   * The same `formatValue` you pass on a `CatalogFacetFilterField` should
   * usually appear here too.
   */
  detailFormatters?: Record<string, (value: unknown) => ReactNode>
  /**
   * Optional footer actions shown at the bottom of the detail sheet
   * (e.g. "Open in editor" → router push). Use them when you want a row
   * click to do more than just "view details."
   */
  detailActions?: CatalogDetailAction[]
  /** Optional sheet width override for this tab's detail surface. */
  detailSheetWidth?: CatalogDetailSheetProps["width"]
  /** Optional header action area for this tab's detail sheet. */
  detailHeaderExtras?: CatalogDetailSheetProps["headerExtras"]
  /** Optional dedicated brochure section for this tab's detail sheet. */
  renderDetailBrochure?: CatalogDetailRenderSlot
  /** Optional media renderer for this tab's detail sheet. */
  renderDetailMedia?: CatalogDetailRenderSlot
  /** Optional richer itinerary day renderer for this tab's detail sheet. */
  renderDetailItineraryDay?: CatalogDetailSheetProps["renderItineraryDay"]
  /** Optional extra sections rendered above this tab's detail footer actions. */
  renderDetailExtraSections?: CatalogDetailRenderSlot
  /**
   * Optional enrichment loader. Called when the detail sheet opens for
   * a hit. Returns the rich content shape (description, itinerary,
   * media, options, policies, supplier) so the sheet can render full
   * detail without expanding the search-time projection — keeps the
   * search index lean and lets every entity carry rich content via
   * the catalog content service.
   *
   * Templates wire this per-vertical to call `/v1/admin/<vertical>/:id/content`
   * (which `getProductContent` / `getCruiseContent` / etc back).
   * Returns null when the entity has no content (rare — surfaces as a
   * subtle "no extra detail" hint in the sheet).
   */
  onLoadDetail?: (hit: CatalogSearchHit) => Promise<CatalogDetailEnrichment | null>
  /**
   * Called when the operator clicks a per-departure Book button on a
   * catalog row. Templates typically navigate to the catalog booking
   * journey with the departure id pinned.
   */
  onBookDeparture?: (
    hit: CatalogSearchHit,
    departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
  ) => void
  /** Per-option Book button inside the expanded departure panel. */
  onBookOption?: (
    hit: CatalogSearchHit,
    departure: NonNullable<CatalogDetailEnrichment["departures"]>[number],
    option: NonNullable<CatalogDetailEnrichment["options"]>[number],
  ) => void
}

export interface CatalogSearchPageProps {
  tabs: CatalogSearchTab[]
  /** Default tab id; falls back to the first tab. */
  defaultTab?: string
  /** Items per page, mapped to `pagination.limit`. Default `20`. */
  pageSize?: number
  /**
   * Optional title above the search bar. Templates that use TanStack
   * Start's page-level title elements should pass null and render their
   * own.
   */
  title?: ReactNode
  /** Placeholder text for the search input. */
  searchPlaceholder?: string
  /** Debounce on keystrokes, milliseconds. Default 200. */
  queryDebounceMs?: number
  /**
   * Controlled active-tab id. When provided, callers must also pass
   * `onActiveTabChange` and the tab state is owned by the parent (e.g. a
   * router-driven URL state). Omit for uncontrolled internal state.
   */
  activeTab?: string
  onActiveTabChange?: (tabId: string) => void
  /** Controlled query string (already debounced if you want to skip the debounce here). */
  query?: string
  onQueryChange?: (q: string) => void
  /** Controlled current page (1-indexed) for the active tab. */
  page?: number
  onPageChange?: (page: number) => void
  /** Optional default detail sheet width for all tabs. Tabs may override it. */
  detailSheetWidth?: CatalogDetailSheetProps["width"]
  /** Optional default header action area for all tab detail sheets. */
  detailHeaderExtras?: CatalogDetailSheetProps["headerExtras"]
  /** Optional default brochure section for all tab detail sheets. */
  renderDetailBrochure?: CatalogDetailRenderSlot
  /** Optional default media renderer for all tab detail sheets. */
  renderDetailMedia?: CatalogDetailRenderSlot
  /** Optional default richer itinerary day renderer for all tab detail sheets. */
  renderDetailItineraryDay?: CatalogDetailSheetProps["renderItineraryDay"]
  /** Optional default extra sections rendered above detail footer actions. */
  renderDetailExtraSections?: CatalogDetailRenderSlot
  /** Optional supplier-link renderer for the detail sheet's Attributes tab. */
  renderSupplierLink?: CatalogDetailSheetProps["renderSupplierLink"]
  /**
   * Optional inline tags editor handler for the detail sheet. When set,
   * the sheet's Tags row becomes editable; the callback persists the
   * next tag list (typically a PATCH to the entity).
   */
  onTagsChange?: CatalogDetailSheetProps["onTagsChange"]
}

/**
 * Generic tabbed search shell. Owns the search input, mode toggle,
 * tab state, and per-tab data fetching (search + facets + pagination).
 * Per-vertical visuals come from the tab's column definitions so this
 * shell stays vertical-agnostic.
 */
export function CatalogSearchPage({
  tabs,
  defaultTab,
  pageSize = 20,
  title,
  searchPlaceholder,
  queryDebounceMs = 200,
  activeTab: activeTabProp,
  onActiveTabChange,
  query: queryProp,
  onQueryChange,
  page: pageProp,
  onPageChange,
  detailSheetWidth,
  detailHeaderExtras,
  renderDetailBrochure,
  renderDetailMedia,
  renderDetailItineraryDay,
  renderDetailExtraSections,
  renderSupplierLink,
  onTagsChange,
}: CatalogSearchPageProps) {
  const messages = useCatalogUiMessagesOrDefault().catalogPage
  const resolvedSearchPlaceholder = searchPlaceholder ?? messages.searchPlaceholder
  const [internalActiveTab, setInternalActiveTab] = useState<string>(
    defaultTab ?? tabs[0]?.id ?? "",
  )
  const activeTab = activeTabProp ?? internalActiveTab
  const setActiveTab = (next: string) => {
    if (onActiveTabChange) onActiveTabChange(next)
    if (activeTabProp == null) setInternalActiveTab(next)
  }

  // The query input is always driven by the local typing buffer so
  // keystrokes never get clobbered by a re-render triggered by our own
  // debounced URL push. `queryProp` only resets the buffer when it
  // changes from a value we did *not* emit (e.g. browser back/forward,
  // or an external clear).
  const [internalRawQuery, setInternalRawQuery] = useState(queryProp ?? "")
  const [debouncedInternal, setDebouncedInternal] = useState(queryProp ?? "")
  const lastEmittedRef = useRef<string>(queryProp ?? "")
  const rawQuery = internalRawQuery
  const debouncedQuery = queryProp != null ? queryProp : debouncedInternal

  useEffect(() => {
    if (queryProp != null && queryProp !== lastEmittedRef.current) {
      // External update (e.g. URL back/forward) — accept it and re-seed
      // the typing buffer.
      lastEmittedRef.current = queryProp
      setInternalRawQuery(queryProp)
    }
  }, [queryProp])

  useEffect(() => {
    const t = setTimeout(() => {
      if (internalRawQuery === lastEmittedRef.current) return
      lastEmittedRef.current = internalRawQuery
      if (onQueryChange) onQueryChange(internalRawQuery)
      else setDebouncedInternal(internalRawQuery)
    }, queryDebounceMs)
    return () => clearTimeout(t)
  }, [internalRawQuery, queryDebounceMs, onQueryChange])

  if (tabs.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        {messages.search.noTabsConfigured}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {title}
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={rawQuery}
          onChange={(e) => setInternalRawQuery(e.target.value)}
          placeholder={resolvedSearchPlaceholder}
          className="pl-9"
        />
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            <CatalogTabPanel
              tab={tab}
              query={debouncedQuery}
              pageSize={pageSize}
              page={tab.id === activeTab ? pageProp : undefined}
              onPageChange={tab.id === activeTab ? onPageChange : undefined}
              detailSheetWidth={detailSheetWidth}
              detailHeaderExtras={detailHeaderExtras}
              renderDetailBrochure={renderDetailBrochure}
              renderDetailMedia={renderDetailMedia}
              renderDetailItineraryDay={renderDetailItineraryDay}
              renderDetailExtraSections={renderDetailExtraSections}
              renderSupplierLink={renderSupplierLink}
              onTagsChange={onTagsChange}
              messages={messages}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

interface CatalogTabPanelProps {
  tab: CatalogSearchTab
  query: string
  pageSize: number
  /** Controlled page (1-indexed). Falls back to internal state when omitted. */
  page?: number
  onPageChange?: (page: number) => void
  detailSheetWidth?: CatalogDetailSheetProps["width"]
  detailHeaderExtras?: CatalogDetailSheetProps["headerExtras"]
  renderDetailBrochure?: CatalogDetailRenderSlot
  renderDetailMedia?: CatalogDetailRenderSlot
  renderDetailItineraryDay?: CatalogDetailSheetProps["renderItineraryDay"]
  renderDetailExtraSections?: CatalogDetailRenderSlot
  renderSupplierLink?: CatalogDetailSheetProps["renderSupplierLink"]
  onTagsChange?: CatalogDetailSheetProps["onTagsChange"]
  messages: ReturnType<typeof useCatalogUiMessagesOrDefault>["catalogPage"]
}

/**
 * Filter selections for one tab.
 *  - `facets`: field → list of selected values (multi-select).
 *  - `ranges`: field → { gte?, lte? }.
 */
interface FilterSelections {
  facets: Record<string, Array<string | number>>
  ranges: Record<string, CatalogRangeFilterValue>
}

const EMPTY_SELECTIONS: FilterSelections = { facets: {}, ranges: {} }

function CatalogTabPanel({
  tab,
  query,
  pageSize,
  page: pageProp,
  onPageChange,
  detailSheetWidth,
  detailHeaderExtras,
  renderDetailBrochure,
  renderDetailMedia,
  renderDetailItineraryDay,
  renderDetailExtraSections,
  renderSupplierLink,
  onTagsChange,
  messages,
}: CatalogTabPanelProps) {
  const [selections, setSelections] = useState<FilterSelections>(EMPTY_SELECTIONS)
  const [internalPage, setInternalPage] = useState(1)
  const page = pageProp ?? internalPage
  const setPage = (next: number) => {
    if (onPageChange) onPageChange(next)
    if (pageProp == null) setInternalPage(next)
  }
  const [openHit, setOpenHit] = useState<CatalogSearchHit | null>(null)

  // Reset page when query / filters change. Keeps "Next" honest.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tab.id / query / selections all reset page intentionally
  useEffect(() => {
    setPage(1)
  }, [tab.id, query, selections])

  const filters = useMemo(() => buildFilters(selections), [selections])
  const facetRequests = useMemo(
    () =>
      (tab.filterFields ?? [])
        .filter((f): f is CatalogFacetFilterField => (f.kind ?? "facet") === "facet")
        .map((f) => ({ field: f.field })),
    [tab.filterFields],
  )

  // The deployment picks the actual mode at the route — `hybrid` here means
  // "use the best mode this deployment supports." Operators with embeddings
  // configured get vector + keyword fusion; those without silently get pure
  // keyword. The end user shouldn't have to think about it.
  const { data, isLoading, error } = useCatalogSearch({
    vertical: tab.vertical,
    query,
    mode: "hybrid",
    filters,
    facets: facetRequests,
    pagination: { limit: pageSize, cursor: page > 1 ? String(page) : undefined },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const facetGroups = data?.facets ?? {}
  const hits = data?.hits ?? []

  if (error) {
    const message = error instanceof Error ? error.message : String(error)
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {message}
      </div>
    )
  }

  const hasFacetSelections = Object.values(selections.facets).some((v) => v.length > 0)
  const hasRangeSelections = Object.values(selections.ranges).some(
    (v) => v.gte != null || v.lte != null,
  )
  const hasSelections = hasFacetSelections || hasRangeSelections

  const visibleFilterFields = (tab.filterFields ?? []).filter((f) => {
    if ((f.kind ?? "facet") === "range") return true
    return (facetGroups[f.field]?.length ?? 0) > 0 || (selections.facets[f.field]?.length ?? 0) > 0
  })

  return (
    <div className="flex flex-col gap-3">
      {visibleFilterFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {visibleFilterFields.map((f) => {
            if ((f.kind ?? "facet") === "range") {
              const range = f as CatalogRangeFilterField
              return (
                <CatalogRangeFilter
                  key={range.field}
                  field={range.field}
                  label={range.label}
                  value={selections.ranges[range.field]}
                  onChange={(next) => setSelections((prev) => setRange(prev, range.field, next))}
                  step={range.step}
                  minPlaceholder={range.minPlaceholder}
                  maxPlaceholder={range.maxPlaceholder}
                  format={range.format}
                  currency={range.currency}
                />
              )
            }
            const facet = f as CatalogFacetFilterField
            return (
              <CatalogFacetedFilter
                key={facet.field}
                field={facet.field}
                label={facet.label}
                buckets={facetGroups[facet.field] ?? []}
                selected={selections.facets[facet.field] ?? []}
                formatValue={facet.formatValue}
                onToggle={(value) => setSelections((prev) => toggleFacet(prev, facet.field, value))}
                onClear={() => setSelections((prev) => clearFacet(prev, facet.field))}
              />
            )
          })}
          {hasSelections && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelections(EMPTY_SELECTIONS)}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {messages.search.clearAll}
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-md border">
          <div className="h-12 animate-pulse border-b bg-muted/40" />
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            <div key={i} className="h-12 animate-pulse border-b bg-muted/20 last:border-b-0" />
          ))}
        </div>
      ) : hits.length === 0 ? (
        (tab.emptyState ?? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {formatTemplate(messages.search.noResults, {
              query: query ? `"${query}"` : messages.search.yourFilters,
              tab: tab.label.toLowerCase(),
            })}
          </div>
        ))
      ) : (
        <>
          <div className="text-muted-foreground text-sm">
            {total} {total === 1 ? messages.search.resultSingular : messages.search.resultPlural}
          </div>
          <DataTable
            columns={tab.columns}
            data={hits}
            getRowId={(row) => row.id}
            onRowClick={(row) => setOpenHit(row.original)}
            showPagination={false}
            pageSize={pageSize}
          />
          {totalPages > 1 && (
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-sm">
                {formatTemplate(messages.search.showing, {
                  from: (page - 1) * pageSize + 1,
                  to: Math.min(page * pageSize, total),
                  total,
                })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> {messages.search.previous}
                </Button>
                <span className="text-muted-foreground text-sm">
                  {formatTemplate(messages.search.page, { page, totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                >
                  {messages.search.next} <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      <CatalogDetailSheet
        hit={openHit}
        onOpenChange={(open) => {
          if (!open) setOpenHit(null)
        }}
        formatters={tab.detailFormatters}
        actions={tab.detailActions}
        imageField={tab.imageField ?? "thumbnailUrl"}
        width={tab.detailSheetWidth ?? detailSheetWidth}
        headerExtras={tab.detailHeaderExtras ?? detailHeaderExtras}
        onLoadDetail={tab.onLoadDetail}
        onBookDeparture={tab.onBookDeparture}
        onBookOption={tab.onBookOption}
        renderBrochure={tab.renderDetailBrochure ?? renderDetailBrochure}
        renderMedia={tab.renderDetailMedia ?? renderDetailMedia}
        renderItineraryDay={tab.renderDetailItineraryDay ?? renderDetailItineraryDay}
        renderExtraSections={tab.renderDetailExtraSections ?? renderDetailExtraSections}
        renderSupplierLink={renderSupplierLink}
        onTagsChange={onTagsChange}
      />
    </div>
  )
}

function buildFilters(selections: FilterSelections) {
  const filters = []
  for (const [field, values] of Object.entries(selections.facets)) {
    if (values.length === 0) continue
    if (values.length === 1) {
      filters.push({ kind: "eq", field, value: values[0] as string | number | boolean })
    } else {
      filters.push({ kind: "in", field, values })
    }
  }
  for (const [field, range] of Object.entries(selections.ranges)) {
    if (range.gte == null && range.lte == null) continue
    filters.push({
      kind: "range",
      field,
      ...(range.gte != null ? { gte: range.gte } : {}),
      ...(range.lte != null ? { lte: range.lte } : {}),
    })
  }
  return filters.length > 0 ? filters : undefined
}

function toggleFacet(
  prev: FilterSelections,
  field: string,
  value: string | number,
): FilterSelections {
  const current = prev.facets[field] ?? []
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  return { ...prev, facets: { ...prev.facets, [field]: next } }
}

function clearFacet(prev: FilterSelections, field: string): FilterSelections {
  const facets = { ...prev.facets }
  delete facets[field]
  return { ...prev, facets }
}

function setRange(
  prev: FilterSelections,
  field: string,
  next: CatalogRangeFilterValue | undefined,
): FilterSelections {
  const ranges = { ...prev.ranges }
  if (!next || (next.gte == null && next.lte == null)) {
    delete ranges[field]
  } else {
    ranges[field] = next
  }
  return { ...prev, ranges }
}

function formatTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key]
    return value === undefined ? "" : String(value)
  })
}
