"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { RowSelectionState } from "@tanstack/react-table"
import {
  type AvailabilityCloseoutRow,
  type AvailabilityPickupPointRow,
  type AvailabilityRuleRow,
  type AvailabilitySlotRow,
  type AvailabilityStartTimeRow,
  availabilityQueryKeys,
  type CreateAvailabilityRuleInput,
  type CreateAvailabilitySlotInput,
  type CreateAvailabilityStartTimeInput,
  type ProductOption,
  type UpdateAvailabilityRuleInput,
  type UpdateAvailabilitySlotInput,
  type UpdateAvailabilityStartTimeInput,
  useAvailabilityRuleMutation,
  useAvailabilitySlotMutation,
  useAvailabilityStartTimeMutation,
  useCloseouts,
  usePickupPoints,
  useProducts,
  useRules,
  useSlots,
  useStartTimes,
} from "@voyantjs/availability-react"
import { Button, cn, Label } from "@voyantjs/ui/components"
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import {
  CalendarProvider,
  CalendarView,
  type IEvent,
  type TCalendarView,
} from "@voyantjs/ui/components/big-calendar"
import { DateRangePicker, type DateRangeValue } from "@voyantjs/ui/components/date-picker"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import type { ReactNode } from "react"
import { useState } from "react"

import { useAvailabilityUiMessagesOrDefault } from "../i18n/index.js"
import {
  AvailabilityCloseoutDialog,
  type AvailabilityCloseoutSubmitPayload,
  AvailabilityPickupPointDialog,
  type AvailabilityPickupPointSubmitPayload,
  AvailabilityRuleDialog,
  type AvailabilityRuleSubmitPayload,
  AvailabilitySlotDialog,
  type AvailabilitySlotSubmitPayload,
  AvailabilityStartTimeDialog,
  type AvailabilityStartTimeSubmitPayload,
} from "./availability-dialogs.js"
import { AvailabilityOverview } from "./availability-overview.js"
import { AvailabilityBodySkeleton } from "./availability-skeletons.js"
import {
  type AvailabilityBulkDeleteFn,
  type AvailabilityBulkUpdateFn,
  AvailabilityCloseoutsTab,
  AvailabilityPickupPointsTab,
  AvailabilityRulesTab,
  AvailabilitySlotsTab,
  AvailabilityStartTimesTab,
} from "./availability-tabs.js"

export type AvailabilityPageTab =
  | "slots"
  | "rules"
  | "start-times"
  | "closeouts"
  | "pickup-points"
  | "calendar"

export type AvailabilityPageActiveFilter = "all" | "active" | "inactive"
export type AvailabilityPageSlotStatusFilter = "all" | AvailabilitySlotRow["status"]

export type AvailabilityPageBulkUpdateHandler = AvailabilityBulkUpdateFn
export type AvailabilityPageBulkDeleteHandler = AvailabilityBulkDeleteFn

type DialogSubmitContext = { isEditing: boolean; id?: string }

export type AvailabilityPageRuleSubmitHandler = (
  payload: AvailabilityRuleSubmitPayload,
  context: DialogSubmitContext,
) => Promise<void> // i18n-literal-ok type annotation

export type AvailabilityPageStartTimeSubmitHandler = (
  payload: AvailabilityStartTimeSubmitPayload,
  context: DialogSubmitContext,
) => Promise<void> // i18n-literal-ok type annotation

export type AvailabilityPageSlotSubmitHandler = (
  payload: AvailabilitySlotSubmitPayload,
  context: DialogSubmitContext,
) => Promise<void> // i18n-literal-ok type annotation

export type AvailabilityPageCloseoutSubmitHandler = (
  payload: AvailabilityCloseoutSubmitPayload,
  context: DialogSubmitContext,
) => Promise<void> // i18n-literal-ok type annotation

export type AvailabilityPagePickupPointSubmitHandler = (
  payload: AvailabilityPickupPointSubmitPayload,
  context: DialogSubmitContext,
) => Promise<void> // i18n-literal-ok type annotation

export interface AvailabilityPageSlots {
  headerEnd?: ReactNode
  beforeOverview?: ReactNode
  afterOverview?: ReactNode
  beforeTabs?: ReactNode
  afterTabs?: ReactNode
  dialogs?: ReactNode
}

