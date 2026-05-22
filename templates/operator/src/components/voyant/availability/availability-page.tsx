import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { RowSelectionState } from "@tanstack/react-table"
import { formatMessage } from "@voyantjs/admin"
import {
  AvailabilityBodySkeleton,
  AvailabilityCloseoutsTab,
  AvailabilityOverview,
  AvailabilityPickupPointsTab,
  AvailabilityRulesTab,
  AvailabilitySlotsTab,
  AvailabilityStartTimesTab,
} from "@voyantjs/availability-ui"
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import {
  CalendarProvider,
  CalendarView,
  type IEvent,
  type TCalendarView,
} from "@voyantjs/ui/components/big-calendar"
import { Button } from "@voyantjs/ui/components/button"
import { DateRangePicker, type DateRangeValue } from "@voyantjs/ui/components/date-picker"
import { Label } from "@voyantjs/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { useState } from "react"
import { toast } from "sonner"
import type {
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  AvailabilityStartTimeRow,
  BatchMutationResponse,
} from "@/components/voyant/availability/availability-shared"
import {
  formatLocalizedSelectionLabel,
  getAvailabilityCloseoutsQueryOptions,
  getAvailabilityPickupPointsQueryOptions,
  getAvailabilityProductsQueryOptions,
  getAvailabilityRulesQueryOptions,
  getAvailabilitySlotsQueryOptions,
  getAvailabilityStartTimesQueryOptions,
} from "@/components/voyant/availability/availability-shared"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import {
  AvailabilityCloseoutDialog,
  AvailabilityPickupPointDialog,
  AvailabilityRuleDialog,
  AvailabilitySlotDialog,
  AvailabilityStartTimeDialog,
} from "./availability-dialogs"

