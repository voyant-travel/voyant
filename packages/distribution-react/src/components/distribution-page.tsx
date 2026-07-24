// agent-quality: file-size exception -- owner: distribution-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
import type { RowSelectionState } from "@tanstack/react-table"
import { Tabs, TabsList, TabsTrigger } from "@voyant-travel/ui/components/tabs"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useDistributionUiI18nOrDefault } from "../i18n/index.js"
import type { DistributionEntity } from "../i18n/messages.js"
import { formatDistributionCount, formatDistributionSummary } from "../i18n/utils.js"
import {
  useBookingLinks,
  useBookings,
  useChannels,
  useCommissionRules,
  useContracts,
  useMappings,
  useProducts,
  useSuppliers,
  useVoyantDistributionContext,
  useWebhookEvents,
} from "../index.js"
import { DistributionOverview } from "./distribution-overview.js"
import type {
  BatchMutationResponse,
  ChannelBookingLinkRow,
  ChannelCommissionRuleRow,
  ChannelContractRow,
  ChannelProductMappingRow,
  ChannelRow,
  ChannelWebhookEventRow,
} from "./distribution-shared.js"
import { labelById } from "./distribution-shared.js"
import {
  DistributionChannelsTab,
  DistributionCommissionsTab,
  DistributionContractsTab,
} from "./distribution-tabs-primary.js"
import {
  DistributionBookingLinksTab,
  DistributionMappingsTab,
  DistributionWebhooksTab,
} from "./distribution-tabs-secondary.js"

type BulkActionArgs = {
  ids: string[]
  endpoint: string
  target: string
  noun: DistributionEntity
  payload: Record<string, unknown>
  successVerb: string
  clearSelection: () => void
}

type BulkDeleteArgs = Omit<BulkActionArgs, "payload" | "successVerb">

export interface DistributionPageProps {
  className?: string
  onChannelOpen?: (channelId: string) => void
  onContractOpen?: (contractId: string) => void
  onCommissionRuleOpen?: (commissionRuleId: string) => void
  onMappingOpen?: (mappingId: string) => void
  onBookingLinkOpen?: (bookingLinkId: string) => void
  onWebhookEventOpen?: (webhookEventId: string) => void
  onChannelCreate?: () => void
  onContractCreate?: () => void
  onCommissionRuleCreate?: () => void
  onMappingCreate?: () => void
  onBookingLinkCreate?: () => void
  onWebhookEventCreate?: () => void
  onChannelEdit?: (channel: ChannelRow) => void
  onContractEdit?: (contract: ChannelContractRow) => void
  onCommissionRuleEdit?: (commissionRule: ChannelCommissionRuleRow) => void
  onMappingEdit?: (mapping: ChannelProductMappingRow) => void
  onBookingLinkEdit?: (bookingLink: ChannelBookingLinkRow) => void
  onWebhookEventEdit?: (webhookEvent: ChannelWebhookEventRow) => void
  onBulkSuccess?: (message: string, result: BatchMutationResponse) => void
  onBulkError?: (message: string, error: unknown, result?: BatchMutationResponse) => void
}

const noop = () => {}

