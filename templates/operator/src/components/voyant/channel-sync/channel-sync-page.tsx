"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@voyantjs/ui/components/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { AlertTriangle, Loader2, RefreshCw, RotateCw } from "lucide-react"
import { useState } from "react"

import { getApiUrl } from "@/lib/env"

// ── Types matching the admin API at distribution/src/channel-push/admin-routes.ts

interface ChannelBookingLinkRow {
  link: {
    id: string
    channelId: string
    bookingId: string
    bookingItemId: string | null
    sourceKind: string | null
    sourceConnectionId: string | null
    pushStatus: string
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

// ── Fetch helpers

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    credentials: "include",
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

// ── Page

export function ChannelSyncPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [bookingFilter, setBookingFilter] = useState("")
  const [channelFilter, setChannelFilter] = useState("")
  const [drilldownBookingId, setDrilldownBookingId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const linksQuery = useQuery<LinksResponse>({
    queryKey: ["channel-push-links", statusFilter, bookingFilter, channelFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" })
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (bookingFilter.trim()) params.set("bookingId", bookingFilter.trim())
      if (channelFilter.trim()) params.set("channelId", channelFilter.trim())
      return fetchJson<LinksResponse>(`/v1/admin/distribution/channel-push/links?${params}`)
    },
    refetchInterval: 30_000,
  })

  const throttlingQuery = useQuery<ThrottlingResponse>({
    queryKey: ["channel-push-throttling"],
    queryFn: () => fetchJson<ThrottlingResponse>("/v1/admin/distribution/channel-push/throttling"),
    refetchInterval: 60_000,
  })

  const retryMutation = useMutation({
    mutationFn: (bookingId: string) =>
      fetchJson<{ ok: boolean; bookingId: string }>(
        `/v1/admin/distribution/channel-push/retry/${bookingId}`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["channel-push-links"] })
    },
  })

  const reconcileMutation = useMutation({
    mutationFn: (flow: "bookings" | "availability" | "content") =>
      fetchJson<ReconcilerResult>(`/v1/admin/distribution/channel-push/reconcile/${flow}`, {
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Channel sync</h2>
          <p className="text-sm text-muted-foreground">
            Monitor outbound pushes to syndication channels. Bookings flow first; availability and
            content pushes happen in the background.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={reconcileMutation.isPending}
            onClick={() => reconcileMutation.mutate("bookings")}
          >
            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            Reconcile bookings
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={reconcileMutation.isPending}
            onClick={() => reconcileMutation.mutate("availability")}
          >
            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            Availability
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={reconcileMutation.isPending}
            onClick={() => reconcileMutation.mutate("content")}
          >
            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            Content
          </Button>
        </div>
      </div>

      {/* Status tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatusTile label="Pending" value={counts.pending ?? 0} tone="secondary" />
        <StatusTile label="OK" value={counts.ok ?? 0} tone="default" />
        <StatusTile label="Failed" value={counts.failed ?? 0} tone="destructive" />
        <StatusTile label="Compensated" value={counts.compensated ?? 0} tone="outline" />
      </div>

      {isThrottled ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">Throttled.</span>
          <span>
            {throttledChannels.reduce((sum, c) => sum + c.count, 0)} rate-limited deliveries in the
            last hour across {throttledChannels.length} channel
            {throttledChannels.length === 1 ? "" : "s"}. Lower the per-channel RPS in settings if
            this persists.
          </span>
        </div>
      ) : null}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filter</CardTitle>
          <CardDescription>
            Narrow the list to a specific status, channel, or booking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cs-status" className="text-xs">
                Status
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value ?? "all")}
              >
                <SelectTrigger id="cs-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="compensated">Compensated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cs-booking" className="text-xs">
                Booking ID
              </Label>
              <Input
                id="cs-booking"
                value={bookingFilter}
                onChange={(e) => setBookingFilter(e.target.value)}
                placeholder="book_…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cs-channel" className="text-xs">
                Channel ID
              </Label>
              <Input
                id="cs-channel"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                placeholder="chan_…"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Links table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm">Booking links</CardTitle>
            <CardDescription>Per-channel push state for recent bookings.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void linksQuery.refetch()}
            disabled={linksQuery.isFetching}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${linksQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {linksQuery.isPending ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyTitle>No links found</EmptyTitle>
                <EmptyDescription>
                  Channel-push booking links show up here as bookings confirm. Adjust the filters or
                  wait for a booking to land.
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
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last push</TableHead>
                  <TableHead>External ref</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.link.id}>
                    <TableCell className="font-mono text-xs">
                      <div>{row.link.bookingId}</div>
                      {row.link.bookingItemId ? (
                        <div className="text-muted-foreground">item: {row.link.bookingItemId}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div>{row.channelName}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {row.channelKind.replace("_", " ")}
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
                    <TableCell className="tabular-nums">{row.link.pushAttempts}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.link.lastPushAt ? formatRelative(row.link.lastPushAt) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.link.externalBookingId ?? row.link.externalReference ?? "—"}
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DeliveriesDrawer
        bookingId={drilldownBookingId}
        onClose={() => setDrilldownBookingId(null)}
      />
    </div>
  )
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "default" | "secondary" | "destructive" | "outline"
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <Badge variant={tone} className="text-xs">
          {label}
        </Badge>
      </CardContent>
    </Card>
  )
}

function DeliveriesDrawer({
  bookingId,
  onClose,
}: {
  bookingId: string | null
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
      )
    },
  })

  const rows = query.data?.data ?? []

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle>Delivery log — {bookingId ?? ""}</SheetTitle>
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
