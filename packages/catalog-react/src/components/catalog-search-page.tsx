// agent-quality: file-size exception -- owner: catalog-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@voyantjs/ui/components/button"
import { DataTable } from "@voyantjs/ui/components/data-table"
import { Input } from "@voyantjs/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { ToggleGroup, ToggleGroupItem } from "@voyantjs/ui/components/toggle-group"
import { ChevronLeft, ChevronRight, LayoutGrid, List, Search } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { useCatalogUiMessagesOrDefault } from "../i18n/index.js"
import { type CatalogSearchHit, useCatalogSearch } from "../index.js"
import { CatalogCard, type CatalogCardConfig } from "./catalog-card.js"
import {
  type CatalogDetailAction,
  type CatalogDetailEnrichment,
  type CatalogDetailRenderSlot,
  CatalogDetailSheet,
  type CatalogDetailSheetProps,
} from "./catalog-detail-sheet.js"
import { CatalogFilterRail } from "./catalog-filter-rail.js"
import type { CatalogRangeFilterValue } from "./catalog-range-filter.js"

/**
 * Result sort options. Mirrors `CatalogSearchSort` from `@voyantjs/catalog-react`
 * (not re-exported there, so kept as a literal union here). The shell maps the
 * selection straight onto the search request's `sort`.
 */
export type CatalogSortOption =
  | "relevance"
  | "price-asc"
  | "price-desc"
  | "departure-asc"
  | "newest"

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
  /**
   * How to order the facet buckets. Default `"count"` keeps the index's
   * descending-by-count order. `"value-desc"`/`"value-asc"` sort by the bucket
   * value numerically when possible (e.g. star ratings 5 → 0), else
   * lexicographically.
   */
  sortValues?: "count" | "value-desc" | "value-asc"
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
 * (`products`, `cruises`, `accommodations`, etc.) and supplies its own column
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
   * Optional row/card open override. When set, clicking a result calls this
   * instead of opening the in-page detail sheet — use it to route to a
   * full, URL-addressable detail page (e.g. open in a new tab). Verticals
   * without a dedicated detail page omit it and keep the sheet.
   */
  onOpenDetail?: (hit: CatalogSearchHit) => void
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
   * Optional merchandising-card mapping. When set, the tab gains a grid
   * (card) view alongside the table, and the grid/list toggle appears. The
   * card projects indexed fields only (no extra fetch) — see `CatalogCard`.
   */
  card?: CatalogCardConfig
  /**
   * Non-relevance sort options to offer for this tab. `relevance` is always
   * first. Defaults to `["price-asc","price-desc","newest"]` when the card
   * declares a price field, else `["newest"]`.
   */
  sorts?: CatalogSortOption[]
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
  /** Lazy per-cabin pricing loader for cruise departures (see detail sheet). */
  onLoadDeparturePricing?: CatalogDetailSheetProps["onLoadDeparturePricing"]
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

// Grid cards are bigger, so show fewer per page; the dense list view shows more
// (the `pageSize` prop is the list size).
const GRID_PAGE_SIZE = 15

