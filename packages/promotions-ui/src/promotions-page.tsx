"use client"

/**
 * Operator-facing promotions list page.
 *
 * Lists every promotional offer with server-backed search, filters, pagination,
 * and optional row navigation for apps that expose a dedicated detail route.
 */

import type { QueryClient } from "@tanstack/react-query"
import { formatMessage } from "@voyantjs/i18n"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
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
import { ListFilter, Plus, Search, X } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import type { PromotionsUiMessages } from "./i18n/messages.js"
import { usePromotionsUiMessagesOrDefault } from "./i18n/provider.js"
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
  "fare_codes",
  "cabin_grades",
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
  const messages = usePromotionsUiMessagesOrDefault()
  const pageMessages = messages.promotionsPage
  const [search, setSearch] = useState("")
  const [applicationMode, setApplicationMode] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [scopeKind, setScopeKind] = useState<string>(ALL)
  const [validityRange, setValidityRange] = useState<DateRangeValue | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingOffer, setEditingOffer] = useState<PromotionalOfferRecord | undefined>()
  const [filtersOpen, setFiltersOpen] = useState(false)

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
  const activeFilterCount =
    (applicationMode !== ALL ? 1 : 0) +
    (status !== ALL ? 1 : 0) +
    (scopeKind !== ALL ? 1 : 0) +
    (validityRange?.from || validityRange?.to ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0 || search !== ""

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Label htmlFor="promotions-search" className="sr-only">
            {pageMessages.searchLabel}
          </Label>
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="promotions-search"
            placeholder={pageMessages.searchPlaceholder}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              resetPage()
            }}
            className="pl-9"
          />
        </div>

        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" size="default">
                <ListFilter className="mr-2 size-4" />
                {pageMessages.filtersButton}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1.5">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-[22rem] p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promotions-filter-mode">{pageMessages.modePlaceholder}</Label>
                <Select
                  value={applicationMode}
                  onValueChange={(value) => {
                    setApplicationMode(value ?? ALL)
                    resetPage()
                  }}
                >
                  <SelectTrigger id="promotions-filter-mode" className="w-full">
                    <SelectValue>
                      {(value) =>
                        value === ALL
                          ? pageMessages.allModes
                          : (messages.common.applicationModeLabels[
                              value as PromotionalOfferApplicationMode
                            ] ?? value)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{pageMessages.allModes}</SelectItem>
                    {applicationModes.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {messages.common.applicationModeLabels[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promotions-filter-status">{pageMessages.statusPlaceholder}</Label>
                <Select
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value ?? ALL)
                    resetPage()
                  }}
                >
                  <SelectTrigger id="promotions-filter-status" className="w-full">
                    <SelectValue>
                      {(value) =>
                        value === ALL
                          ? pageMessages.allStatuses
                          : (messages.common.statusLabels[value as PromotionalOfferListStatus] ??
                            value)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{pageMessages.allStatuses}</SelectItem>
                    {statusFilters.map((value) => (
                      <SelectItem key={value} value={value}>
                        {messages.common.statusLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promotions-filter-scope">{pageMessages.scopePlaceholder}</Label>
                <Select
                  value={scopeKind}
                  onValueChange={(value) => {
                    setScopeKind(value ?? ALL)
                    resetPage()
                  }}
                >
                  <SelectTrigger id="promotions-filter-scope" className="w-full">
                    <SelectValue>
                      {(value) =>
                        value === ALL
                          ? pageMessages.allScopes
                          : (messages.common.scopeKindLabels[value as PromotionalOfferScopeKind] ??
                            value)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{pageMessages.allScopes}</SelectItem>
                    {scopeKinds.map((value) => (
                      <SelectItem key={value} value={value}>
                        {messages.common.scopeKindLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promotions-filter-validity">
                  {pageMessages.validityRangePlaceholder}
                </Label>
                <DateRangePicker
                  value={validityRange}
                  onChange={(value) => {
                    setValidityRange(value)
                    resetPage()
                  }}
                  placeholder={pageMessages.validityRangePlaceholder}
                  className="w-full"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 size-4" aria-hidden="true" />
            {pageMessages.clearFilters}
          </Button>
        ) : null}

        <div className="ml-auto">
          <Button onClick={openCreate}>
            <Plus className="mr-1 size-4" aria-hidden="true" />
            {pageMessages.newPromotion}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{pageMessages.columns.name}</TableHead>
              <TableHead>{pageMessages.columns.mode}</TableHead>
              <TableHead>{pageMessages.columns.scope}</TableHead>
              <TableHead>{pageMessages.columns.discount}</TableHead>
              <TableHead>{pageMessages.columns.validity}</TableHead>
              <TableHead>{pageMessages.columns.code}</TableHead>
              <TableHead>{pageMessages.columns.status}</TableHead>
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
                  {formatMessage(pageMessages.loadFailedPrefix, {
                    message: error instanceof Error ? error.message : String(error),
                  })}
                </TableCell>
              </TableRow>
            ) : offers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={TABLE_COLUMN_COUNT}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {pageMessages.empty}
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
                      {offer.code == null ? pageMessages.badges.auto : pageMessages.badges.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {summarizeScope(offer.scope, messages)}
                  </TableCell>
                  <TableCell>{summarizeDiscount(offer, pageMessages)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {summarizeValidity(offer.validFrom, offer.validUntil, pageMessages)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {offer.code ?? pageMessages.summaries.noCode}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusBadgeVariant(getOfferStatus(offer))}>
                        {messages.common.statusLabels[getOfferStatus(offer)]}
                      </Badge>
                      {offer.stackable ? (
                        <Badge variant="secondary">{pageMessages.badges.stackable}</Badge>
                      ) : null}
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
        messages={pageMessages.pagination}
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
  messages,
}: {
  shown: number
  total: number
  page: number
  pageCount: number
  onPrevious: () => void
  onNext: () => void
  canGoBack: boolean
  canGoForward: boolean
  messages: PromotionsUiMessages["promotionsPage"]["pagination"]
}) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {formatMessage(messages.showing, {
          shown,
          total,
        })}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!canGoBack} onClick={onPrevious}>
          {messages.previous}
        </Button>
        <span>
          {formatMessage(messages.page, {
            page,
            pageCount,
          })}
        </span>
        <Button variant="outline" size="sm" disabled={!canGoForward} onClick={onNext}>
          {messages.next}
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

function summarizeScope(scope: PromotionalOfferScope, messages: PromotionsUiMessages): string {
  const summary = messages.promotionsPage.summaries
  switch (scope.kind) {
    case "global":
      return summary.globalScope
    case "products":
      return formatMessage(summary.productsScope, {
        count: scope.productIds.length,
        noun:
          scope.productIds.length === 1
            ? summary.productNouns.singular
            : summary.productNouns.plural,
      })
    case "categories":
      return formatMessage(summary.categoriesScope, {
        count: scope.categoryIds.length,
        noun:
          scope.categoryIds.length === 1
            ? summary.categoryNouns.singular
            : summary.categoryNouns.plural,
      })
    case "destinations":
      return formatMessage(summary.destinationsScope, {
        count: scope.destinationIds.length,
        noun:
          scope.destinationIds.length === 1
            ? summary.destinationNouns.singular
            : summary.destinationNouns.plural,
      })
    case "markets":
      return formatMessage(summary.marketsScope, {
        markets: scope.marketIds.join(", "),
      })
    case "audiences":
      return formatMessage(summary.audiencesScope, {
        audiences: scope.audiences
          .map((audience) => messages.common.audienceLabels[audience])
          .join(", "),
      })
    case "fare_codes":
      return formatMessage(summary.fareCodesScope, {
        fareCodes: scope.fareCodes.join(", "),
      })
    case "cabin_grades":
      return formatMessage(summary.cabinGradesScope, {
        cabinGradeCodes: scope.cabinGradeCodes.join(", "),
      })
  }
}

function summarizeDiscount(
  offer: PromotionalOfferRecord,
  messages: PromotionsUiMessages["promotionsPage"],
): string {
  if (offer.discountType === "percentage") {
    return `${offer.discountPercent ?? messages.summaries.unknownPercentage}%`
  }
  const cents = offer.discountAmountCents ?? 0
  const currency = offer.currency ?? ""
  return `${(cents / 100).toFixed(2)} ${currency}`.trim()
}

function summarizeValidity(
  from: string | null,
  until: string | null,
  messages: PromotionsUiMessages["promotionsPage"],
): string {
  if (from == null && until == null) return messages.summaries.anytime
  const fmt = (iso: string) => iso.slice(0, 10)
  if (from == null) {
    return formatMessage(messages.summaries.until, {
      date: fmt(until ?? ""),
    })
  }
  if (until == null) {
    return formatMessage(messages.summaries.from, {
      date: fmt(from),
    })
  }
  return formatMessage(messages.summaries.range, {
    from: fmt(from),
    until: fmt(until),
  })
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