export interface AvailabilityPageProps {
  className?: string
  defaultTab?: AvailabilityPageTab
  bulkActionTarget?: string | null
  onBulkUpdate: AvailabilityPageBulkUpdateHandler
  onBulkDelete: AvailabilityPageBulkDeleteHandler
  onSlotOpen?: (slotId: string) => void
  onRuleOpen?: (ruleId: string) => void
  onStartTimeOpen?: (startTimeId: string) => void
  onProductOpen?: (productId: string) => void
  onCloseoutCreate?: () => void
  onCloseoutEdit?: (closeout: AvailabilityCloseoutRow) => void
  onPickupPointCreate?: () => void
  onPickupPointEdit?: (pickupPoint: AvailabilityPickupPointRow) => void
  onRuleSubmit?: AvailabilityPageRuleSubmitHandler
  onStartTimeSubmit?: AvailabilityPageStartTimeSubmitHandler
  onSlotSubmit?: AvailabilityPageSlotSubmitHandler
  onCloseoutSubmit?: AvailabilityPageCloseoutSubmitHandler
  onPickupPointSubmit?: AvailabilityPagePickupPointSubmitHandler
  slots?: AvailabilityPageSlots
}

const noop = () => undefined
const noopId = (_id: string) => undefined
const noopCloseout = (_row: AvailabilityCloseoutRow) => undefined
const noopPickupPoint = (_row: AvailabilityPickupPointRow) => undefined

