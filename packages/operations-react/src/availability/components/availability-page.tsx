"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { RowSelectionState } from "@tanstack/react-table"
import { Button, cn, Label } from "@voyant-travel/ui/components"
import { AsyncCombobox } from "@voyant-travel/ui/components/async-combobox"
import {
  CalendarProvider,
  CalendarView,
  type IEvent,
  type TCalendarView,
} from "@voyant-travel/ui/components/big-calendar"
import { DateRangePicker, type DateRangeValue } from "@voyant-travel/ui/components/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components/select"
import { ToggleGroup, ToggleGroupItem } from "@voyant-travel/ui/components/toggle-group"
import { CalendarDays, List, Plus } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { useAvailabilityUiMessagesOrDefault } from "../i18n/index.js"
import {
  type AvailabilitySlotRow,
  availabilityQueryKeys,
  type CreateAvailabilitySlotInput,
  type ProductOption,
  type UpdateAvailabilitySlotInput,
  useAvailabilitySlotMutation,
  useProducts,
  useRules,
  useSlots,
  useStartTimes,
} from "../index.js"
import {
  AvailabilitySlotDialog,
  type AvailabilitySlotSubmitPayload,
} from "./availability-dialogs.js"
import { AvailabilityBodySkeleton } from "./availability-skeletons.js"
import {
  type AvailabilityBulkDeleteFn,
  type AvailabilityBulkUpdateFn,
  AvailabilitySlotsTab,
} from "./availability-tabs.js"

export type AvailabilityPageView = "list" | "calendar"
export type AvailabilityPageSlotStatusFilter = "all" | AvailabilitySlotRow["status"]
export type AvailabilityPageBulkUpdateHandler = AvailabilityBulkUpdateFn
export type AvailabilityPageBulkDeleteHandler = AvailabilityBulkDeleteFn

type DialogSubmitContext = { isEditing: boolean; id?: string }

export type AvailabilityPageSlotSubmitHandler = (
  payload: AvailabilitySlotSubmitPayload,
  context: DialogSubmitContext,
) => Promise<void> // i18n-literal-ok type annotation

export interface AvailabilityPageSlots {
  headerEnd?: ReactNode
  beforeFilters?: ReactNode
  afterFilters?: ReactNode
  dialogs?: ReactNode
}

export interface AvailabilityPageProps {
  className?: string
  defaultView?: AvailabilityPageView
  bulkActionTarget?: string | null
  onBulkUpdate: AvailabilityPageBulkUpdateHandler
  onBulkDelete: AvailabilityPageBulkDeleteHandler
  onSlotOpen?: (slotId: string) => void
  onSlotSubmit?: AvailabilityPageSlotSubmitHandler
  slots?: AvailabilityPageSlots
}

const noopId = (_id: string) => undefined

