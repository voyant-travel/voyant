import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { RowSelectionState } from "@tanstack/react-table"
import { formatMessage } from "@voyantjs/admin"
import { Tabs, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { Loader2 } from "lucide-react"
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
  productNameById,
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
import { AvailabilityOverview } from "./availability-overview"
import {
  AvailabilityRulesTab,
  AvailabilitySlotsTab,
  AvailabilityStartTimesTab,
} from "./availability-tabs-primary"
import {
  AvailabilityCloseoutsTab,
  AvailabilityPickupPointsTab,
} from "./availability-tabs-secondary"

export type AvailabilityPageTab = "slots" | "rules" | "start-times" | "closeouts" | "pickup-points"

export interface AvailabilityPageProps {
  /**
   * Product filter id. Pass `null` (or omit) for "all". When supplied
   * with `onProductFilterChange`, becomes a fully controlled prop —
   * the page reflects URL changes without remounting.
   */
  productId?: string | null
  /** Active tab. Defaults to `"slots"` when omitted. */
  tab?: AvailabilityPageTab
  /** Fires when the product filter changes. */
  onProductFilterChange?: (productId: string | null) => void
  /** Fires when the active tab changes. */
  onTabChange?: (tab: AvailabilityPageTab) => void
}

export function AvailabilityPage({
  productId: controlledProductId,
  tab: controlledTab,
  onProductFilterChange,
  onTabChange,
}: AvailabilityPageProps = {}) {
  const messages = useAdminMessages()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  // Filter + tab state can either be controlled by the host (URL-
  // backed routes) or owned internally for standalone mounts. Codex
  // flagged that a useState seed-from-prop pattern goes stale when
  // the URL changes without unmounting — keeping a single source of
  // truth per render avoids that drift.
  const [internalProductFilter, setInternalProductFilter] = useState<string>(
    controlledProductId ?? "all",
  )
  const [internalTab, setInternalTab] = useState<AvailabilityPageTab>(controlledTab ?? "slots")
  const isProductFilterControlled = onProductFilterChange != null
  const isTabControlled = onTabChange != null
  const productFilter = isProductFilterControlled
    ? (controlledProductId ?? "all")
    : internalProductFilter
  const activeTab = isTabControlled ? (controlledTab ?? "slots") : internalTab
  const setProductFilter = (next: string) => {
    if (!isProductFilterControlled) setInternalProductFilter(next)
    onProductFilterChange?.(next === "all" ? null : next)
  }
  const setActiveTab = (next: AvailabilityPageTab) => {
    if (!isTabControlled) setInternalTab(next)
    onTabChange?.(next)
  }
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

  const productIdFilter = productFilter === "all" ? undefined : productFilter

  const productsQuery = useQuery(getAvailabilityProductsQueryOptions())
  const rulesQuery = useQuery(getAvailabilityRulesQueryOptions(productIdFilter))
  const startTimesQuery = useQuery(getAvailabilityStartTimesQueryOptions(productIdFilter))
  const slotsQuery = useQuery(getAvailabilitySlotsQueryOptions(productIdFilter))
  const closeoutsQuery = useQuery(getAvailabilityCloseoutsQueryOptions(productIdFilter))
  const pickupPointsQuery = useQuery(getAvailabilityPickupPointsQueryOptions(productIdFilter))

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
  const nowIso = new Date().toISOString()
  const productsWithoutUpcomingDepartures = filteredProducts.filter(
    (product) =>
      !filteredSlots.some(
        (slot) =>
          slot.productId === product.id && slot.status === "open" && slot.startsAt >= nowIso,
      ),
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.availability.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.availability.description}</p>
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
            openSlotsCount={filteredSlots.filter((slot) => slot.status === "open").length}
            filteredRules={filteredRules}
            filteredPickupPoints={filteredPickupPoints}
            productsWithoutUpcomingDepartures={productsWithoutUpcomingDepartures}
            search={search}
            setSearch={setSearch}
            productFilter={productFilter}
            setProductFilter={setProductFilter}
            hasFilters={hasFilters}
            onClearFilters={() => {
              setSearch("")
              setProductFilter("all")
              setActiveTab("slots")
            }}
            onOpenSlot={(slotId) =>
              void navigate({ to: "/availability/$id", params: { id: slotId } })
            }
            onOpenProduct={(productId) =>
              void navigate({ to: "/products/$id", params: { id: productId } })
            }
          />

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as AvailabilityPageTab)}
          >
            <TabsList variant="line">
              <TabsTrigger value="slots">{messages.availability.tabSlots}</TabsTrigger>
              <TabsTrigger value="rules">{messages.availability.tabRules}</TabsTrigger>
              <TabsTrigger value="start-times">{messages.availability.tabStartTimes}</TabsTrigger>
              <TabsTrigger value="closeouts">{messages.availability.tabCloseouts}</TabsTrigger>
              <TabsTrigger value="pickup-points">
                {messages.availability.tabPickupPoints}
              </TabsTrigger>
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