export interface CatalogSearchPageProps {
  tabs: CatalogSearchTab[]
  /** Default tab id; falls back to the first tab. */
  defaultTab?: string
  /** Items per page in the list view (grid view uses a smaller fixed size). Default `40`. */
  pageSize?: number
  /**
   * Optional title above the search bar. Templates that use TanStack
   * Start's page-level title elements should pass null and render their
   * own.
   */
  title?: ReactNode
  /** Placeholder text for the search input. */
  searchPlaceholder?: string
  /**
   * Hide the built-in search input. Use when an embedding surface provides its
   * own unified search box and drives `query`/`onQueryChange` externally.
   */
  hideSearchInput?: boolean
  /** Debounce on keystrokes, milliseconds. Default 200. */
  queryDebounceMs?: number
  /**
   * Controlled active-tab id. When provided, callers must also pass
   * `onActiveTabChange` and the tab state is owned by the parent (e.g. a
   * router-driven URL state). Omit for uncontrolled internal state.
   */
  activeTab?: string
  onActiveTabChange?: (tabId: string) => void
  /** Hide the tab switcher when the parent route already selects one vertical. */
  showTabs?: boolean
  /** Controlled query string (already debounced if you want to skip the debounce here). */
  query?: string
  onQueryChange?: (q: string) => void
  /** Controlled current page (1-indexed) for the active tab. */
  page?: number
  onPageChange?: (page: number) => void
  /** Controlled grid/list view mode (e.g. URL-persisted). Uncontrolled when omitted. */
  view?: "grid" | "list"
  onViewChange?: (view: "grid" | "list") => void
  /** Controlled sort option (e.g. URL-persisted). Uncontrolled when omitted. */
  sort?: CatalogSortOption
  onSortChange?: (sort: CatalogSortOption) => void
  /** Controlled filter selections (e.g. URL-persisted). Uncontrolled when omitted. */
  filters?: CatalogFilterSelections
  onFiltersChange?: (filters: CatalogFilterSelections) => void
  /** Catalog slice market override. */
  market?: string
  /** Catalog slice locale override. */
  locale?: string
  /** Optional controls rendered next to the search input. */
  toolbarEnd?: ReactNode
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
  pageSize = 40,
  title,
  searchPlaceholder,
  hideSearchInput = false,
  queryDebounceMs = 200,
  activeTab: activeTabProp,
  onActiveTabChange,
  showTabs = true,
  query: queryProp,
  onQueryChange,
  page: pageProp,
  onPageChange,
  view,
  onViewChange,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  market,
  locale,
  toolbarEnd,
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

  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? (tabs[0] as CatalogSearchTab)
  const shouldRenderTabs = showTabs && tabs.length > 1
  const renderTabBody = (tab: CatalogSearchTab) => (
    <>
      {/* The search box lives inside each vertical body — it queries that
          vertical index, so it belongs with the vertical, not the page. An
          embedding surface can hide it and drive `query` externally. */}
      {!hideSearchInput && (
        <div className="relative max-w-xl">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={rawQuery}
            onChange={(e) => setInternalRawQuery(e.target.value)}
            placeholder={resolvedSearchPlaceholder}
            className="pl-9"
          />
        </div>
      )}
      <CatalogTabPanel
        tab={tab}
        query={debouncedQuery}
        market={market}
        locale={locale}
        pageSize={pageSize}
        page={tab.id === activeTab ? pageProp : undefined}
        onPageChange={tab.id === activeTab ? onPageChange : undefined}
        view={view}
        onViewChange={onViewChange}
        sort={sort}
        onSortChange={onSortChange}
        filters={filters}
        onFiltersChange={onFiltersChange}
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
    </>
  )

  return (
    <div className="flex flex-col gap-4">
      {title}
      {toolbarEnd ? (
        <div className="flex flex-wrap items-center justify-end gap-2">{toolbarEnd}</div>
      ) : null}
      {shouldRenderTabs ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-4 flex flex-col gap-4">
              {renderTabBody(tab)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="flex flex-col gap-4">{renderTabBody(activeTabConfig)}</div>
      )}
    </div>
  )
}

