"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  defaultFetcher,
  useVoyantDistributionContext,
  type VoyantFetcher,
} from "@voyantjs/distribution-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components"
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@voyantjs/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { AlertTriangle, ChevronDown, Loader2, RotateCw, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

// Types matching the admin API at distribution/src/channel-push/admin-routes.ts

type PushStatus = "pending" | "ok" | "failed" | "compensated"

interface ChannelBookingLinkRow {
  link: {
    id: string
    channelId: string
    bookingId: string
    bookingItemId: string | null
    sourceKind: string | null
    sourceConnectionId: string | null
    pushStatus: PushStatus | string
    pushAttempts: number
    lastPushAt: string | null
    lastError: string | null
    externalBookingId: string | null
    externalReference: string | null
    externalStatus: string | null
    createdAt: string
  }
  channelName: string
  channelKind: string
}

interface LinksResponse {
  data: ChannelBookingLinkRow[]
  counts: Record<string, number>
}

interface DeliveryRow {
  id: string
  sourceModule: string
  sourceEvent: string
  sourceEntityId: string | null
  targetUrl: string
  targetKind: string | null
  targetRef: string | null
  requestMethod: string
  responseStatus: number | null
  responseBodyExcerpt: string | null
  attemptNumber: number
  status: string
  errorClass: string | null
  errorMessage: string | null
  durationMs: number | null
  createdAt: string
}

interface DeliveriesResponse {
  data: DeliveryRow[]
}

interface ThrottlingRow {
  channelId: string | null
  count: number
}

interface ThrottlingResponse {
  data: ThrottlingRow[]
  sinceMs: number
}

interface ReconcilerResult {
  scanned: number
  triggered: number
}

interface BookingRecord {
  id: string
  bookingNumber: string
  status: string
}

interface BookingsResponse {
  data: BookingRecord[]
}

interface ChannelRecord {
  id: string
  name: string
  kind: string
  status: string
}

interface ChannelsResponse {
  data: ChannelRecord[]
}

export interface ChannelSyncPageProps {
  baseUrl?: string
  fetcher?: VoyantFetcher
  className?: string
}

// Fetch helpers

async function fetchJson<T>(
  path: string,
  options: { baseUrl: string; fetcher: VoyantFetcher },
  init?: RequestInit,
): Promise<T> {
  const res = await options.fetcher(joinUrl(options.baseUrl, path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const text = await res.text()
  const body = text
    ? (JSON.parse(text) as { data?: T; error?: string })
    : ({} as { error?: string })
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return body as T
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  ok: "default",
  failed: "destructive",
  compensated: "outline",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  ok: "OK",
  failed: "Failed",
  compensated: "Compensated",
}

const STATUS_TILES: ReadonlyArray<{
  key: PushStatus
  label: string
  description: string
  tone: "default" | "secondary" | "destructive" | "outline"
}> = [
  { key: "pending", label: "Pending", description: "In flight", tone: "secondary" },
  { key: "ok", label: "Delivered", description: "Channel acknowledged", tone: "default" },
  { key: "failed", label: "Failed", description: "Needs attention", tone: "destructive" },
  {
    key: "compensated",
    label: "Compensated",
    description: "Rolled back",
    tone: "outline",
  },
]

const LINKS_REFETCH_MS = 15_000
const THROTTLING_REFETCH_MS = 60_000

// Page

export function ChannelSyncPage({ baseUrl, fetcher, className }: ChannelSyncPageProps = {}) {
  const context = useVoyantDistributionContext()
  const client = {
    baseUrl: baseUrl ?? context.baseUrl,
    fetcher: fetcher ?? context.fetcher ?? defaultFetcher,
  }
  const [statusFilter, setStatusFilter] = useState<PushStatus | "all">("all")

  const [bookingId, setBookingId] = useState<string | null>(null)
  const [bookingSearch, setBookingSearch] = useState("")
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null)

  const [channelId, setChannelId] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<ChannelRecord | null>(null)

  const [drilldownBookingId, setDrilldownBookingId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const linksQuery = useQuery<LinksResponse>({
    queryKey: ["channel-push-links", statusFilter, bookingId, channelId],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" })
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (bookingId) params.set("bookingId", bookingId)
      if (channelId) params.set("channelId", channelId)
      return fetchJson<LinksResponse>(`/v1/admin/distribution/channel-push/links?${params}`, client)
    },
    refetchInterval: LINKS_REFETCH_MS,
    refetchIntervalInBackground: false,
  })

  const throttlingQuery = useQuery<ThrottlingResponse>({
    queryKey: ["channel-push-throttling"],
    queryFn: () =>
      fetchJson<ThrottlingResponse>("/v1/admin/distribution/channel-push/throttling", client),
    refetchInterval: THROTTLING_REFETCH_MS,
  })

  const debouncedBookingSearch = useDebouncedValue(bookingSearch, 200)
  const bookingsQuery = useQuery<BookingsResponse>({
    queryKey: ["channel-sync-booking-options", debouncedBookingSearch],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "20" })
      if (debouncedBookingSearch.trim()) params.set("search", debouncedBookingSearch.trim())
      return fetchJson<BookingsResponse>(`/v1/admin/bookings?${params}`, client)
    },
    placeholderData: (prev) => prev,
  })

  const channelsQuery = useQuery<ChannelsResponse>({
    queryKey: ["channel-sync-channel-options"],
    queryFn: () => fetchJson<ChannelsResponse>(`/v1/admin/distribution/channels?limit=100`, client),
    staleTime: 60_000,
  })

  const retryMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: boolean; bookingId: string }>(
        `/v1/admin/distribution/channel-push/retry/${id}`,
        client,
        { method: "POST" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["channel-push-links"] })
    },
  })

  const reconcileMutation = useMutation({
    mutationFn: (flow: "bookings" | "availability" | "content") =>
      fetchJson<ReconcilerResult>(`/v1/admin/distribution/channel-push/reconcile/${flow}`, client, {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["channel-push-links"] })
    },
  })

  const counts = linksQuery.data?.counts ?? {}
  const rows = linksQuery.data?.data ?? []
  const throttledChannels = throttlingQuery.data?.data ?? []
  const isThrottled = throttledChannels.length > 0
  const filtersActive = statusFilter !== "all" || bookingId !== null || channelId !== null

  const clearFilters = () => {
    setStatusFilter("all")
    setBookingId(null)
    setBookingSearch("")
    setSelectedBooking(null)
    setChannelId(null)
    setSelectedChannel(null)
  }

  const bookingOptions = bookingsQuery.data?.data ?? []
  const channelOptions = channelsQuery.data?.data ?? []

  return (
    <div data-slot="channel-sync-page" className={cn("flex flex-col gap-6 p-6", className)}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Channel sync</h2>
          <p className="text-sm text-muted-foreground">
            Outbound delivery to syndication channels. Bookings push first; availability and content
            ride along in the background.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutoRefreshIndicator
            isFetching={linksQuery.isFetching}
            dataUpdatedAt={linksQuery.dataUpdatedAt}
            intervalMs={LINKS_REFETCH_MS}
          />
          <ReconcileMenu
            onRun={(flow) => reconcileMutation.mutate(flow)}
            isRunning={reconcileMutation.isPending}
            lastResult={reconcileMutation.data ?? null}
          />
        </div>
      </div>

      {/* Throttling banner */}
      {isThrottled ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-medium">Throttled.</span>{" "}
            <span>
              {throttledChannels.reduce((sum, c) => sum + c.count, 0)} rate-limited deliveries in
              the last hour across {throttledChannels.length} channel
              {throttledChannels.length === 1 ? "" : "s"}. Lower the per-channel RPS in settings if
              this persists.
            </span>
          </div>
        </div>
      ) : null}

      {/* Status tiles drive the primary status filter. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATUS_TILES.map((tile) => {
          const isActive = statusFilter === tile.key
          const value = counts[tile.key] ?? 0
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setStatusFilter(isActive ? "all" : tile.key)}
              className={cn(
                "group rounded-lg border bg-card p-4 text-left transition-all",
                "hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "border-primary ring-2 ring-primary/30",
              )}
              aria-pressed={isActive}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tile.label}
                </span>
                {tile.key === "failed" && value > 0 ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                ) : null}
              </div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{tile.description}</div>
            </button>
          )
        })}
      </div>

      {/* Filter row drives booking and channel filters. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="cs-booking" className="text-xs">
            Booking
          </Label>
          <AsyncCombobox<BookingRecord>
            value={bookingId}
            onChange={(value) => {
              setBookingId(value)
              if (!value) setSelectedBooking(null)
              else {
                const match = bookingOptions.find((b) => b.id === value)
                if (match) setSelectedBooking(match)
              }
            }}
            items={bookingOptions}
            selectedItem={selectedBooking}
            getKey={(b) => b.id}
            getLabel={(b) => b.bookingNumber}
            getSecondary={(b) => b.status}
            onSearchChange={setBookingSearch}
            placeholder="Search by booking number..."
            emptyText={bookingsQuery.isFetching ? "Searching..." : "No bookings match that search."}
            triggerClassName="w-full"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="cs-channel" className="text-xs">
            Channel
          </Label>
          <AsyncCombobox<ChannelRecord>
            value={channelId}
            onChange={(value) => {
              setChannelId(value)
              if (!value) setSelectedChannel(null)
              else {
                const match = channelOptions.find((c) => c.id === value)
                if (match) setSelectedChannel(match)
              }
            }}
            items={channelOptions}
            selectedItem={selectedChannel}
            getKey={(c) => c.id}
            getLabel={(c) => c.name}
            getSecondary={(c) => formatChannelKind(c.kind)}
            placeholder="Pick a channel..."
            emptyText="No channels configured yet."
            triggerClassName="w-full"
          />
        </div>
        {filtersActive ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {/* Links table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Booking links</CardTitle>
          <CardDescription>
            {filtersActive
              ? `Showing ${rows.length} of the most recent matching pushes.`
              : "The most recent per-channel push attempts."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {linksQuery.isPending ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyTitle>{filtersActive ? "No matches" : "No links yet"}</EmptyTitle>
                <EmptyDescription>
                  {filtersActive
                    ? "Try clearing the filters or picking a different booking or channel."
                    : "Channel-push booking links show up here as bookings confirm. The page refreshes automatically."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Last push</TableHead>
                  <TableHead>External ref</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isFailed = row.link.pushStatus === "failed"
                  return (
                    <TableRow
                      key={row.link.id}
                      className={cn(isFailed && "bg-destructive/5 hover:bg-destructive/10")}
                    >
                      <TableCell className="font-mono text-xs">
                        <div>{row.link.bookingId}</div>
                        {row.link.bookingItemId ? (
                          <div className="text-muted-foreground">
                            item: {row.link.bookingItemId}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.channelName}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatChannelKind(row.channelKind)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[row.link.pushStatus] ?? "outline"}>
                          {STATUS_LABELS[row.link.pushStatus] ?? row.link.pushStatus}
                        </Badge>
                        {row.link.lastError ? (
                          <div
                            className="mt-1 max-w-xs truncate text-xs text-destructive"
                            title={row.link.lastError}
                          >
                            {row.link.lastError}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.link.pushAttempts}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.link.lastPushAt ? formatRelative(row.link.lastPushAt) : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.link.externalBookingId ?? row.link.externalReference ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDrilldownBookingId(row.link.bookingId)}
                          >
                            Deliveries
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              retryMutation.isPending &&
                              retryMutation.variables === row.link.bookingId
                            }
                            onClick={() => retryMutation.mutate(row.link.bookingId)}
                          >
                            {retryMutation.isPending &&
                            retryMutation.variables === row.link.bookingId ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : null}
                            Retry
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DeliveriesDrawer
        bookingId={drilldownBookingId}
        client={client}
        onClose={() => setDrilldownBookingId(null)}
      />
    </div>
  )
}

function ReconcileMenu({
  onRun,
  isRunning,
  lastResult,
}: {
  onRun: (flow: "bookings" | "availability" | "content") => void
  isRunning: boolean
  lastResult: ReconcilerResult | null
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Reconcile
            <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Run reconciler</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onRun("bookings")}>
            Bookings
            <span className="ml-auto text-xs text-muted-foreground">priority</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRun("availability")}>Availability</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRun("content")}>Content</DropdownMenuItem>
        </DropdownMenuGroup>
        {lastResult ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Last run: scanned {lastResult.scanned}, triggered {lastResult.triggered}.
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AutoRefreshIndicator({
  isFetching,
  dataUpdatedAt,
  intervalMs,
}: {
  isFetching: boolean
  dataUpdatedAt: number
  intervalMs: number
}) {
  // Tick every second so the "Updated Xs ago" stays current.
  const [, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!dataUpdatedAt) {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading...
      </span>
    )
  }

  const seconds = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000))
  const intervalSec = Math.round(intervalMs / 1000)

  return (
    <span
      className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"
      title={`Auto-refreshes every ${intervalSec}s`}
    >
      {isFetching ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      )}
      <span className="tabular-nums">
        {isFetching ? "Refreshing..." : `Updated ${formatShortDuration(seconds)} ago`}
      </span>
    </span>
  )
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setDebounced(value), delayMs)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [value, delayMs])
  return debounced
}

function DeliveriesDrawer({
  bookingId,
  client,
  onClose,
}: {
  bookingId: string | null
  client: { baseUrl: string; fetcher: VoyantFetcher }
  onClose: () => void
}) {
  const isOpen = bookingId !== null
  const query = useQuery<DeliveriesResponse>({
    enabled: isOpen,
    queryKey: ["channel-push-deliveries", bookingId],
    queryFn: () => {
      const params = new URLSearchParams({ bookingId: bookingId ?? "", limit: "200" })
      return fetchJson<DeliveriesResponse>(
        `/v1/admin/distribution/channel-push/deliveries?${params}`,
        client,
      )
    },
  })

  const rows = query.data?.data ?? []

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle>Delivery log - {bookingId ?? ""}</SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          {query.isPending ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No deliveries yet</EmptyTitle>
                <EmptyDescription>
                  Channel-push attempts log here once they dispatch.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            rows.map((row) => (
              <Card key={row.id} className="text-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={row.status === "succeeded" ? "default" : "destructive"}>
                        {row.status}
                      </Badge>
                      <span className="font-mono">{row.sourceEvent}</span>
                      <span className="text-muted-foreground">attempt #{row.attemptNumber}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {row.durationMs != null ? `${row.durationMs}ms` : ""}
                    </span>
                  </div>
                  <CardDescription className="font-mono">
                    {row.requestMethod} {row.targetUrl}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {row.responseStatus != null ? (
                      <Badge variant="outline">HTTP {row.responseStatus}</Badge>
                    ) : null}
                    {row.errorClass ? <Badge variant="destructive">{row.errorClass}</Badge> : null}
                    <span className="text-muted-foreground">{formatRelative(row.createdAt)}</span>
                  </div>
                  {row.errorMessage ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-destructive/10 p-2 text-destructive">
                      {row.errorMessage}
                    </pre>
                  ) : null}
                  {row.responseBodyExcerpt ? (
                    <pre className="overflow-x-auto rounded bg-muted p-2">
                      {row.responseBodyExcerpt}
                    </pre>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

function formatChannelKind(kind: string): string {
  return kind.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatShortDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const min = Math.round(seconds / 60)
  if (min < 60) return `${min}m`
  const hours = Math.round(min / 60)
  return `${hours}h`
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}