export function AvailabilityPage({
  className,
  defaultView = "list",
  bulkActionTarget = null,
  onBulkUpdate,
  onBulkDelete,
  onSlotOpen = noopId,
  onSlotSubmit,
  slots: pageSlots,
}: AvailabilityPageProps) {
  const messages = useAvailabilityUiMessagesOrDefault()
  const toolbar = messages.toolbar
  const queryClient = useQueryClient()
  const slotMutation = useAvailabilitySlotMutation()

  const [productFilter, setProductFilter] = useState("all")
  const [productSearch, setProductSearch] = useState("")
  const [slotStatusFilter, setSlotStatusFilter] = useState<AvailabilityPageSlotStatusFilter>("all")
  const [slotDateRange, setSlotDateRange] = useState<DateRangeValue | null>(null)
  const [view, setView] = useState<AvailabilityPageView>(defaultView)
  const [calendarView, setCalendarView] = useState<TCalendarView>("month")
  const [slotSelection, setSlotSelection] = useState<RowSelectionState>({})
  const [slotDialogOpen, setSlotDialogOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlotRow | undefined>()

  const productIdFilter = productFilter === "all" ? undefined : productFilter
  const slotStatusFilterParam = slotStatusFilter === "all" ? undefined : slotStatusFilter

  const productsQuery = useProducts({ search: productSearch || undefined, limit: 25, offset: 0 })
  // Rules + start times back the slot create/edit dialog. Eager-load so the
  // dialog opens with full options the first time, but keep the queries cheap
  // (no filters). Slots query honors the page filters so server returns the
  // matching first page rather than a stale 25-row prefix.
  const rulesQuery = useRules({ limit: 25, offset: 0 })
  const startTimesQuery = useStartTimes({ limit: 25, offset: 0 })
  // Date range is filtered client-side via matchesDateRange. The server's
  // startsAtFrom expects an ISO datetime, but the date picker yields a
  // yyyy-MM-dd string — passing it through gets rejected by the validator.
  const slotsQuery = useSlots({
    limit: 25,
    offset: 0,
    productId: productIdFilter,
    status: slotStatusFilterParam,
  })

  const products = productsQuery.data?.data ?? []
  const rules = rulesQuery.data?.data ?? []
  const startTimes = startTimesQuery.data?.data ?? []
  const slots = slotsQuery.data?.data ?? []

  const matchesProduct = (productId: string) =>
    productFilter === "all" || productId === productFilter
  const matchesDateRange = (date: string, range: DateRangeValue | null) =>
    (!range?.from || date >= range.from) && (!range?.to || date <= range.to) // i18n-literal-ok comparison expression

  const productFilteredSlots = slots.filter((slot) => matchesProduct(slot.productId))
  const filteredSlots = productFilteredSlots.filter(
    (slot) =>
      (slotStatusFilter === "all" || slot.status === slotStatusFilter) &&
      matchesDateRange(slot.dateLocal, slotDateRange),
  )
  const selectedProduct = products.find((product) => product.id === productFilter) ?? null

  const slotStatusToColor: Record<AvailabilitySlotRow["status"], IEvent["color"]> = {
    open: "green",
    closed: "gray",
    sold_out: "red",
    cancelled: "yellow",
  }
  const calendarEvents: IEvent[] = filteredSlots.map((slot) => {
    const productName = products.find((product) => product.id === slot.productId)?.name
    return {
      id: slot.id,
      startDate: slot.startsAt,
      endDate: slot.endsAt ?? slot.startsAt,
      title: productName ?? slot.productName ?? messages.slotFallbackTitle,
      description: slot.notes ?? "",
      color: slotStatusToColor[slot.status],
    }
  })

  const filtersHaveValues =
    productFilter !== "all" ||
    slotStatusFilter !== "all" ||
    Boolean(slotDateRange?.from) ||
    Boolean(slotDateRange?.to)

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.all })
  }

  const handleSlotSubmit: AvailabilityPageSlotSubmitHandler =
    onSlotSubmit ??
    (async (payload, context) => {
      if (context.isEditing) {
        if (!context.id) throw new Error("AvailabilityPage slot edit requires an id.")
        await slotMutation.update.mutateAsync({
          id: context.id,
          input: payload as UpdateAvailabilitySlotInput,
        })
        return
      }
      await slotMutation.create.mutateAsync(payload as CreateAvailabilitySlotInput)
    })

  const closeSlotDialog = () => {
    setSlotDialogOpen(false)
    setEditingSlot(undefined)
  }

  const isLoading =
    productsQuery.isPending ||
    rulesQuery.isPending ||
    startTimesQuery.isPending ||
    slotsQuery.isPending

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{messages.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {pageSlots?.headerEnd}
          <Button
            onClick={() => {
              setEditingSlot(undefined)
              setSlotDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" />
            {messages.tabs.slots.actionLabel}
          </Button>
        </div>
      </div>

      {pageSlots?.beforeFilters}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="availability-product-filter" className="text-xs">
              {messages.productLabel}
            </Label>
            <AsyncCombobox<ProductOption>
              value={productFilter === "all" ? null : productFilter}
              onChange={(value) => setProductFilter(value ?? "all")}
              items={products}
              selectedItem={selectedProduct}
              getKey={(product) => product.id}
              getLabel={(product) => product.name}
              onSearchChange={setProductSearch}
              placeholder={messages.allProducts}
              emptyText={
                productsQuery.isFetching
                  ? messages.productsComboboxSearching
                  : messages.productsComboboxEmpty
              }
              triggerClassName="w-full sm:w-64"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="availability-slot-status" className="text-xs">
              {messages.statusLabel}
            </Label>
            <Select
              value={slotStatusFilter}
              onValueChange={(value) =>
                setSlotStatusFilter((value as AvailabilityPageSlotStatusFilter) ?? "all")
              }
            >
              <SelectTrigger id="availability-slot-status" className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{toolbar.statusAll}</SelectItem>
                <SelectItem value="open">{messages.statusOpen}</SelectItem>
                <SelectItem value="closed">{messages.statusClosed}</SelectItem>
                <SelectItem value="sold_out">{messages.statusSoldOut}</SelectItem>
                <SelectItem value="cancelled">{messages.statusCancelled}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{toolbar.dateRangeLabel}</Label>
            <DateRangePicker
              value={slotDateRange}
              onChange={setSlotDateRange}
              className="w-full sm:w-72"
              placeholder={toolbar.dateRangePlaceholder}
            />
          </div>
          {filtersHaveValues ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setProductFilter("all")
                setSlotStatusFilter("all")
                setSlotDateRange(null)
              }}
            >
              {toolbar.reset}
            </Button>
          ) : null}
        </div>
        <ToggleGroup
          value={[view]}
          onValueChange={(values) => {
            const next = values[values.length - 1]
            if (next === "list" || next === "calendar") setView(next)
          }}
          variant="outline"
          aria-label={messages.title}
        >
          <ToggleGroupItem value="list" aria-label={messages.tabSlots}>
            <List className="mr-2 size-4" />
            {messages.tabSlots}
          </ToggleGroupItem>
          <ToggleGroupItem value="calendar" aria-label={messages.tabCalendar}>
            <CalendarDays className="mr-2 size-4" />
            {messages.tabCalendar}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {pageSlots?.afterFilters}

      {isLoading ? (
        <AvailabilityBodySkeleton />
      ) : view === "list" ? (
        <AvailabilitySlotsTab
          messages={messages}
          products={products}
          filteredSlots={filteredSlots}
          slotSelection={slotSelection}
          setSlotSelection={setSlotSelection}
          bulkActionTarget={bulkActionTarget}
          handleBulkUpdate={onBulkUpdate}
          handleBulkDelete={onBulkDelete}
          onCreate={() => {
            setEditingSlot(undefined)
            setSlotDialogOpen(true)
          }}
          onOpenRoute={onSlotOpen}
          onEdit={(row) => {
            setEditingSlot(row)
            setSlotDialogOpen(true)
          }}
          hideHeader
          asPanel={false}
          hideBulkDelete
          bulkStatusSelect
        />
      ) : (
        <CalendarProvider events={calendarEvents} onEventClick={(event) => onSlotOpen(event.id)}>
          <CalendarView
            view={calendarView}
            onViewChange={setCalendarView}
            onDayClick={() => setCalendarView("day")}
          />
        </CalendarProvider>
      )}

      <AvailabilitySlotDialog
        messages={messages}
        open={slotDialogOpen}
        onOpenChange={setSlotDialogOpen}
        slot={editingSlot}
        products={products}
        rules={rules}
        startTimes={startTimes}
        onSubmit={handleSlotSubmit}
        onSuccess={() => {
          closeSlotDialog()
          void refreshAll()
        }}
      />

      {pageSlots?.dialogs}
    </div>
  )
}