interface CatalogTabPanelProps {
  tab: CatalogSearchTab
  query: string
  market?: string
  locale?: string
  pageSize: number
  /** Controlled page (1-indexed). Falls back to internal state when omitted. */
  page?: number
  onPageChange?: (page: number) => void
  /** Controlled view mode / sort / filters. Fall back to internal state when omitted. */
  view?: "grid" | "list"
  onViewChange?: (view: "grid" | "list") => void
  sort?: CatalogSortOption
  onSortChange?: (sort: CatalogSortOption) => void
  filters?: CatalogFilterSelections
  onFiltersChange?: (filters: CatalogFilterSelections) => void
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

/**
 * Public (controlled) filter-selection shape. Both maps are optional so
 * callers persisting to URL state can omit empties; the panel normalizes to
 * `FilterSelections` internally.
 */
export interface CatalogFilterSelections {
  facets?: Record<string, Array<string | number>>
  ranges?: Record<string, CatalogRangeFilterValue>
}

function CatalogTabPanel({
  tab,
  query,
  market,
  locale,
  pageSize,
  page: pageProp,
  onPageChange,
  view: viewProp,
  onViewChange,
  sort: sortProp,
  onSortChange,
  filters: filtersProp,
  onFiltersChange,
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
  // Filter selections can be controlled (URL-persisted) by the page, else
  // internal. `setSelections` keeps the value-or-updater signature so the
  // existing call sites work for both modes.
  const [internalSelections, setInternalSelections] = useState<FilterSelections>(EMPTY_SELECTIONS)
  const selections = useMemo<FilterSelections>(
    () =>
      filtersProp
        ? { facets: filtersProp.facets ?? {}, ranges: filtersProp.ranges ?? {} }
        : internalSelections,
    [filtersProp, internalSelections],
  )
  const setSelections = (
    next: FilterSelections | ((prev: FilterSelections) => FilterSelections),
  ) => {
    const resolved = typeof next === "function" ? next(selections) : next
    onFiltersChange?.(resolved)
    if (filtersProp == null) setInternalSelections(resolved)
  }
  const [internalPage, setInternalPage] = useState(1)
  const page = pageProp ?? internalPage
  const setPage = (next: number) => {
    if (onPageChange) onPageChange(next)
    if (pageProp == null) setInternalPage(next)
  }
  const [openHit, setOpenHit] = useState<CatalogSearchHit | null>(null)
  // View + sort can be controlled (URL-persisted) by the page, else internal.
  const [internalView, setInternalView] = useState<"grid" | "list">(tab.card ? "grid" : "list")
  const viewMode = viewProp ?? internalView
  const setViewMode = (next: "grid" | "list") => {
    onViewChange?.(next)
    if (viewProp == null) setInternalView(next)
  }
  // Grid shows fewer (bigger cards), list shows more (dense rows).
  const effectivePageSize = viewMode === "grid" ? GRID_PAGE_SIZE : pageSize
  const [internalSort, setInternalSort] = useState<CatalogSortOption>("relevance")
  const sort = sortProp ?? internalSort
  const setSort = (next: CatalogSortOption) => {
    onSortChange?.(next)
    if (sortProp == null) setInternalSort(next)
  }

  // Reset page when query / filters / sort change. Keeps "Next" honest.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tab.id / query / selections / sort / scope all reset page intentionally
  useEffect(() => {
    setPage(1)
  }, [tab.id, query, selections, sort, market, locale, viewMode])

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
  const { data, isLoading, isFetching, isPlaceholderData, error } = useCatalogSearch({
    vertical: tab.vertical,
    query,
    mode: "hybrid",
    market,
    locale,
    filters,
    facets: facetRequests,
    sort,
    pagination: { limit: effectivePageSize, cursor: page > 1 ? String(page) : undefined },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / effectivePageSize))
  const facetGroups = data?.facets ?? {}
  const hits = data?.hits ?? []

  const sortOptions = useMemo<CatalogSortOption[]>(() => {
    const opts: CatalogSortOption[] = ["relevance"]
    if (tab.sorts) {
      opts.push(...tab.sorts)
    } else {
      if (tab.card?.priceAmountField) opts.push("price-asc", "price-desc")
      opts.push("newest")
    }
    return opts
  }, [tab.sorts, tab.card])
  const sortItems = sortOptions.map((value) => ({ value, label: sortLabel(value, messages) }))
  const cardConfig = tab.card

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {visibleFilterFields.length > 0 && (
          <aside className="lg:w-60 lg:shrink-0">
            <CatalogFilterRail
              fields={visibleFilterFields}
              facetGroups={facetGroups}
              selectedFacets={selections.facets}
              selectedRanges={selections.ranges}
              onToggleFacet={(field, value) =>
                setSelections((prev) => toggleFacet(prev, field, value))
              }
              onClearFacet={(field) => setSelections((prev) => clearFacet(prev, field))}
              onSetRange={(field, next) => setSelections((prev) => setRange(prev, field, next))}
              onClearAll={() => setSelections(EMPTY_SELECTIONS)}
              hasSelections={hasSelections}
            />
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">
              {isLoading
                ? null
                : `${total} ${total === 1 ? messages.search.resultSingular : messages.search.resultPlural}`}
            </span>
            <div className="flex items-center gap-2">
              <Select
                items={sortItems}
                value={sort}
                onValueChange={(value) => setSort(value as CatalogSortOption)}
              >
                <SelectTrigger
                  className="h-9 w-[190px] rounded-md data-[size=default]:h-9"
                  aria-label={messages.view.sort}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cardConfig && (
                <ToggleGroup
                  value={[viewMode]}
                  onValueChange={(values) => {
                    const next = values[values.length - 1]
                    if (next === "grid" || next === "list") setViewMode(next)
                  }}
                  variant="outline"
                  aria-label={messages.view.filters}
                >
                  <ToggleGroupItem value="grid" aria-label={messages.view.grid}>
                    <LayoutGrid className="size-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label={messages.view.list}>
                    <List className="size-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>
          </div>

          {isLoading ? (
            <ResultsSkeleton
              grid={viewMode === "grid" && Boolean(cardConfig)}
              count={effectivePageSize}
            />
          ) : (
            <>
              {/* Keep results mounted while a new query loads (paging/filtering)
                  and just dim them — no skeleton flash, no layout shift. */}
              <div
                aria-busy={isFetching}
                className={`transition-opacity duration-150 ${
                  isFetching && isPlaceholderData ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {hits.length === 0 ? (
                  (tab.emptyState ?? (
                    <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
                      {formatTemplate(messages.search.noResults, {
                        query: query ? `"${query}"` : messages.search.yourFilters,
                        tab: tab.label.toLowerCase(),
                      })}
                    </div>
                  ))
                ) : viewMode === "grid" && cardConfig ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {hits.map((hit) => (
                      <CatalogCard
                        key={hit.id}
                        hit={hit}
                        config={cardConfig}
                        imageFallbackField={tab.imageField}
                        fallbackTitle={messages.fallbacks.detailName}
                        onOpen={tab.onOpenDetail ?? setOpenHit}
                      />
                    ))}
                  </div>
                ) : (
                  <DataTable
                    columns={tab.columns}
                    data={hits}
                    getRowId={(row) => row.id}
                    onRowClick={(row) => (tab.onOpenDetail ?? setOpenHit)(row.original)}
                    showPagination={false}
                    pageSize={effectivePageSize}
                  />
                )}
              </div>
              {totalPages > 1 && (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-sm">
                    {formatTemplate(messages.search.showing, {
                      from: (page - 1) * effectivePageSize + 1,
                      to: Math.min(page * effectivePageSize, total),
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
        </div>
      </div>
      <CatalogDetailSheet
        hit={openHit}
        onOpenChange={(open) => {
          if (!open) setOpenHit(null)
        }}
        formatters={tab.detailFormatters}
        actions={tab.detailActions}
        imageField={tab.imageField ?? "thumbnailUrl"}
        vertical={tab.vertical}
        width={tab.detailSheetWidth ?? detailSheetWidth}
        headerExtras={tab.detailHeaderExtras ?? detailHeaderExtras}
        onLoadDetail={tab.onLoadDetail}
        onLoadDeparturePricing={tab.onLoadDeparturePricing}
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

function sortLabel(option: CatalogSortOption, messages: CatalogTabPanelProps["messages"]): string {
  switch (option) {
    case "price-asc":
      return messages.view.sortPriceAsc
    case "price-desc":
      return messages.view.sortPriceDesc
    case "departure-asc":
      return messages.view.sortSoonest
    case "newest":
      return messages.view.sortNewest
    default:
      return messages.view.sortRelevance
  }
}

function ResultsSkeleton({ grid, count = 12 }: { grid: boolean; count?: number }) {
  // Match the real layout + roughly the page size so the first load doesn't
  // jump when results arrive. Cap grid cards so the skeleton isn't absurdly tall.
  if (grid) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: Math.min(count, 15) }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder -- owner: catalog-react; existing suppression is intentional pending typed cleanup.
          <div key={i} className="overflow-hidden rounded-lg border">
            <div className="aspect-[4/3] w-full animate-pulse bg-muted/40" />
            <div className="flex flex-col gap-2 p-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted/20" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted/20" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="h-12 animate-pulse border-b bg-muted/40" />
      {Array.from({ length: Math.min(count, 40) }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder -- owner: catalog-react; existing suppression is intentional pending typed cleanup.
        <div key={i} className="h-14 animate-pulse border-b bg-muted/20 last:border-b-0" />
      ))}
    </div>
  )
}
