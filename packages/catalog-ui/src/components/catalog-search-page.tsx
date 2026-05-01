"use client"

import {
  type CatalogFacetBucket,
  type CatalogSearchHit,
  type CatalogSearchMode,
  useCatalogSearch,
} from "@voyantjs/catalog-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { ToggleGroup, ToggleGroupItem } from "@voyantjs/ui/components/toggle-group"
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"

/**
 * Declares a facetable field on a tab. The page renders one chip group
 * per declaration; chip values come from the live facet response so the
 * UI never lies about what's present in the data.
 */
export interface CatalogFilterField {
  /** Field name on the indexer document (e.g. "status", "bookingMode"). */
  field: string
  /** Human-readable group label (already localized). */
  label: string
}

/**
 * One tab in the catalog search page. Each tab maps to a single vertical
 * (`products`, `cruises`, `hospitality`, etc.) and supplies its own card
 * renderer so per-vertical UI packages own their own visual language.
 */
export interface CatalogSearchTab {
  /** Stable id used as the TabsTrigger value + queryKey segment. */
  id: string
  /** Human-readable tab label (already localized). */
  label: string
  /** The catalog vertical to query — mapped to the slice's `vertical`. */
  vertical: string
  /** Per-tab result-card renderer — each `-ui` package exports one. */
  renderCard: (hit: CatalogSearchHit) => ReactNode
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
}

export interface CatalogSearchPageProps {
  tabs: CatalogSearchTab[]
  /** Default tab id; falls back to the first tab. */
  defaultTab?: string
  /**
   * Initial search mode. Default `keyword`. Page-level state — switching
   * the mode toggles for every tab.
   */
  defaultMode?: CatalogSearchMode
  /**
   * Available modes shown in the toggle. Default `["keyword", "hybrid",
   * "semantic"]`. Pass `["keyword"]` to hide the toggle entirely
   * (e.g. when the deployment doesn't have an embeddings provider).
   */
  availableModes?: CatalogSearchMode[]
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
}

/**
 * Generic tabbed search shell. Owns the search input, mode toggle,
 * tab state, and per-tab data fetching (search + facets + pagination).
 * Per-vertical visuals come from the tab's `renderCard` callback so
 * this shell stays vertical-agnostic.
 */