export function AvailabilityPage({
  className,
  defaultTab = "slots",
  bulkActionTarget = null,
  onBulkUpdate,
  onBulkDelete,
  onSlotOpen = noopId,
  onRuleOpen = noopId,
  onStartTimeOpen = noopId,
  onProductOpen = noopId,
  onCloseoutCreate = noop,
  onCloseoutEdit = noopCloseout,
  onPickupPointCreate = noop,
  onPickupPointEdit = noopPickupPoint,
  onRuleSubmit,
  onStartTimeSubmit,
  onSlotSubmit,
  onCloseoutSubmit,
  onPickupPointSubmit,
  slots: pageSlots,
}: AvailabilityPageProps) {
  const messages = useAvailabilityUiMessagesOrDefault()
  const page = messages.page
  const queryClient = useQueryClient()
  const ruleMutation = useAvailabilityRuleMutation()
  const startTimeMutation = useAvailabilityStartTimeMutation()
  const slotMutation = useAvailabilitySlotMutation()
  const [productFilter, setProductFilter] = useState("all")
  const [productSearch, setProductSearch] = useState("")
  const [slotStatusFilter, setSlotStatusFilter] = useState<AvailabilityPageSlotStatusFilter>("all")
  const [slotDateRange, setSlotDateRange] = useState<DateRangeValue | null>(null)
  const [ruleActiveFilter, setRuleActiveFilter] = useState<AvailabilityPageActiveFilter>("all")
  const [startTimeActiveFilter, setStartTimeActiveFilter] =
    useState<AvailabilityPageActiveFilter>("all")
  const [closeoutDateRange, setCloseoutDateRange] = useState<DateRangeValue | null>(null)
  const [pickupPointActiveFilter, setPickupPointActiveFilter] =
    useState<AvailabilityPageActiveFilter>("all")
  const [activeTab, setActiveTab] = useState<AvailabilityPageTab>(defaultTab)
  const [calendarView, setCalendarView] = useState<TCalendarView>("month")
  const [ruleSelection, setRuleSelection] = useState<RowSelectionState>({})
  const [startTimeSelection, setStartTimeSelection] = useState<RowSelectionState>({})
  const [slotSelection, setSlotSelection] = useState<RowSelectionState>({})
  const [closeoutSelection, setCloseoutSelection] = useState<RowSelectionState>({})
  const [pickupPointSelection, setPickupPointSelection] = useState<RowSelectionState>({})
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [startTimeDialogOpen, setStartTimeDialogOpen] = useState(false)
  const [slotDialogOpen, setSlotDialogOpen] = useState(false)
  const [closeoutDialogOpen, setCloseoutDialogOpen] = useState(false)
  const [pickupPointDialogOpen, setPickupPointDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AvailabilityRuleRow | undefined>()
  const [editingStartTime, setEditingStartTime] = useState<AvailabilityStartTimeRow | undefined>()
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlotRow | undefined>()
  const [editingCloseout, setEditingCloseout] = useState<AvailabilityCloseoutRow | undefined>()
  const [editingPickupPoint, setEditingPickupPoint] = useState<
    AvailabilityPickupPointRow | undefined
  >()

  const productsQuery = useProducts({ search: productSearch || undefined, limit: 25, offset: 0 })
  const rulesQuery = useRules({ limit: 25, offset: 0 })
  const startTimesQuery = useStartTimes({ limit: 25, offset: 0 })
  const slotsQuery = useSlots({ limit: 25, offset: 0 })
  const closeoutsQuery = useCloseouts({ limit: 25, offset: 0 })
  const pickupPointsQuery = usePickupPoints({ limit: 25, offset: 0 })

  const products = productsQuery.data?.data ?? []
  const rules = rulesQuery.data?.data ?? []
  const startTimes = startTimesQuery.data?.data ?? []
  const availabilitySlots = slotsQuery.data?.data ?? []
  const closeouts = closeoutsQuery.data?.data ?? []
  const pickupPoints = pickupPointsQuery.data?.data ?? []

  const matchesProduct = (productId: string) =>
    productFilter === "all" || productId === productFilter
  const matchesActive = (active: boolean, filter: AvailabilityPageActiveFilter) =>
    filter === "all" || (filter === "active" ? active : !active)
  const matchesDateRange = (date: string, range: DateRangeValue | null) =>
    (!range?.from || date >= range.from) && (!range?.to || date <= range.to) // i18n-literal-ok comparison expression

  const filteredRules = rules.filter(
    (rule) => matchesProduct(rule.productId) && matchesActive(rule.active, ruleActiveFilter),
  )
  const filteredStartTimes = startTimes.filter(
    (startTime) =>
      matchesProduct(startTime.productId) && matchesActive(startTime.active, startTimeActiveFilter),
  )
  const productFilteredSlots = availabilitySlots.filter((slot) => matchesProduct(slot.productId))
  const filteredSlots = productFilteredSlots.filter(
    (slot) =>
      (slotStatusFilter === "all" || slot.status === slotStatusFilter) &&
      matchesDateRange(slot.dateLocal, slotDateRange),
  )
  const filteredCloseouts = closeouts.filter(
    (closeout) =>
      matchesProduct(closeout.productId) && matchesDateRange(closeout.dateLocal, closeoutDateRange),
  )
  const filteredPickupPoints = pickupPoints.filter(
    (pickupPoint) =>
      matchesProduct(pickupPoint.productId) &&
      matchesActive(pickupPoint.active, pickupPointActiveFilter),
  )
  const filteredProducts = products.filter(
    (product) => productFilter === "all" || product.id === productFilter,
  )
  const constrainedSlots = [...filteredSlots]
    .filter((slot) => slot.status === "sold_out" || slot.status === "closed")
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
  const nowIso = new Date().toISOString()
  const productsWithoutUpcomingDepartures = filteredProducts.filter(
    (product) =>
      !productFilteredSlots.some(
        (slot) =>
          slot.productId === product.id && slot.status === "open" && slot.startsAt >= nowIso,
      ),
  )
  const hasFilters = productFilter !== "all"
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
      title: productName ?? slot.productName ?? messages.tabs.slots.title,
      description: slot.notes ?? "",
      color: slotStatusToColor[slot.status],
    }
  })

  const queries = [
    productsQuery,
    rulesQuery,
    startTimesQuery,
    slotsQuery,
    closeoutsQuery,
    pickupPointsQuery,
  ]
  const isLoading = queries.some((query) => query.isPending)
  const isError = queries.some((query) => query.isError)

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.all })
  }

  const handleRuleSubmit: AvailabilityPageRuleSubmitHandler =
    onRuleSubmit ??
    (async (payload, context) => {
      if (context.isEditing) {
        await ruleMutation.update.mutateAsync({
          id: requireEditingId(context),
          input: payload as UpdateAvailabilityRuleInput,
        })
        return
      }

      await ruleMutation.create.mutateAsync(payload as CreateAvailabilityRuleInput)
    })

  const handleStartTimeSubmit: AvailabilityPageStartTimeSubmitHandler =
    onStartTimeSubmit ??
    (async (payload, context) => {
      if (context.isEditing) {
        await startTimeMutation.update.mutateAsync({
          id: requireEditingId(context),
          input: payload as UpdateAvailabilityStartTimeInput,
        })
        return
      }

      await startTimeMutation.create.mutateAsync(payload as CreateAvailabilityStartTimeInput)
    })

  const handleSlotSubmit: AvailabilityPageSlotSubmitHandler =
    onSlotSubmit ??
    (async (payload, context) => {
      if (context.isEditing) {
        await slotMutation.update.mutateAsync({
          id: requireEditingId(context),
          input: payload as UpdateAvailabilitySlotInput,
        })
        return
      }

      await slotMutation.create.mutateAsync(payload as CreateAvailabilitySlotInput)
    })

  const closeRuleDialog = () => {
    setRuleDialogOpen(false)
    setEditingRule(undefined)
  }
  const closeStartTimeDialog = () => {
    setStartTimeDialogOpen(false)
    setEditingStartTime(undefined)
  }
  const closeSlotDialog = () => {
    setSlotDialogOpen(false)
    setEditingSlot(undefined)
  }
  const closeCloseoutDialog = () => {
    setCloseoutDialogOpen(false)
    setEditingCloseout(undefined)
  }
  const closePickupPointDialog = () => {
    setPickupPointDialogOpen(false)
    setEditingPickupPoint(undefined)
  }

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{messages.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.description}</p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-72">
          <AsyncCombobox<ProductOption>
            value={productFilter === "all" ? null : productFilter}
            onChange={(value) => setProductFilter(value ?? "all")}
            items={products}
            selectedItem={selectedProduct}
            getKey={(product) => product.id}
            getLabel={(product) => product.name}
            onSearchChange={setProductSearch}
            placeholder={messages.allProducts}
            emptyText={productsQuery.isFetching ? page.loading : page.filters.productSearchEmpty}
            triggerClassName="w-full"
          />
          {pageSlots?.headerEnd}
        </div>
      </div>

      {isLoading ? (
        <AvailabilityBodySkeleton />
      ) : isError ? (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">{page.loadFailed}</div>
      ) : (
        <>
          {pageSlots?.beforeOverview}
          <AvailabilityOverview
            messages={messages}
            products={products}
            constrainedSlots={constrainedSlots}
            openSlotsCount={filteredSlots.filter((slot) => slot.status === "open").length}
            filteredRules={filteredRules}
            filteredPickupPoints={filteredPickupPoints}
            productsWithoutUpcomingDepartures={productsWithoutUpcomingDepartures}
            search=""
            setSearch={() => {}}
            productFilter={productFilter}
            setProductFilter={setProductFilter}
            hasFilters={hasFilters}
            onClearFilters={() => setProductFilter("all")}
            onOpenSlot={onSlotOpen}
            onOpenProduct={onProductOpen}
            onJumpToSlots={() => setActiveTab("slots")}
            showFilters={false}
          />
          {pageSlots?.afterOverview}
          {pageSlots?.beforeTabs}

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab((value ?? "slots") as AvailabilityPageTab)}
          >
            <TabsList className="flex w-full justify-start overflow-x-auto">
              <TabsTrigger value="slots">{messages.tabSlots}</TabsTrigger>
              <TabsTrigger value="rules">{messages.tabRules}</TabsTrigger>
              <TabsTrigger value="start-times">{messages.tabStartTimes}</TabsTrigger>
              <TabsTrigger value="closeouts">{messages.tabCloseouts}</TabsTrigger>
              <TabsTrigger value="pickup-points">{messages.tabPickupPoints}</TabsTrigger>
              <TabsTrigger value="calendar">{page.calendarTab}</TabsTrigger>
            </TabsList>

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
              toolbar={
                <SlotsToolbar
                  value={slotStatusFilter}
                  onValueChange={setSlotStatusFilter}
                  dateRange={slotDateRange}
                  onDateRangeChange={setSlotDateRange}
                />
              }
            />
            <AvailabilityRulesTab
              messages={messages}
              products={products}
              filteredRules={filteredRules}
              ruleSelection={ruleSelection}
              setRuleSelection={setRuleSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={onBulkUpdate}
              handleBulkDelete={onBulkDelete}
              onCreate={() => {
                setEditingRule(undefined)
                setRuleDialogOpen(true)
              }}
              onOpenRoute={onRuleOpen}
              onEdit={(row) => {
                setEditingRule(row)
                setRuleDialogOpen(true)
              }}
              toolbar={
                <ActiveToolbar value={ruleActiveFilter} onValueChange={setRuleActiveFilter} />
              }
            />
            <AvailabilityStartTimesTab
              messages={messages}
              products={products}
              filteredStartTimes={filteredStartTimes}
              startTimeSelection={startTimeSelection}
              setStartTimeSelection={setStartTimeSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={onBulkUpdate}
              handleBulkDelete={onBulkDelete}
              onCreate={() => {
                setEditingStartTime(undefined)
                setStartTimeDialogOpen(true)
              }}
              onOpenRoute={onStartTimeOpen}
              onEdit={(row) => {
                setEditingStartTime(row)
                setStartTimeDialogOpen(true)
              }}
              toolbar={
                <ActiveToolbar
                  value={startTimeActiveFilter}
                  onValueChange={setStartTimeActiveFilter}
                />
              }
            />
            <AvailabilityCloseoutsTab
              messages={messages}
              products={products}
              filteredCloseouts={filteredCloseouts}
              closeoutSelection={closeoutSelection}
              setCloseoutSelection={setCloseoutSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkDelete={onBulkDelete}
              onCreate={
                onCloseoutSubmit
                  ? () => {
                      setEditingCloseout(undefined)
                      setCloseoutDialogOpen(true)
                    }
                  : onCloseoutCreate
              }
              onEdit={(row) => {
                if (onCloseoutSubmit) {
                  setEditingCloseout(row)
                  setCloseoutDialogOpen(true)
                  return
                }

                onCloseoutEdit(row)
              }}
              toolbar={
                <DateRangeToolbar value={closeoutDateRange} onValueChange={setCloseoutDateRange} />
              }
            />
            <AvailabilityPickupPointsTab
              messages={messages}
              products={products}
              filteredPickupPoints={filteredPickupPoints}
              pickupPointSelection={pickupPointSelection}
              setPickupPointSelection={setPickupPointSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={onBulkUpdate}
              handleBulkDelete={onBulkDelete}
              onCreate={
                onPickupPointSubmit
                  ? () => {
                      setEditingPickupPoint(undefined)
                      setPickupPointDialogOpen(true)
                    }
                  : onPickupPointCreate
              }
              onEdit={(row) => {
                if (onPickupPointSubmit) {
                  setEditingPickupPoint(row)
                  setPickupPointDialogOpen(true)
                  return
                }

                onPickupPointEdit(row)
              }}
              toolbar={
                <ActiveToolbar
                  value={pickupPointActiveFilter}
                  onValueChange={setPickupPointActiveFilter}
                />
              }
            />
            <TabsContent value="calendar" className="flex flex-col gap-4">
              <CalendarProvider
                events={calendarEvents}
                onEventClick={(event) => onSlotOpen(event.id)}
              >
                <CalendarView
                  view={calendarView}
                  onViewChange={setCalendarView}
                  onDayClick={() => setCalendarView("day")}
                />
              </CalendarProvider>
            </TabsContent>
          </Tabs>
          {pageSlots?.afterTabs}
        </>
      )}

      <AvailabilityRuleDialog
        messages={messages}
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        rule={editingRule}
        products={products}
        onSubmit={handleRuleSubmit}
        onSuccess={() => {
          closeRuleDialog()
          void refreshAll()
        }}
      />
      <AvailabilityStartTimeDialog
        messages={messages}
        open={startTimeDialogOpen}
        onOpenChange={setStartTimeDialogOpen}
        startTime={editingStartTime}
        products={products}
        onSubmit={handleStartTimeSubmit}
        onSuccess={() => {
          closeStartTimeDialog()
          void refreshAll()
        }}
      />
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
      {onCloseoutSubmit ? (
        <AvailabilityCloseoutDialog
          messages={messages}
          open={closeoutDialogOpen}
          onOpenChange={setCloseoutDialogOpen}
          closeout={editingCloseout}
          products={products}
          slots={availabilitySlots}
          onSubmit={onCloseoutSubmit}
          onSuccess={() => {
            closeCloseoutDialog()
            void refreshAll()
          }}
        />
      ) : null}
      {onPickupPointSubmit ? (
        <AvailabilityPickupPointDialog
          messages={messages}
          open={pickupPointDialogOpen}
          onOpenChange={setPickupPointDialogOpen}
          pickupPoint={editingPickupPoint}
          products={products}
          onSubmit={onPickupPointSubmit}
          onSuccess={() => {
            closePickupPointDialog()
            void refreshAll()
          }}
        />
      ) : null}
      {pageSlots?.dialogs}
    </div>
  )
}

function requireEditingId(context: DialogSubmitContext) {
  if (!context.id) throw new Error("AvailabilityPage edit submit requires an id.")
  return context.id
}

function SlotsToolbar({
  value,
  onValueChange,
  dateRange,
  onDateRangeChange,
}: {
  value: AvailabilityPageSlotStatusFilter
  onValueChange: (value: AvailabilityPageSlotStatusFilter) => void
  dateRange: DateRangeValue | null
  onDateRangeChange: (value: DateRangeValue | null) => void
}) {
  const messages = useAvailabilityUiMessagesOrDefault()
  const page = messages.page
  const hasFilters = value !== "all" || Boolean(dateRange?.from) || Boolean(dateRange?.to)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="availability-slot-status" className="text-xs">
          {page.filters.statusLabel}
        </Label>
        <Select
          value={value}
          onValueChange={(nextValue) =>
            onValueChange((nextValue ?? "all") as AvailabilityPageSlotStatusFilter)
          }
        >
          <SelectTrigger id="availability-slot-status" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{page.filters.allStatuses}</SelectItem>
              <SelectItem value="open">{messages.statusOpen}</SelectItem>
              <SelectItem value="closed">{messages.statusClosed}</SelectItem>
              <SelectItem value="sold_out">{messages.statusSoldOut}</SelectItem>
              <SelectItem value="cancelled">{messages.statusCancelled}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{page.filters.dateRangeLabel}</Label>
        <DateRangePicker
          value={dateRange}
          onChange={onDateRangeChange}
          className="w-full sm:w-72"
          placeholder={page.filters.anyDate}
        />
      </div>
      {hasFilters ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onValueChange("all")
            onDateRangeChange(null)
          }}
        >
          {page.filters.reset}
        </Button>
      ) : null}
    </div>
  )
}

