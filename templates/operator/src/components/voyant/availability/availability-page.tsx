import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { RowSelectionState } from "@tanstack/react-table"
import { formatMessage } from "@voyantjs/admin"
import { AvailabilityBodySkeleton, AvailabilitySlotsTab } from "@voyantjs/availability-ui"
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
import { ToggleGroup, ToggleGroupItem } from "@voyantjs/ui/components/toggle-group"
import { CalendarDays, List, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type {
  AvailabilitySlotRow,
  BatchMutationResponse,
} from "@/components/voyant/availability/availability-shared"
import {
  formatLocalizedSelectionLabel,
  getAvailabilityProductsQueryOptions,
  getAvailabilityRulesQueryOptions,
  getAvailabilitySlotsQueryOptions,
  getAvailabilityStartTimesQueryOptions,
} from "@/components/voyant/availability/availability-shared"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { AvailabilitySlotDialog } from "./availability-dialogs"

type AvailabilityView = "list" | "calendar"

export function AvailabilityPage() {
  const messages = useAdminMessages()
  const navigate = useNavigate()
  const [productFilter, setProductFilter] = useState("all")
  const [productSearch, setProductSearch] = useState("")
  const [slotStatusFilter, setSlotStatusFilter] = useState<
    "all" | "open" | "closed" | "sold_out" | "cancelled"
  >("all")
  const [slotDateRange, setSlotDateRange] = useState<DateRangeValue | null>(null)
  const [view, setView] = useState<AvailabilityView>("list")
  const [calendarView, setCalendarView] = useState<TCalendarView>("month")
  const [bulkActionTarget, setBulkActionTarget] = useState<string | null>(null)
  const [slotSelection, setSlotSelection] = useState<RowSelectionState>({})
  const [slotDialogOpen, setSlotDialogOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlotRow | undefined>()

  const productsQuery = useQuery(
    getAvailabilityProductsQueryOptions({ search: productSearch || undefined, limit: 25 }),
  )
  const rulesQuery = useQuery(getAvailabilityRulesQueryOptions())
  const startTimesQuery = useQuery(getAvailabilityStartTimesQueryOptions())
  const slotsQuery = useQuery(getAvailabilitySlotsQueryOptions())

  const products = productsQuery.data?.data ?? []
  const rules = rulesQuery.data?.data ?? []
  const startTimes = startTimesQuery.data?.data ?? []
  const slots = slotsQuery.data?.data ?? []
  const matchesProduct = (productId: string) =>
    productFilter === "all" || productId === productFilter
  const matchesDateRange = (date: string, range: DateRangeValue | null) =>
    (!range?.from || date >= range.from) && (!range?.to || date <= range.to)

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
      title: productName ?? slot.productName ?? messages.availability.slotFallbackTitle,
      description: slot.notes ?? "",
      color: slotStatusToColor[slot.status],
    }
  })

  const toolbar = messages.availability.toolbar
  const filtersHaveValues =
    productFilter !== "all" ||
    slotStatusFilter !== "all" ||
    Boolean(slotDateRange?.from) ||
    Boolean(slotDateRange?.to)
  const filtersBar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-filter" className="text-xs">
            {messages.availability.productLabel}
          </Label>
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
            triggerClassName="w-full sm:w-64"
          />
        </div>
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
        aria-label={messages.availability.title}
      >
        <ToggleGroupItem value="list" aria-label={messages.availability.tabSlots}>
          <List className="mr-2 size-4" />
          {messages.availability.tabSlots}
        </ToggleGroupItem>
        <ToggleGroupItem value="calendar" aria-label={messages.availability.tabCalendar}>
          <CalendarDays className="mr-2 size-4" />
          {messages.availability.tabCalendar}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )

  const refreshAll = async () => {
    await Promise.all([rulesQuery.refetch(), startTimesQuery.refetch(), slotsQuery.refetch()])
  }

  const isLoading =
    productsQuery.isPending ||
    rulesQuery.isPending ||
    startTimesQuery.isPending ||
    slotsQuery.isPending

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
        <Button
          onClick={() => {
            setEditingSlot(undefined)
            setSlotDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" />
          {messages.availability.tabs.slots.actionLabel}
        </Button>
      </div>

      {filtersBar}

      {isLoading ? (
        <AvailabilityBodySkeleton />
      ) : view === "list" ? (
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
          hideHeader
          asPanel={false}
          hideBulkDelete
          bulkStatusSelect
        />
      ) : (
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
      )}

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
    </div>
  )
}
