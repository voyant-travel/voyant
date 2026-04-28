import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  OverviewMetric,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/voyant-ui/components"
import { DollarSign, ExternalLink, Link2, Search, Webhook } from "lucide-react"
import type {
  ChannelContractRow,
  ChannelProductMappingRow,
  ChannelRow,
  ChannelWebhookEventRow,
  SupplierOption,
} from "./distribution-shared"
import { formatDateTime, labelById } from "./distribution-shared"

export function DistributionOverview({
  channels,
  suppliers,
  filteredChannels,
  filteredContracts,
  filteredMappings,
  syncQueue,
  contractsNeedingReview,
  search,
  setSearch,
  channelFilter,
  setChannelFilter,
  hasFilters,
  onClearFilters,
  onOpenWebhookEvent,
  onOpenContract,
}: {
  channels: ChannelRow[]
  suppliers: SupplierOption[]
  filteredChannels: ChannelRow[]
  filteredContracts: ChannelContractRow[]
  filteredMappings: ChannelProductMappingRow[]
  syncQueue: ChannelWebhookEventRow[]
  contractsNeedingReview: ChannelContractRow[]
  search: string
  setSearch: (value: string) => void
  channelFilter: string
  setChannelFilter: (value: string) => void
  hasFilters: boolean
  onClearFilters: () => void
  onOpenWebhookEvent: (eventId: string) => void
  onOpenContract: (contractId: string) => void
}) {
  const activeChannelsCount = filteredChannels.filter(
    (channel) => channel.status === "active",
  ).length
  const activeContractsCount = filteredContracts.filter(
    (contract) => contract.status === "active",
  ).length
  const activeMappingsCount = filteredMappings.filter((mapping) => mapping.active).length

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          title="Active Channels"
          value={activeChannelsCount}
          description="Live sales and reseller endpoints"
          icon={Link2}
        />
        <OverviewMetric
          title="Active Contracts"
          value={activeContractsCount}
          description="Commercial agreements currently in force"
          icon={DollarSign}
        />
        <OverviewMetric
          title="Active Mappings"
          value={activeMappingsCount}
          description="Products exposed to external channels"
          icon={ExternalLink}
        />
        <OverviewMetric
          title="Sync Queue"
          value={syncQueue.length}
          description="Pending or failed inbound events"
          icon={Webhook}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Webhook Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {syncQueue.length === 0 ? (
              <p className="text-muted-foreground">No pending or failed events in the queue.</p>
            ) : (
              syncQueue.slice(0, 4).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => onOpenWebhookEvent(event.id)}
                >
                  <div className="font-medium">
                    {labelById(channels, event.channelId)} · {event.eventType}
                  </div>
                  <div className="text-muted-foreground capitalize">
                    {event.status} · Received {formatDateTime(event.receivedAt)}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Contracts To Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contractsNeedingReview.length === 0 ? (
              <p className="text-muted-foreground">All contracts are currently active.</p>
            ) : (
              contractsNeedingReview.slice(0, 4).map((contract) => (
                <button
                  key={contract.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => onOpenContract(contract.id)}
                >
                  <div className="font-medium">
                    {labelById(channels, contract.channelId)} · {contract.startsAt}
                  </div>
                  <div className="text-muted-foreground capitalize">
                    {contract.status} · Supplier {labelById(suppliers, contract.supplierId)}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search distribution..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value ?? "all")}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="All channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasFilters ? (
          <Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </Button>
        ) : null}
      </div>
    </>
  )
}
