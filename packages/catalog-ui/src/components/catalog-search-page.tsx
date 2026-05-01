"use client"

import {
  type CatalogSearchHit,
  type CatalogSearchMode,
  useCatalogSearch,
} from "@voyantjs/catalog-react"
import { Input } from "@voyantjs/ui/components/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { Search } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"

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
   * Optional empty-state ReactNode — shown when the tab has no hits for
   * the current query. Defaults to a simple "no results" message.
   */
  emptyState?: ReactNode
}

export interface CatalogSearchPageProps {
  tabs: CatalogSearchTab[]
  /** Default tab id; falls back to the first tab. */
  defaultTab?: string
  /** Search mode passed to every tab's query. Default `keyword`. */
  mode?: CatalogSearchMode
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
 * Generic tabbed search shell. Owns the search input + tab state +
 * per-tab data fetching via `useCatalogSearch`. Per-vertical visuals
 * come from the tab's `renderCard` callback so this shell stays
 * vertical-agnostic.
 */
export function CatalogSearchPage({
  tabs,
  defaultTab,
  mode = "keyword",
  pageSize = 20,
  title,
  searchPlaceholder = "Search the catalog…",
  queryDebounceMs = 200,
}: CatalogSearchPageProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab ?? tabs[0]?.id ?? "")
  const [rawQuery, setRawQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

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
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder={searchPlaceholder}
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

function CatalogTabPanel({ tab, query, mode, pageSize }: CatalogTabPanelProps) {
  const { data, isLoading, error } = useCatalogSearch({
    vertical: tab.vertical,
    query,
    mode,
    pagination: { limit: pageSize },
  })

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : String(error)}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder, no stable id
          <div key={i} className="h-32 animate-pulse rounded-md border bg-muted/40" />
        ))}
      </div>
    )
  }

  const hits = data?.hits ?? []
  if (hits.length === 0) {
    return (
      tab.emptyState ?? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No results for {query ? `"${query}"` : "your filters"} in {tab.label.toLowerCase()}.
        </div>
      )
    )
  }

  return (
    <>
      <div className="mb-3 text-sm text-muted-foreground">
        {data?.total ?? hits.length} result{(data?.total ?? hits.length) === 1 ? "" : "s"}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hits.map((hit) => (
          <div key={hit.id}>{tab.renderCard(hit)}</div>
        ))}
      </div>
    </>
  )
}
