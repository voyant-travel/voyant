import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import type { RowSelectionState } from "@tanstack/react-table"
import { formatMessage, useLocale } from "@voyantjs/admin"
import { DistributionOverview } from "@voyantjs/distribution-ui/components/distribution-overview"
import type {
  BatchMutationResponse,
  ChannelBookingLinkRow,
  ChannelCommissionRuleRow,
  ChannelContractRow,
  ChannelProductMappingRow,
  ChannelRow,
  ChannelWebhookEventRow,
} from "@voyantjs/distribution-ui/components/distribution-shared"
import {
  formatSelectionLabel,
  labelById,
} from "@voyantjs/distribution-ui/components/distribution-shared"
import { Tabs, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  getDistributionBookingLinksQueryOptions,
  getDistributionBookingsQueryOptions,
  getDistributionChannelsQueryOptions,
  getDistributionCommissionRulesQueryOptions,
  getDistributionContractsQueryOptions,
  getDistributionMappingsQueryOptions,
  getDistributionProductsQueryOptions,
  getDistributionSuppliersQueryOptions,
  getDistributionWebhookEventsQueryOptions,
} from "@/components/voyant/distribution/distribution-query-options"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { DistributionDialogs } from "./distribution-dialogs"
import {
  DistributionChannelsTab,
  DistributionCommissionsTab,
  DistributionContractsTab,
} from "./distribution-tabs-primary"
import {
  DistributionBookingLinksTab,
  DistributionMappingsTab,
  DistributionWebhooksTab,
} from "./distribution-tabs-secondary"