export function AvailabilityPage() {
  const messages = useAdminMessages()
  const navigate = useNavigate()
  const [productFilter, setProductFilter] = useState("all")
  const [productSearch, setProductSearch] = useState("")
  const [slotStatusFilter, setSlotStatusFilter] = useState<
    "all" | "open" | "closed" | "sold_out" | "cancelled"
  >("all")
  const [slotDateRange, setSlotDateRange] = useState<DateRangeValue | null>(null)
  const [ruleActiveFilter, setRuleActiveFilter] = useState<"all" | "active" | "inactive">("all")
  const [startTimeActiveFilter, setStartTimeActiveFilter] = useState<"all" | "active" | "inactive">(
    "all",
  )
  const [closeoutDateRange, setCloseoutDateRange] = useState<DateRangeValue | null>(null)
  const [pickupPointActiveFilter, setPickupPointActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all")
  const [activeTab, setActiveTab] = useState("slots")
  const [calendarView, setCalendarView] = useState<TCalendarView>("month")
  const [bulkActionTarget, setBulkActionTarget] = useState<string | null>(null)
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

  const productsQuery = useQuery(
    getAvailabilityProductsQueryOptions({ search: productSearch || undefined, limit: 25 }),
  )
  const rulesQuery = useQuery(getAvailabilityRulesQueryOptions())
  const startTimesQuery = useQuery(getAvailabilityStartTimesQueryOptions())
  const slotsQuery = useQuery(getAvailabilitySlotsQueryOptions())
  const closeoutsQuery = useQuery(getAvailabilityCloseoutsQueryOptions())
  const pickupPointsQuery = useQuery(getAvailabilityPickupPointsQueryOptions())

  const products = productsQuery.data?.data ?? []
  const rules = rulesQuery.data?.data ?? []
  const startTimes = startTimesQuery.data?.data ?? []
  const slots = slotsQuery.data?.data ?? []
  const closeouts = closeoutsQuery.data?.data ?? []
  const pickupPoints = pickupPointsQuery.data?.data ?? []
  const matchesProduct = (productId: string) =>
    productFilter === "all" || productId === productFilter
  const matchesActive = (active: boolean, filter: "all" | "active" | "inactive") =>
    filter === "all" || (filter === "active" ? active : !active)
  const matchesDateRange = (date: string, range: DateRangeValue | null) =>
    (!range?.from || date >= range.from) && (!range?.to || date <= range.to)

  const filteredRules = rules.filter(
    (rule) => matchesProduct(rule.productId) && matchesActive(rule.active, ruleActiveFilter),
  )
  const filteredStartTimes = startTimes.filter(
    (startTime) =>
      matchesProduct(startTime.productId) && matchesActive(startTime.active, startTimeActiveFilter),
  )
  const productFilteredSlots = slots.filter((slot) => matchesProduct(slot.productId))
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
      title: productName ?? slot.productName ?? messages.availability.slotFallbackTitle,
      description: slot.notes ?? "",
      color: slotStatusToColor[slot.status],
    }
  })

  const slotsToolbarHasFilters =
    slotStatusFilter !== "all" || Boolean(slotDateRange?.from) || Boolean(slotDateRange?.to)
  const toolbar = messages.availability.toolbar
  const slotsToolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slot-status" className="text-xs">
          {messages.availability.statusLabel}
        </Label>
        <Select
          value={slotStatusFilter}
          onValueChange={(value) =>
            setSlotStatusFilter((value as typeof slotStatusFilter) ?? "all")
          }
        >
          <SelectTrigger id="slot-status" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{toolbar.statusAll}</SelectItem>
            <SelectItem value="open">{messages.availability.statusOpen}</SelectItem>
            <SelectItem value="closed">{messages.availability.statusClosed}</SelectItem>
            <SelectItem value="sold_out">{messages.availability.statusSoldOut}</SelectItem>
            <SelectItem value="cancelled">{messages.availability.statusCancelled}</SelectItem>
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
      {slotsToolbarHasFilters ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSlotStatusFilter("all")
            setSlotDateRange(null)
          }}
        >
          {toolbar.reset}
        </Button>
      ) : null}
    </div>
  )

  const rulesToolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rule-active" className="text-xs">
          {toolbar.stateLabel}
        </Label>
        <Select
          value={ruleActiveFilter}
          onValueChange={(value) =>
            setRuleActiveFilter((value as typeof ruleActiveFilter) ?? "all")
          }
        >
          <SelectTrigger id="rule-active" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{toolbar.stateAll}</SelectItem>
            <SelectItem value="active">{messages.availability.statusActive}</SelectItem>
            <SelectItem value="inactive">{messages.availability.statusInactive}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {ruleActiveFilter !== "all" ? (
        <Button variant="outline" size="sm" onClick={() => setRuleActiveFilter("all")}>
          {toolbar.reset}
        </Button>
      ) : null}
    </div>
  )

  const startTimesToolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start-time-active" className="text-xs">
          {toolbar.stateLabel}
        </Label>
        <Select
          value={startTimeActiveFilter}
          onValueChange={(value) =>
            setStartTimeActiveFilter((value as typeof startTimeActiveFilter) ?? "all")
          }
        >
          <SelectTrigger id="start-time-active" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{toolbar.stateAll}</SelectItem>
            <SelectItem value="active">{messages.availability.statusActive}</SelectItem>
            <SelectItem value="inactive">{messages.availability.statusInactive}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {startTimeActiveFilter !== "all" ? (
        <Button variant="outline" size="sm" onClick={() => setStartTimeActiveFilter("all")}>
          {toolbar.reset}
        </Button>
      ) : null}
    </div>
  )

  const closeoutsToolbarHasFilters =
    Boolean(closeoutDateRange?.from) || Boolean(closeoutDateRange?.to)
  const closeoutsToolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{toolbar.dateRangeLabel}</Label>
        <DateRangePicker
          value={closeoutDateRange}
          onChange={setCloseoutDateRange}
          className="w-full sm:w-72"
          placeholder={toolbar.dateRangePlaceholder}
        />
      </div>
      {closeoutsToolbarHasFilters ? (
        <Button variant="outline" size="sm" onClick={() => setCloseoutDateRange(null)}>
          {toolbar.reset}
        </Button>
      ) : null}
    </div>
  )

  const pickupPointsToolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pickup-point-active" className="text-xs">
          {toolbar.stateLabel}
        </Label>
        <Select
          value={pickupPointActiveFilter}
          onValueChange={(value) =>
            setPickupPointActiveFilter((value as typeof pickupPointActiveFilter) ?? "all")
          }
        >
          <SelectTrigger id="pickup-point-active" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{toolbar.stateAll}</SelectItem>
            <SelectItem value="active">{messages.availability.statusActive}</SelectItem>
            <SelectItem value="inactive">{messages.availability.statusInactive}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {pickupPointActiveFilter !== "all" ? (
        <Button variant="outline" size="sm" onClick={() => setPickupPointActiveFilter("all")}>
          {toolbar.reset}
        </Button>
      ) : null}
    </div>
  )

  const refreshAll = async () => {
    await Promise.all([
      rulesQuery.refetch(),
      startTimesQuery.refetch(),
      slotsQuery.refetch(),
      closeoutsQuery.refetch(),
      pickupPointsQuery.refetch(),
    ])
  }

  const isLoading =
    productsQuery.isPending ||
    rulesQuery.isPending ||
    startTimesQuery.isPending ||
    slotsQuery.isPending ||
    closeoutsQuery.isPending ||
    pickupPointsQuery.isPending

  const handleBulkUpdate = async ({
    ids,
    endpoint,
    target,
    nounSingular,
    nounPlural,
    payload,
    successVerb,
    clearSelection,
  }: {
    ids: string[]
    endpoint: string
    target: string
    nounSingular: string
    nounPlural: string
    payload: Record<string, unknown>
    successVerb: string
    clearSelection: () => void
  }) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    const result = await api.post<BatchMutationResponse>(`${endpoint}/batch-update`, {
      ids,
      patch: payload,
    })

    await refreshAll()
    clearSelection()
    setBulkActionTarget(null)

    const succeededSelection = formatLocalizedSelectionLabel(
      result.succeeded,
      nounSingular,
      nounPlural,
    )
    const totalSelection = formatLocalizedSelectionLabel(result.total, nounSingular, nounPlural)

    if (result.failed.length === 0) {
      toast.success(
        formatMessage(messages.availability.toasts.bulkUpdated, {
          verb: successVerb,
          selection: succeededSelection,
        }),
      )
      return
    }

    toast.error(
      formatMessage(messages.availability.toasts.bulkUpdatedPartial, {
        verb: successVerb,
        succeeded: result.succeeded,
        selection: totalSelection,
      }),
    )
  }

  const handleBulkDelete = async ({
    ids,
    endpoint,
    target,
    nounSingular,
    nounPlural,
    clearSelection,
  }: {
    ids: string[]
    endpoint: string
    target: string
    nounSingular: string
    nounPlural: string
    clearSelection: () => void
  }) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    const result = await api.post<BatchMutationResponse>(`${endpoint}/batch-delete`, { ids })

    await refreshAll()
    clearSelection()
    setBulkActionTarget(null)

    const succeededSelection = formatLocalizedSelectionLabel(
      result.succeeded,
      nounSingular,
      nounPlural,
    )
    const totalSelection = formatLocalizedSelectionLabel(result.total, nounSingular, nounPlural)

    if (result.failed.length === 0) {
      toast.success(
        formatMessage(messages.availability.toasts.bulkDeleted, {
          selection: succeededSelection,
        }),
      )
      return
    }

    toast.error(
      formatMessage(messages.availability.toasts.bulkDeletedPartial, {
        succeeded: result.succeeded,
        selection: totalSelection,
      }),
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{messages.availability.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.availability.description}</p>
        </div>
        <div className="w-full md:w-72">
          <AsyncCombobox
            value={productFilter === "all" ? null : productFilter}
            onChange={(value) => setProductFilter(value ?? "all")}
            items={products}
            selectedItem={selectedProduct}
            getKey={(product) => product.id}
            getLabel={(product) => product.name}
            onSearchChange={setProductSearch}
            placeholder={messages.availability.allProducts}
            emptyText={
              productsQuery.isFetching
                ? messages.availability.productsComboboxSearching
                : messages.availability.productsComboboxEmpty
            }
            triggerClassName="w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <AvailabilityBodySkeleton />
      ) : (
        <>
          <AvailabilityOverview
            messages={messages.availability}
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
            onClearFilters={() => {
              setProductFilter("all")
            }}
            onOpenSlot={(slotId) =>
              void navigate({ to: "/availability/$id", params: { id: slotId } })
            }
            onOpenProduct={(productId) =>
              void navigate({ to: "/products/$id", params: { id: productId } })
            }
            onJumpToSlots={() => setActiveTab("slots")}
            showFilters={false}
          />

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value ?? "slots")}>
            <TabsList>
              <TabsTrigger value="slots">{messages.availability.tabSlots}</TabsTrigger>
              <TabsTrigger value="rules">{messages.availability.tabRules}</TabsTrigger>
              <TabsTrigger value="start-times">{messages.availability.tabStartTimes}</TabsTrigger>
              <TabsTrigger value="closeouts">{messages.availability.tabCloseouts}</TabsTrigger>
              <TabsTrigger value="pickup-points">
                {messages.availability.tabPickupPoints}
              </TabsTrigger>
              <TabsTrigger value="calendar">{messages.availability.tabCalendar}</TabsTrigger>
            </TabsList>

            <AvailabilitySlotsTab
              messages={messages.availability}
              products={products}
              filteredSlots={filteredSlots}
              slotSelection={slotSelection}
              setSlotSelection={setSlotSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingSlot(undefined)
                setSlotDialogOpen(true)
              }}
              onOpenRoute={(slotId) =>
                void navigate({ to: "/availability/$id", params: { id: slotId } })
              }
              onEdit={(row) => {
                setEditingSlot(row)
                setSlotDialogOpen(true)
              }}
              toolbar={slotsToolbar}
            />
            <AvailabilityRulesTab
              messages={messages.availability}
              products={products}
              filteredRules={filteredRules}
              ruleSelection={ruleSelection}
              setRuleSelection={setRuleSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingRule(undefined)
                setRuleDialogOpen(true)
              }}
              onOpenRoute={(ruleId) =>
                void navigate({ to: "/availability/rules/$id", params: { id: ruleId } })
              }
              onEdit={(row) => {
                setEditingRule(row)
                setRuleDialogOpen(true)
              }}
              toolbar={rulesToolbar}
            />
            <AvailabilityStartTimesTab
              messages={messages.availability}
              products={products}
              filteredStartTimes={filteredStartTimes}
              startTimeSelection={startTimeSelection}
              setStartTimeSelection={setStartTimeSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingStartTime(undefined)
                setStartTimeDialogOpen(true)
              }}
              onOpenRoute={(startTimeId) =>
                void navigate({ to: "/availability/start-times/$id", params: { id: startTimeId } })
              }
              onEdit={(row) => {
                setEditingStartTime(row)
                setStartTimeDialogOpen(true)
              }}
              toolbar={startTimesToolbar}
            />
            <AvailabilityCloseoutsTab
              messages={messages.availability}
              products={products}
              filteredCloseouts={filteredCloseouts}
              closeoutSelection={closeoutSelection}
              setCloseoutSelection={setCloseoutSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingCloseout(undefined)
                setCloseoutDialogOpen(true)
              }}
              onEdit={(row) => {
                setEditingCloseout(row)
                setCloseoutDialogOpen(true)
              }}
              toolbar={closeoutsToolbar}
            />
            <AvailabilityPickupPointsTab
              messages={messages.availability}
              products={products}
              filteredPickupPoints={filteredPickupPoints}
              pickupPointSelection={pickupPointSelection}
              setPickupPointSelection={setPickupPointSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingPickupPoint(undefined)
                setPickupPointDialogOpen(true)
              }}
              onEdit={(row) => {
                setEditingPickupPoint(row)
                setPickupPointDialogOpen(true)
              }}
              toolbar={pickupPointsToolbar}
            />
            <TabsContent value="calendar" className="space-y-4">
              <CalendarProvider
                events={calendarEvents}
                onEventClick={(event) =>
                  void navigate({ to: "/availability/$id", params: { id: event.id } })
                }
              >
                <CalendarView
                  view={calendarView}
                  onViewChange={setCalendarView}
                  onDayClick={() => setCalendarView("day")}
                />
              </CalendarProvider>
            </TabsContent>
          </Tabs>
        </>
      )}

      <AvailabilityRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        rule={editingRule}
        products={products}
        onSuccess={() => {
          setRuleDialogOpen(false)
          setEditingRule(undefined)
          void refreshAll()
        }}
      />
      <AvailabilityStartTimeDialog
        open={startTimeDialogOpen}
        onOpenChange={setStartTimeDialogOpen}
        startTime={editingStartTime}
        products={products}
        onSuccess={() => {
          setStartTimeDialogOpen(false)
          setEditingStartTime(undefined)
          void refreshAll()
        }}
      />
      <AvailabilitySlotDialog
        open={slotDialogOpen}
        onOpenChange={setSlotDialogOpen}
        slot={editingSlot}
        products={products}
        rules={rules}
        startTimes={startTimes}
        onSuccess={() => {
          setSlotDialogOpen(false)
          setEditingSlot(undefined)
          void refreshAll()
        }}
      />
      <AvailabilityCloseoutDialog
        open={closeoutDialogOpen}
        onOpenChange={setCloseoutDialogOpen}
        closeout={editingCloseout}
        products={products}
        slots={slots}
        onSuccess={() => {
          setCloseoutDialogOpen(false)
          setEditingCloseout(undefined)
          void refreshAll()
        }}
      />
      <AvailabilityPickupPointDialog
        open={pickupPointDialogOpen}
        onOpenChange={setPickupPointDialogOpen}
        pickupPoint={editingPickupPoint}
        products={products}
        onSuccess={() => {
          setPickupPointDialogOpen(false)
          setEditingPickupPoint(undefined)
          void refreshAll()
        }}
      />
    </div>
  )
}