export function DistributionPage({
  className,
  onChannelOpen = noop,
  onContractOpen = noop,
  onCommissionRuleOpen = noop,
  onMappingOpen = noop,
  onBookingLinkOpen = noop,
  onWebhookEventOpen = noop,
  onChannelCreate = noop,
  onContractCreate = noop,
  onCommissionRuleCreate = noop,
  onMappingCreate = noop,
  onBookingLinkCreate = noop,
  onWebhookEventCreate = noop,
  onChannelEdit = noop,
  onContractEdit = noop,
  onCommissionRuleEdit = noop,
  onMappingEdit = noop,
  onBookingLinkEdit = noop,
  onWebhookEventEdit = noop,
  onBulkSuccess,
  onBulkError,
}: DistributionPageProps = {}) {
  const client = useVoyantDistributionContext()
  const i18n = useDistributionUiI18nOrDefault()
  const { messages } = i18n
  const [search, setSearch] = useState("")
  const [channelFilter, setChannelFilter] = useState("all")
  const [bulkActionTarget, setBulkActionTarget] = useState<string | null>(null)
  const [channelSelection, setChannelSelection] = useState<RowSelectionState>({})
  const [contractSelection, setContractSelection] = useState<RowSelectionState>({})
  const [commissionSelection, setCommissionSelection] = useState<RowSelectionState>({})
  const [mappingSelection, setMappingSelection] = useState<RowSelectionState>({})
  const [bookingLinkSelection, setBookingLinkSelection] = useState<RowSelectionState>({})
  const [webhookSelection, setWebhookSelection] = useState<RowSelectionState>({})

  const suppliersQuery = useSuppliers()
  const productsQuery = useProducts()
  const bookingsQuery = useBookings()
  const channelsQuery = useChannels()
  const contractsQuery = useContracts()
  const commissionRulesQuery = useCommissionRules()
  const mappingsQuery = useMappings()
  const bookingLinksQuery = useBookingLinks()
  const webhookEventsQuery = useWebhookEvents()

  const suppliers = suppliersQuery.data?.data ?? []
  const products = productsQuery.data?.data ?? []
  const bookings = bookingsQuery.data?.data ?? []
  const channels = channelsQuery.data?.data ?? []
  const contracts = contractsQuery.data?.data ?? []
  const commissionRules = commissionRulesQuery.data?.data ?? []
  const mappings = mappingsQuery.data?.data ?? []
  const bookingLinks = bookingLinksQuery.data?.data ?? []
  const webhookEvents = webhookEventsQuery.data?.data ?? []
  const contractsById = new Map(contracts.map((contract) => [contract.id, contract]))
  const normalizedSearch = search.trim().toLowerCase()
  const matchesSearch = (...values: Array<string | number | null | undefined>) =>
    !normalizedSearch ||
    values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedSearch),
    )
  const matchesChannel = (id: string | null | undefined) =>
    channelFilter === "all" || id === channelFilter

  const filteredChannels = channels.filter(
    (channel) =>
      matchesChannel(channel.id) &&
      matchesSearch(
        channel.name,
        channel.kind,
        channel.status,
        channel.website,
        channel.contactName,
        channel.contactEmail,
      ),
  )
  const filteredContracts = contracts.filter(
    (contract) =>
      matchesChannel(contract.channelId) &&
      matchesSearch(
        labelById(channels, contract.channelId),
        labelById(suppliers, contract.supplierId),
        contract.status,
        contract.paymentOwner,
        contract.startsAt,
        contract.endsAt,
        contract.settlementTerms,
        contract.notes,
      ),
  )
  const filteredCommissionRules = commissionRules.filter((rule) => {
    const contract = contractsById.get(rule.contractId)
    return (
      matchesChannel(contract?.channelId) &&
      matchesSearch(
        rule.contractId,
        labelById(products, rule.productId),
        rule.scope,
        rule.commissionType,
        rule.amountCents,
        rule.percentBasisPoints,
        rule.externalRateId,
        rule.externalCategoryId,
      )
    )
  })
  const filteredMappings = mappings.filter(
    (mapping) =>
      matchesChannel(mapping.channelId) &&
      matchesSearch(
        labelById(channels, mapping.channelId),
        labelById(products, mapping.productId),
        mapping.externalProductId,
        mapping.externalRateId,
        mapping.externalCategoryId,
      ),
  )
  const filteredBookingLinks = bookingLinks.filter(
    (bookingLink) =>
      matchesChannel(bookingLink.channelId) &&
      matchesSearch(
        labelById(channels, bookingLink.channelId),
        labelById(bookings, bookingLink.bookingId),
        bookingLink.externalBookingId,
        bookingLink.externalReference,
        bookingLink.externalStatus,
      ),
  )
  const filteredWebhookEvents = webhookEvents.filter(
    (event) =>
      matchesChannel(event.channelId) &&
      matchesSearch(
        labelById(channels, event.channelId),
        event.eventType,
        event.externalEventId,
        event.status,
        event.errorMessage,
      ),
  )
  const syncQueue = filteredWebhookEvents.filter(
    (event) => event.status === "pending" || event.status === "failed",
  )
  const contractsNeedingReview = filteredContracts.filter(
    (contract) => contract.status !== "active",
  )
  const hasFilters = search.length > 0 || channelFilter !== "all"

  const isLoading =
    suppliersQuery.isPending ||
    productsQuery.isPending ||
    bookingsQuery.isPending ||
    channelsQuery.isPending ||
    contractsQuery.isPending ||
    commissionRulesQuery.isPending ||
    mappingsQuery.isPending ||
    bookingLinksQuery.isPending ||
    webhookEventsQuery.isPending

  const refreshAll = async () => {
    await Promise.all([
      channelsQuery.refetch(),
      contractsQuery.refetch(),
      commissionRulesQuery.refetch(),
      mappingsQuery.refetch(),
      bookingLinksQuery.refetch(),
      webhookEventsQuery.refetch(),
    ])
  }

  const handleBulkUpdate = async ({
    ids,
    endpoint,
    target,
    noun,
    payload,
    successVerb,
    clearSelection,
  }: BulkActionArgs) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    try {
      const result = await postBatch(client, `${endpoint}/batch-update`, {
        ids,
        patch: payload,
      })

      await refreshAll()
      clearSelection()

      const countLabel = formatDistributionCount(messages, noun, result.succeeded)
      const totalLabel = formatDistributionCount(messages, noun, result.total)
      const message = formatDistributionSummary(messages.common.resultSummary, {
        verb: successVerb,
        countLabel:
          result.failed.length === 0 ? countLabel : `${result.succeeded} of ${totalLabel}`,
      })

      if (result.failed.length === 0) {
        onBulkSuccess?.(message, result)
      } else {
        onBulkError?.(message, undefined, result)
      }
    } catch (error) {
      onBulkError?.(error instanceof Error ? error.message : String(error), error)
    } finally {
      setBulkActionTarget(null)
    }
  }

  const handleBulkDelete = async ({
    ids,
    endpoint,
    target,
    noun,
    clearSelection,
  }: BulkDeleteArgs) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    try {
      const result = await postBatch(client, `${endpoint}/batch-delete`, { ids })

      await refreshAll()
      clearSelection()

      const countLabel = formatDistributionCount(messages, noun, result.succeeded)
      const totalLabel = formatDistributionCount(messages, noun, result.total)
      const message = formatDistributionSummary(messages.common.deleteSummary, {
        countLabel:
          result.failed.length === 0 ? countLabel : `${result.succeeded} of ${totalLabel}`,
      })

      if (result.failed.length === 0) {
        onBulkSuccess?.(message, result)
      } else {
        onBulkError?.(message, undefined, result)
      }
    } catch (error) {
      onBulkError?.(error instanceof Error ? error.message : String(error), error)
    } finally {
      setBulkActionTarget(null)
    }
  }

  return (
    <div data-slot="distribution-page" className={cn("flex flex-col gap-6", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.page.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.page.description}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <DistributionOverview
            channels={channels}
            suppliers={suppliers}
            filteredChannels={filteredChannels}
            filteredContracts={filteredContracts}
            filteredMappings={filteredMappings}
            syncQueue={syncQueue}
            contractsNeedingReview={contractsNeedingReview}
            search={search}
            setSearch={setSearch}
            channelFilter={channelFilter}
            setChannelFilter={setChannelFilter}
            hasFilters={hasFilters}
            onClearFilters={() => {
              setSearch("")
              setChannelFilter("all")
            }}
            onOpenWebhookEvent={onWebhookEventOpen}
            onOpenContract={onContractOpen}
          />

          <Tabs defaultValue="channels">
            <TabsList variant="line">
              <TabsTrigger value="channels">{messages.page.tabs.channels}</TabsTrigger>
              <TabsTrigger value="contracts">{messages.page.tabs.contracts}</TabsTrigger>
              <TabsTrigger value="commissions">{messages.page.tabs.commissions}</TabsTrigger>
              <TabsTrigger value="mappings">{messages.page.tabs.mappings}</TabsTrigger>
              <TabsTrigger value="booking-links">{messages.page.tabs.bookingLinks}</TabsTrigger>
              <TabsTrigger value="webhooks">{messages.page.tabs.webhooks}</TabsTrigger>
            </TabsList>
            <DistributionChannelsTab
              filteredChannels={filteredChannels}
              channelSelection={channelSelection}
              setChannelSelection={setChannelSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={onChannelCreate}
              onOpenRoute={onChannelOpen}
              onEdit={onChannelEdit}
            />
            <DistributionContractsTab
              channels={channels}
              suppliers={suppliers}
              filteredContracts={filteredContracts}
              contractSelection={contractSelection}
              setContractSelection={setContractSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={onContractCreate}
              onOpenRoute={onContractOpen}
              onEdit={onContractEdit}
            />
            <DistributionCommissionsTab
              contracts={contracts}
              products={products}
              filteredCommissionRules={filteredCommissionRules}
              commissionSelection={commissionSelection}
              setCommissionSelection={setCommissionSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkDelete={handleBulkDelete}
              onCreate={onCommissionRuleCreate}
              onOpenRoute={onCommissionRuleOpen}
              onEdit={onCommissionRuleEdit}
            />
            <DistributionMappingsTab
              channels={channels}
              products={products}
              filteredMappings={filteredMappings}
              mappingSelection={mappingSelection}
              setMappingSelection={setMappingSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={onMappingCreate}
              onOpenRoute={onMappingOpen}
              onEdit={onMappingEdit}
            />
            <DistributionBookingLinksTab
              channels={channels}
              bookings={bookings}
              filteredBookingLinks={filteredBookingLinks}
              bookingLinkSelection={bookingLinkSelection}
              setBookingLinkSelection={setBookingLinkSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkDelete={handleBulkDelete}
              onCreate={onBookingLinkCreate}
              onOpenRoute={onBookingLinkOpen}
              onEdit={onBookingLinkEdit}
            />
            <DistributionWebhooksTab
              channels={channels}
              filteredWebhookEvents={filteredWebhookEvents}
              webhookSelection={webhookSelection}
              setWebhookSelection={setWebhookSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={onWebhookEventCreate}
              onOpenRoute={onWebhookEventOpen}
              onEdit={onWebhookEventEdit}
            />
          </Tabs>
        </>
      )}
    </div>
  )
}

async function postBatch(
  client: { baseUrl: string; fetcher: (url: string, init?: RequestInit) => Promise<Response> },
  path: string,
  body: Record<string, unknown>,
) {
  const response = await client.fetcher(joinUrl(client.baseUrl, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const responseBody = await safeJson(response)

  if (!response.ok) {
    throw new Error(extractErrorMessage(response.status, response.statusText, responseBody))
  }

  return responseBody as BatchMutationResponse
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractErrorMessage(status: number, statusText: string, body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error: unknown }).error
    if (typeof error === "string") return error
    if (typeof error === "object" && error !== null && "message" in error) {
      return String((error as { message: unknown }).message)
    }
  }

  return `Voyant API error: ${status} ${statusText}`
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}
