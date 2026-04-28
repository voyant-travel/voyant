import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { RowSelectionState } from "@tanstack/react-table"
import { Tabs, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "@/lib/api-client"
import {
  AvailabilityCloseoutDialog,
  AvailabilityPickupPointDialog,
  AvailabilityRuleDialog,
  AvailabilitySlotDialog,
  AvailabilityStartTimeDialog,
} from "./availability-dialogs"
import { AvailabilityOverview } from "./availability-overview"
import type {
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  AvailabilityRuleRow,
  AvailabilitySlotRow,
  AvailabilityStartTimeRow,
  BatchMutationResponse,
} from "./availability-shared"
import {
  formatSelectionLabel,
  getAvailabilityCloseoutsQueryOptions,
  getAvailabilityPickupPointsQueryOptions,
  getAvailabilityProductsQueryOptions,
  getAvailabilityRulesQueryOptions,
  getAvailabilitySlotsQueryOptions,
  getAvailabilityStartTimesQueryOptions,
  productNameById,
} from "./availability-shared"
import {
  AvailabilityRulesTab,
  AvailabilitySlotsTab,
  AvailabilityStartTimesTab,
} from "./availability-tabs-primary"
import {
  AvailabilityCloseoutsTab,
  AvailabilityPickupPointsTab,
} from "./availability-tabs-secondary"

export function AvailabilityPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [productFilter, setProductFilter] = useState("all")
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

  const productsQuery = useQuery(getAvailabilityProductsQueryOptions())
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
  const normalizedSearch = search.trim().toLowerCase()
  const matchesSearch = (...values: Array<string | number | null | undefined>) =>
    !normalizedSearch ||
    values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedSearch),
    )
  const matchesProduct = (productId: string) =>
    productFilter === "all" || productId === productFilter

  const filteredRules = rules.filter(
    (rule) =>
      matchesProduct(rule.productId) &&
      matchesSearch(
        productNameById(products, rule.productId, rule.productName),
        rule.timezone,
        rule.recurrenceRule,
      ),
  )
  const filteredStartTimes = startTimes.filter(
    (startTime) =>
      matchesProduct(startTime.productId) &&
      matchesSearch(
        productNameById(products, startTime.productId, startTime.productName),
        startTime.label,
        startTime.startTimeLocal,
      ),
  )
  const filteredSlots = slots.filter(
    (slot) =>
      matchesProduct(slot.productId) &&
      matchesSearch(
        productNameById(products, slot.productId, slot.productName),
        slot.dateLocal,
        slot.startsAt,
        slot.status,
        slot.notes,
      ),
  )
  const filteredCloseouts = closeouts.filter(
    (closeout) =>
      matchesProduct(closeout.productId) &&
      matchesSearch(
        productNameById(products, closeout.productId, closeout.productName),
        closeout.dateLocal,
        closeout.slotId,
        closeout.reason,
        closeout.createdBy,
      ),
  )
  const filteredPickupPoints = pickupPoints.filter(
    (pickupPoint) =>
      matchesProduct(pickupPoint.productId) &&
      matchesSearch(
        productNameById(products, pickupPoint.productId, pickupPoint.productName),
        pickupPoint.name,
        pickupPoint.locationText,
        pickupPoint.description,
      ),
  )
  const filteredProducts = products.filter(
    (product) => productFilter === "all" || product.id === productFilter,
  )
  const constrainedSlots = [...filteredSlots]
    .filter((slot) => slot.status === "sold_out" || slot.status === "closed")
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
  const productsWithoutActiveRules = filteredProducts.filter(
    (product) => !filteredRules.some((rule) => rule.productId === product.id && rule.active),
  )
  const hasFilters = search.length > 0 || productFilter !== "all"

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
    noun,
    payload,
    successVerb,
    clearSelection,
  }: {
    ids: string[]
    endpoint: string
    target: string
    noun: string
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

    if (result.failed.length === 0) {
      toast.success(`${successVerb} ${formatSelectionLabel(result.succeeded, noun)}.`)
      return
    }

    toast.error(
      `${successVerb} ${result.succeeded} of ${formatSelectionLabel(result.total, noun)}.`,
    )
  }

  const handleBulkDelete = async ({
    ids,
    endpoint,
    target,
    noun,
    clearSelection,
  }: {
    ids: string[]
    endpoint: string
    target: string
    noun: string
    clearSelection: () => void
  }) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    const result = await api.post<BatchMutationResponse>(`${endpoint}/batch-delete`, { ids })

    await refreshAll()
    clearSelection()
    setBulkActionTarget(null)

    if (result.failed.length === 0) {
      toast.success(`Deleted ${formatSelectionLabel(result.succeeded, noun)}.`)
      return
    }

    toast.error(`Deleted ${result.succeeded} of ${formatSelectionLabel(result.total, noun)}.`)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Availability</h1>
        <p className="text-sm text-muted-foreground">
          Manage recurrence rules, departures, closeouts, and pickup capacity.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <AvailabilityOverview
            products={products}
            constrainedSlots={constrainedSlots}
            filteredRules={filteredRules}
            filteredPickupPoints={filteredPickupPoints}
            productsWithoutActiveRules={productsWithoutActiveRules}
            search={search}
            setSearch={setSearch}
            productFilter={productFilter}
            setProductFilter={setProductFilter}
            hasFilters={hasFilters}
            onClearFilters={() => {
              setSearch("")
              setProductFilter("all")
            }}
            onOpenSlot={(slotId) =>
              void navigate({ to: "/availability/$id", params: { id: slotId } })
            }
            onOpenProduct={(productId) =>
              void navigate({ to: "/products/$id", params: { id: productId } })
            }
          />

          <Tabs defaultValue="slots">
            <TabsList variant="line">
              <TabsTrigger value="slots">Slots</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
              <TabsTrigger value="start-times">Start Times</TabsTrigger>
              <TabsTrigger value="closeouts">Closeouts</TabsTrigger>
              <TabsTrigger value="pickup-points">Pickup Points</TabsTrigger>
            </TabsList>

            <AvailabilitySlotsTab
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
            />
            <AvailabilityRulesTab
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
            />
            <AvailabilityStartTimesTab
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
            />
            <AvailabilityCloseoutsTab
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
            />
            <AvailabilityPickupPointsTab
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
            />
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