export function CatalogSearchPage({
  tabs,
  defaultTab,
  defaultMode = "keyword",
  availableModes = ["keyword", "hybrid", "semantic"],
  pageSize = 20,
  title,
  searchPlaceholder = "Search the catalog…",
  queryDebounceMs = 200,
}: CatalogSearchPageProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab ?? tabs[0]?.id ?? "")
  const [rawQuery, setRawQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [mode, setMode] = useState<CatalogSearchMode>(defaultMode)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery), queryDebounceMs)
    return () => clearTimeout(t)
  }, [rawQuery, queryDebounceMs])

  if (tabs.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        No catalog tabs configured.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {title}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {availableModes.length > 1 && (
          <ToggleGroup
            value={[mode]}
            onValueChange={(values: string[]) => {
              const next = values[0]
              if (next) setMode(next as CatalogSearchMode)
            }}
            className="shrink-0"
          >
            {availableModes.map((m) => (
              <ToggleGroupItem key={m} value={m} className="capitalize">
                {m}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
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
            <CatalogTabPanel tab={tab} query={debouncedQuery} mode={mode} pageSize={pageSize} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

interface CatalogTabPanelProps {
  tab: CatalogSearchTab
  query: string
  mode: CatalogSearchMode
  pageSize: number
}

/**
 * Filter selections for one tab, keyed by field. Multi-select — values
 * accumulate. Selecting a value adds it; selecting an already-selected
 * value removes it.
 */
type FilterSelections = Record<string, Array<string | number>>

function CatalogTabPanel({ tab, query, mode, pageSize }: CatalogTabPanelProps) {
  const [selections, setSelections] = useState<FilterSelections>({})
  const [page, setPage] = useState(1)

  // Reset page when query / mode / filters change. Keeps "Next" honest.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tab.id / query / mode / selections all reset page intentionally
  useEffect(() => {
    setPage(1)
  }, [tab.id, query, mode, selections])

  const filters = useMemo(() => buildFilters(selections), [selections])
  const facetRequests = useMemo(
    () => tab.filterFields?.map((f) => ({ field: f.field })),
    [tab.filterFields],
  )

  const { data, isLoading, error } = useCatalogSearch({
    vertical: tab.vertical,
    query,
    mode,
    filters,
    facets: facetRequests,
    pagination: { limit: pageSize, cursor: page > 1 ? String(page) : undefined },
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize))
  const facetGroups = data?.facets ?? {}

  if (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isModeError = /503|embedd|vector field/i.test(message)
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {isModeError
          ? `${mode} search isn't available in this deployment. Switch to keyword mode or configure an embeddings provider.`
          : message}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {tab.filterFields && tab.filterFields.length > 0 && (
        <CatalogFilterChips
          fields={tab.filterFields}
          facetGroups={facetGroups}
          selections={selections}
          onToggle={(field, value) => setSelections((prev) => toggleSelection(prev, field, value))}
          onClear={() => setSelections({})}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            <div key={i} className="h-32 animate-pulse rounded-md border bg-muted/40" />
          ))}
        </div>
      ) : (data?.hits.length ?? 0) === 0 ? (
        (tab.emptyState ?? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No results for {query ? `"${query}"` : "your filters"} in {tab.label.toLowerCase()}.
          </div>
        ))
      ) : (
        <>
          <div className="text-muted-foreground text-sm">
            {data?.total ?? 0} result{data?.total === 1 ? "" : "s"}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.hits.map((hit) => (
              <div key={hit.id}>{tab.renderCard(hit)}</div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <span className="text-muted-foreground text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface CatalogFilterChipsProps {
  fields: CatalogFilterField[]
  facetGroups: Record<string, CatalogFacetBucket[]>
  selections: FilterSelections
  onToggle: (field: string, value: string | number) => void
  onClear: () => void
}

function CatalogFilterChips({
  fields,
  facetGroups,
  selections,
  onToggle,
  onClear,
}: CatalogFilterChipsProps) {
  const hasSelections = Object.values(selections).some((v) => v.length > 0)

  return (
    <div className="flex flex-col gap-2">
      {fields.map((f) => {
        const buckets = facetGroups[f.field] ?? []
        if (buckets.length === 0) return null
        const selected = new Set(selections[f.field] ?? [])
        return (
          <div key={f.field} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-muted-foreground text-xs">{f.label}:</span>
            {buckets.map((b) => {
              const isOn = selected.has(b.value)
              return (
                <button
                  key={String(b.value)}
                  type="button"
                  onClick={() => onToggle(f.field, b.value)}
                  className="cursor-pointer"
                >
                  <Badge variant={isOn ? "default" : "outline"} className="text-[10px]">
                    {String(b.value)} ({b.count})
                  </Badge>
                </button>
              )
            })}
          </div>
        )
      })}
      {hasSelections && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="self-start text-muted-foreground"
        >
          <X className="mr-1 h-3 w-3" /> Clear filters
        </Button>
      )}
    </div>
  )
}

function buildFilters(selections: FilterSelections) {
  const filters = []
  for (const [field, values] of Object.entries(selections)) {
    if (values.length === 0) continue
    if (values.length === 1) {
      filters.push({ kind: "eq", field, value: values[0] as string | number | boolean })
    } else {
      filters.push({ kind: "in", field, values })
    }
  }
  return filters.length > 0 ? filters : undefined
}

function toggleSelection(
  prev: FilterSelections,
  field: string,
  value: string | number,
): FilterSelections {
  const current = prev[field] ?? []
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  return { ...prev, [field]: next }
}