function DateRangeToolbar({
  value,
  onValueChange,
}: {
  value: DateRangeValue | null
  onValueChange: (value: DateRangeValue | null) => void
}) {
  const page = useAvailabilityUiMessagesOrDefault().page
  const hasFilters = Boolean(value?.from) || Boolean(value?.to)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{page.filters.dateRangeLabel}</Label>
        <DateRangePicker
          value={value}
          onChange={onValueChange}
          className="w-full sm:w-72"
          placeholder={page.filters.anyDate}
        />
      </div>
      {hasFilters ? (
        <Button variant="outline" size="sm" onClick={() => onValueChange(null)}>
          {page.filters.reset}
        </Button>
      ) : null}
    </div>
  )
}

function ActiveToolbar({
  value,
  onValueChange,
}: {
  value: AvailabilityPageActiveFilter
  onValueChange: (value: AvailabilityPageActiveFilter) => void
}) {
  const page = useAvailabilityUiMessagesOrDefault().page

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="availability-active-filter" className="text-xs">
          {page.filters.stateLabel}
        </Label>
        <Select
          value={value}
          onValueChange={(nextValue) =>
            onValueChange((nextValue ?? "all") as AvailabilityPageActiveFilter)
          }
        >
          <SelectTrigger id="availability-active-filter" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{page.filters.allStates}</SelectItem>
              <SelectItem value="active">{page.filters.active}</SelectItem>
              <SelectItem value="inactive">{page.filters.inactive}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {value !== "all" ? (
        <Button variant="outline" size="sm" onClick={() => onValueChange("all")}>
          {page.filters.reset}
        </Button>
      ) : null}
    </div>
  )
}
