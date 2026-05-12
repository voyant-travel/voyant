"use client"

/**
 * Operator-facing promotions list page.
 *
 * Lists every promotional offer with server-backed search, filters, pagination,
 * and optional row navigation for apps that expose a dedicated detail route.
 */

import type { QueryClient } from "@tanstack/react-query"
import {
  createPromotionsClientOptions,
  getPromotionsListQueryOptions,
  type PromotionalOfferApplicationMode,
  type PromotionalOfferListStatus,
  type PromotionalOfferRecord,
  type PromotionalOfferScope,
  type PromotionalOfferScopeKind,
  type PromotionsClientOptions,
  type PromotionsListQuery,
  usePromotionsList,
} from "@voyantjs/promotions-react"
import {
  Badge,
  Button,
  DateRangePicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components"
import { cn } from "@voyantjs/ui/lib/utils"
import { Plus, Search, X } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import { PromotionDialog } from "./promotion-dialog.js"

const DEFAULT_PAGE_SIZE = 25
const ALL = "__all__"
const TABLE_COLUMN_COUNT = 7

const scopeKinds: PromotionalOfferScopeKind[] = [
  "global",
  "products",
  "categories",
  "destinations",
  "markets",
  "audiences",
]

const applicationModes: PromotionalOfferApplicationMode[] = ["auto", "code"]
const statusFilters: PromotionalOfferListStatus[] = ["active", "scheduled", "expired", "archived"]

type DateRangeValue = {
  from: string | null
  to: string | null
}

export interface PromotionDialogRenderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  offer?: PromotionalOfferRecord
  onSuccess: () => void
}

export interface PromotionsPageProps {
  className?: string
  pageSize?: number
  onOpenPromotion?: (promotionId: string, promotion: PromotionalOfferRecord) => void
  renderPromotionDialog?: (props: PromotionDialogRenderProps) => ReactNode
}

export function loadPromotionsPage(
  queryClient: QueryClient,
  client?: Partial<PromotionsClientOptions>,
  query: PromotionsListQuery = {},
) {
  return queryClient.ensureQueryData(
    getPromotionsListQueryOptions(
      { limit: DEFAULT_PAGE_SIZE, offset: 0, ...query },
      createPromotionsClientOptions(client),
    ),
  )
}