export function DistributionPage() {
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [channelFilter, setChannelFilter] = useState("all")
  const [bulkActionTarget, setBulkActionTarget] = useState<string | null>(null)
  const [channelSelection, setChannelSelection] = useState<RowSelectionState>({})
  const [contractSelection, setContractSelection] = useState<RowSelectionState>({})
  const [commissionSelection, setCommissionSelection] = useState<RowSelectionState>({})
  const [mappingSelection, setMappingSelection] = useState<RowSelectionState>({})
  const [bookingLinkSelection, setBookingLinkSelection] = useState<RowSelectionState>({})
  const [webhookSelection, setWebhookSelection] = useState<RowSelectionState>({})
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false)
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [bookingLinkDialogOpen, setBookingLinkDialogOpen] = useState(false)
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<ChannelRow | undefined>()
  const [editingContract, setEditingContract] = useState<ChannelContractRow | undefined>()
  const [editingCommission, setEditingCommission] = useState<ChannelCommissionRuleRow | undefined>()
  const [editingMapping, setEditingMapping] = useState<ChannelProductMappingRow | undefined>()
  const [editingBookingLink, setEditingBookingLink] = useState<ChannelBookingLinkRow | undefined>()
  const [editingWebhook, setEditingWebhook] = useState<ChannelWebhookEventRow | undefined>()

  const suppliersQuery = useQuery(getDistributionSuppliersQueryOptions())
  const productsQuery = useQuery(getDistributionProductsQueryOptions())
  const bookingsQuery = useQuery(getDistributionBookingsQueryOptions())
  const channelsQuery = useQuery(getDistributionChannelsQueryOptions())
  const contractsQuery = useQuery(getDistributionContractsQueryOptions())
  const commissionRulesQuery = useQuery(getDistributionCommissionRulesQueryOptions())
  const mappingsQuery = useQuery(getDistributionMappingsQueryOptions())
  const bookingLinksQuery = useQuery(getDistributionBookingLinksQueryOptions())
  const webhookEventsQuery = useQuery(getDistributionWebhookEventsQueryOptions())

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
  const syncQueue = [...filteredWebhookEvents].filter(
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
    nouns,
    payload,
    successVerb,
    clearSelection,
  }: {
    ids: string[]
    endpoint: string
    target: string
    nouns: { singular: string; plural: string }
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
      toast.success(
        formatMessage(messages.distribution.toasts.success, {
          verb: successVerb,
          selection: formatSelectionLabel(result.succeeded, nouns.singular, nouns.plural),
        }),
      )
      return
    }

    toast.error(
      formatMessage(messages.distribution.toasts.partial, {
        verb: successVerb,
        succeeded: result.succeeded,
        selection: formatSelectionLabel(result.total, nouns.singular, nouns.plural),
      }),
    )
  }

  const handleBulkDelete = async ({
    ids,
    endpoint,
    target,
    nouns,
    clearSelection,
  }: {
    ids: string[]
    endpoint: string
    target: string
    nouns: { singular: string; plural: string }
    clearSelection: () => void
  }) => {
    if (ids.length === 0) return

    setBulkActionTarget(target)

    const result = await api.post<BatchMutationResponse>(`${endpoint}/batch-delete`, { ids })

    await refreshAll()
    clearSelection()
    setBulkActionTarget(null)

    if (result.failed.length === 0) {
      toast.success(
        formatMessage(messages.distribution.toasts.success, {
          verb: messages.distribution.toasts.deleted,
          selection: formatSelectionLabel(result.succeeded, nouns.singular, nouns.plural),
        }),
      )
      return
    }

    toast.error(
      formatMessage(messages.distribution.toasts.partial, {
        verb: messages.distribution.toasts.deleted,
        succeeded: result.succeeded,
        selection: formatSelectionLabel(result.total, nouns.singular, nouns.plural),
      }),
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.distribution.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.distribution.description}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm">{messages.distribution.loading}</span>
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
            onOpenWebhookEvent={(eventId) => {
              void navigate({
                to: "/distribution/webhook-events/$id",
                params: { id: eventId },
              })
            }}
            onOpenContract={(contractId) => {
              void navigate({
                to: "/distribution/contracts/$id",
                params: { id: contractId },
              })
            }}
          />

          <Tabs defaultValue="channels">
            <TabsList variant="line">
              <TabsTrigger value="channels">{messages.distribution.tabs.channels}</TabsTrigger>
              <TabsTrigger value="contracts">{messages.distribution.tabs.contracts}</TabsTrigger>
              <TabsTrigger value="commissions">
                {messages.distribution.tabs.commissions}
              </TabsTrigger>
              <TabsTrigger value="mappings">{messages.distribution.tabs.mappings}</TabsTrigger>
              <TabsTrigger value="booking-links">
                {messages.distribution.tabs.bookingLinks}
              </TabsTrigger>
              <TabsTrigger value="webhooks">{messages.distribution.tabs.webhooks}</TabsTrigger>
            </TabsList>
            <DistributionChannelsTab
              filteredChannels={filteredChannels}
              channelSelection={channelSelection}
              setChannelSelection={setChannelSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingChannel(undefined)
                setChannelDialogOpen(true)
              }}
              onOpenRoute={(channelId) => {
                void navigate({ to: "/distribution/$id", params: { id: channelId } })
              }}
              onEdit={(row) => {
                setEditingChannel(row)
                setChannelDialogOpen(true)
              }}
            />
            <DistributionContractsTab
              channels={channels}
              locale={resolvedLocale}
              suppliers={suppliers}
              filteredContracts={filteredContracts}
              contractSelection={contractSelection}
              setContractSelection={setContractSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingContract(undefined)
                setContractDialogOpen(true)
              }}
              onOpenRoute={(contractId) => {
                void navigate({ to: "/distribution/contracts/$id", params: { id: contractId } })
              }}
              onEdit={(row) => {
                setEditingContract(row)
                setContractDialogOpen(true)
              }}
            />
            <DistributionCommissionsTab
              contracts={contracts}
              products={products}
              filteredCommissionRules={filteredCommissionRules}
              commissionSelection={commissionSelection}
              setCommissionSelection={setCommissionSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingCommission(undefined)
                setCommissionDialogOpen(true)
              }}
              onOpenRoute={(commissionRuleId) => {
                void navigate({
                  to: "/distribution/commission-rules/$id",
                  params: { id: commissionRuleId },
                })
              }}
              onEdit={(row) => {
                setEditingCommission(row)
                setCommissionDialogOpen(true)
              }}
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
              onCreate={() => {
                setEditingMapping(undefined)
                setMappingDialogOpen(true)
              }}
              onOpenRoute={(mappingId) => {
                void navigate({ to: "/distribution/mappings/$id", params: { id: mappingId } })
              }}
              onEdit={(row) => {
                setEditingMapping(row)
                setMappingDialogOpen(true)
              }}
            />
            <DistributionBookingLinksTab
              channels={channels}
              locale={resolvedLocale}
              bookings={bookings}
              filteredBookingLinks={filteredBookingLinks}
              bookingLinkSelection={bookingLinkSelection}
              setBookingLinkSelection={setBookingLinkSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingBookingLink(undefined)
                setBookingLinkDialogOpen(true)
              }}
              onOpenRoute={(bookingLinkId) => {
                void navigate({
                  to: "/distribution/booking-links/$id",
                  params: { id: bookingLinkId },
                })
              }}
              onEdit={(row) => {
                setEditingBookingLink(row)
                setBookingLinkDialogOpen(true)
              }}
            />
            <DistributionWebhooksTab
              channels={channels}
              locale={resolvedLocale}
              filteredWebhookEvents={filteredWebhookEvents}
              webhookSelection={webhookSelection}
              setWebhookSelection={setWebhookSelection}
              bulkActionTarget={bulkActionTarget}
              handleBulkUpdate={handleBulkUpdate}
              handleBulkDelete={handleBulkDelete}
              onCreate={() => {
                setEditingWebhook(undefined)
                setWebhookDialogOpen(true)
              }}
              onOpenRoute={(webhookEventId) => {
                void navigate({
                  to: "/distribution/webhook-events/$id",
                  params: { id: webhookEventId },
                })
              }}
              onEdit={(row) => {
                setEditingWebhook(row)
                setWebhookDialogOpen(true)
              }}
            />
          </Tabs>
        </>
      )}

      <DistributionDialogs
        channelDialogOpen={channelDialogOpen}
        setChannelDialogOpen={(open) => {
          setChannelDialogOpen(open)
          if (!open) setEditingChannel(undefined)
        }}
        editingChannel={editingChannel}
        contractDialogOpen={contractDialogOpen}
        setContractDialogOpen={(open) => {
          setContractDialogOpen(open)
          if (!open) setEditingContract(undefined)
        }}
        editingContract={editingContract}
        commissionDialogOpen={commissionDialogOpen}
        setCommissionDialogOpen={(open) => {
          setCommissionDialogOpen(open)
          if (!open) setEditingCommission(undefined)
        }}
        editingCommission={editingCommission}
        mappingDialogOpen={mappingDialogOpen}
        setMappingDialogOpen={(open) => {
          setMappingDialogOpen(open)
          if (!open) setEditingMapping(undefined)
        }}
        editingMapping={editingMapping}
        bookingLinkDialogOpen={bookingLinkDialogOpen}
        setBookingLinkDialogOpen={(open) => {
          setBookingLinkDialogOpen(open)
          if (!open) setEditingBookingLink(undefined)
        }}
        editingBookingLink={editingBookingLink}
        webhookDialogOpen={webhookDialogOpen}
        setWebhookDialogOpen={(open) => {
          setWebhookDialogOpen(open)
          if (!open) setEditingWebhook(undefined)
        }}
        editingWebhook={editingWebhook}
        channels={channels}
        suppliers={suppliers}
        contracts={contracts}
        products={products}
        bookings={bookings}
        refreshAll={refreshAll}
      />
    </div>
  )
}