export function PromotionsPage({
  className,
  pageSize = DEFAULT_PAGE_SIZE,
  onOpenPromotion,
  renderPromotionDialog,
}: PromotionsPageProps = {}) {
  const [search, setSearch] = useState("")
  const [applicationMode, setApplicationMode] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [scopeKind, setScopeKind] = useState<string>(ALL)
  const [validityRange, setValidityRange] = useState<DateRangeValue | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingOffer, setEditingOffer] = useState<PromotionalOfferRecord | undefined>()

  const query: PromotionsListQuery = {
    search: search || undefined,
    applicationMode:
      applicationMode === ALL ? undefined : (applicationMode as PromotionalOfferApplicationMode),
    status: status === ALL ? undefined : (status as PromotionalOfferListStatus),
    scopeKind: scopeKind === ALL ? undefined : (scopeKind as PromotionalOfferScopeKind),
    validFrom: validityRange?.from ?? undefined,
    validUntil: validityRange?.to ?? undefined,
    limit: pageSize,
    offset: pageIndex * pageSize,
  }

  const { data, isPending, isFetching, isError, error, refetch } = usePromotionsList(query)

  const offers = data?.data ?? []
  const total = data?.total ?? 0
  const page = pageIndex + 1
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const showSkeleton = isPending || (isFetching && offers.length === 0)
  const hasActiveFilters =
    search !== "" ||
    applicationMode !== ALL ||
    status !== ALL ||
    scopeKind !== ALL ||
    Boolean(validityRange?.from || validityRange?.to)

  const resetPage = () => setPageIndex(0)

  function openCreate() {
    setEditingOffer(undefined)
    setDialogOpen(true)
  }

  function openEdit(offer: PromotionalOfferRecord) {
    setEditingOffer(offer)
    setDialogOpen(true)
  }

  function openOffer(offer: PromotionalOfferRecord) {
    if (onOpenPromotion) {
      onOpenPromotion(offer.id, offer)
      return
    }
    openEdit(offer)
  }

  function clearFilters() {
    setSearch("")
    setApplicationMode(ALL)
    setStatus(ALL)
    setScopeKind(ALL)
    setValidityRange(null)
    resetPage()
  }

  const dialog = renderPromotionDialog ? (
    renderPromotionDialog({
      open: dialogOpen,
      onOpenChange: setDialogOpen,
      offer: editingOffer,
      onSuccess: () => {
        setDialogOpen(false)
        resetPage()
        void refetch()
      },
    })
  ) : (
    <PromotionDialog open={dialogOpen} onOpenChange={setDialogOpen} offer={editingOffer} />
  )

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Auto-applied catalog discounts and code-redeemed offers.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" aria-hidden="true" />
          New promotion
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] max-w-sm flex-1">
          <Label htmlFor="promotions-search" className="sr-only">
            Search promotions
          </Label>
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="promotions-search"
            placeholder="Search name, slug, description, or code"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              resetPage()
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={applicationMode}
          onValueChange={(value) => {
            setApplicationMode(value ?? ALL)
            resetPage()
          }}
        >
          <SelectTrigger className="w-[10.5rem]">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All modes</SelectItem>
            {applicationModes.map((mode) => (
              <SelectItem key={mode} value={mode}>
                {applicationModeLabel(mode)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value ?? ALL)
            resetPage()
          }}
        >
          <SelectTrigger className="w-[10.5rem]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statusFilters.map((value) => (
              <SelectItem key={value} value={value}>
                {statusLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={scopeKind}
          onValueChange={(value) => {
            setScopeKind(value ?? ALL)
            resetPage()
          }}
        >
          <SelectTrigger className="w-[11rem]">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All scopes</SelectItem>
            {scopeKinds.map((value) => (
              <SelectItem key={value} value={value}>
                {scopeKindLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangePicker
          value={validityRange}
          onChange={(value) => {
            setValidityRange(value)
            resetPage()
          }}
          placeholder="Validity range"
          className="w-[15rem]"
        />

        {hasActiveFilters ? (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="mr-2 size-4" aria-hidden="true" />
            Clear
          </Button>
        ) : null}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Validity</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <PromotionRowSkeleton rows={6} />
            ) : isError ? (
              <TableRow>
                <TableCell
                  colSpan={TABLE_COLUMN_COUNT}
                  className="h-24 text-center text-sm text-destructive"
                >
                  Failed to load: {error instanceof Error ? error.message : String(error)}
                </TableCell>
              </TableRow>
            ) : offers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={TABLE_COLUMN_COUNT}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No promotions match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              offers.map((offer) => (
                <TableRow
                  key={offer.id}
                  className="cursor-pointer"
                  onClick={() => openOffer(offer)}
                >
                  <TableCell>
                    <div className="font-medium">{offer.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{offer.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={offer.code == null ? "secondary" : "outline"}>
                      {offer.code == null ? "Auto" : "Code"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {summarizeScope(offer.scope)}
                  </TableCell>
                  <TableCell>{summarizeDiscount(offer)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {summarizeValidity(offer.validFrom, offer.validUntil)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{offer.code ?? "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusBadgeVariant(getOfferStatus(offer))}>
                        {statusLabel(getOfferStatus(offer))}
                      </Badge>
                      {offer.stackable ? <Badge variant="secondary">Stackable</Badge> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationBar
        shown={offers.length}
        total={total}
        page={page}
        pageCount={pageCount}
        onPrevious={() => setPageIndex((prev) => Math.max(0, prev - 1))}
        onNext={() => setPageIndex((prev) => prev + 1)}
        canGoBack={pageIndex > 0}
        canGoForward={(pageIndex + 1) * pageSize < total}
      />

      {dialog}
    </div>
  )
}

function PaginationBar({
  shown,
  total,
  page,
  pageCount,
  onPrevious,
  onNext,
  canGoBack,
  canGoForward,
}: {
  shown: number
  total: number
  page: number
  pageCount: number
  onPrevious: () => void
  onNext: () => void
  canGoBack: boolean
  canGoForward: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Showing {shown} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!canGoBack} onClick={onPrevious}>
          Previous
        </Button>
        <span>
          Page {page} of {pageCount}
        </span>
        <Button variant="outline" size="sm" disabled={!canGoForward} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  )
}

function PromotionRowSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are stable
        <TableRow key={`promotion-skeleton-${index}`}>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

function summarizeScope(scope: PromotionalOfferScope): string {
  switch (scope.kind) {
    case "global":
      return "Global"
    case "products":
      return `${scope.productIds.length} product${scope.productIds.length === 1 ? "" : "s"}`
    case "categories":
      return `${scope.categoryIds.length} categor${scope.categoryIds.length === 1 ? "y" : "ies"}`
    case "destinations":
      return `${scope.destinationIds.length} destination${scope.destinationIds.length === 1 ? "" : "s"}`
    case "markets":
      return `Markets: ${scope.marketIds.join(", ")}`
    case "audiences":
      return `Audiences: ${scope.audiences.join(", ")}`
  }
}

function summarizeDiscount(offer: PromotionalOfferRecord): string {
  if (offer.discountType === "percentage") {
    return `${offer.discountPercent ?? "?"}%`
  }
  const cents = offer.discountAmountCents ?? 0
  const currency = offer.currency ?? ""
  return `${(cents / 100).toFixed(2)} ${currency}`.trim()
}

function summarizeValidity(from: string | null, until: string | null): string {
  if (from == null && until == null) return "Anytime"
  const fmt = (iso: string) => iso.slice(0, 10)
  if (from == null) return `Until ${fmt(until ?? "")}`
  if (until == null) return `From ${fmt(from)}`
  return `${fmt(from)} - ${fmt(until)}`
}

function getOfferStatus(offer: PromotionalOfferRecord): PromotionalOfferListStatus {
  if (!offer.active) return "archived"
  const now = Date.now()
  if (offer.validFrom != null && new Date(offer.validFrom).getTime() > now) return "scheduled"
  if (offer.validUntil != null && new Date(offer.validUntil).getTime() < now) return "expired"
  return "active"
}

function statusBadgeVariant(
  status: PromotionalOfferListStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default"
    case "scheduled":
      return "secondary"
    case "expired":
      return "destructive"
    case "archived":
      return "outline"
  }
}

function applicationModeLabel(mode: PromotionalOfferApplicationMode): string {
  return mode === "auto" ? "Auto-applied" : "Code-redeemed"
}

function statusLabel(status: PromotionalOfferListStatus): string {
  switch (status) {
    case "active":
      return "Active"
    case "scheduled":
      return "Scheduled"
    case "expired":
      return "Expired"
    case "archived":
      return "Archived"
  }
}

function scopeKindLabel(scopeKind: PromotionalOfferScopeKind): string {
  switch (scopeKind) {
    case "global":
      return "Global"
    case "products":
      return "Products"
    case "categories":
      return "Categories"
    case "destinations":
      return "Destinations"
    case "markets":
      return "Markets"
    case "audiences":
      return "Audiences"
  }
}
