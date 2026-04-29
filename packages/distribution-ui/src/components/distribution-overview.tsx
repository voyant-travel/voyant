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
} from "@voyantjs/ui/components"
import { DollarSign, ExternalLink, Link2, Search, Webhook } from "lucide-react"
import { useDistributionUiI18nOrDefault } from "../i18n"
import type {
  ChannelContractRow,
  ChannelProductMappingRow,
  ChannelRow,
  ChannelWebhookEventRow,
  SupplierOption,
} from "./distribution-shared"
import {
  formatDistributionDate,
  formatDistributionDateTime,
  getContractStatusLabel,
  getWebhookStatusLabel,
  labelById,
} from "./distribution-shared"

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
  const i18n = useDistributionUiI18nOrDefault()
  const { messages } = i18n

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          title={messages.overview.metrics.activeChannels.title}
          value={activeChannelsCount}
          description={messages.overview.metrics.activeChannels.description}
          icon={Link2}
        />
        <OverviewMetric
          title={messages.overview.metrics.activeContracts.title}
          value={activeContractsCount}
          description={messages.overview.metrics.activeContracts.description}
          icon={DollarSign}
        />
        <OverviewMetric
          title={messages.overview.metrics.activeMappings.title}
          value={activeMappingsCount}
          description={messages.overview.metrics.activeMappings.description}
          icon={ExternalLink}
        />
        <OverviewMetric
          title={messages.overview.metrics.syncQueue.title}
          value={syncQueue.length}
          description={messages.overview.metrics.syncQueue.description}
          icon={Webhook}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{messages.overview.webhookQueue.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {syncQueue.length === 0 ? (
              <p className="text-muted-foreground">{messages.overview.webhookQueue.empty}</p>
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
                  <div className="text-muted-foreground">
                    {getWebhookStatusLabel(event.status, messages)} · {messages.common.received}{" "}
                    {formatDistributionDateTime(event.receivedAt, i18n)}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>{messages.overview.contractsToReview.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contractsNeedingReview.length === 0 ? (
              <p className="text-muted-foreground">{messages.overview.contractsToReview.empty}</p>
            ) : (
              contractsNeedingReview.slice(0, 4).map((contract) => (
                <button
                  key={contract.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() => onOpenContract(contract.id)}
                >
                  <div className="font-medium">
                    {labelById(channels, contract.channelId)} ·{" "}
                    {formatDistributionDate(contract.startsAt, i18n)}
                  </div>
                  <div className="text-muted-foreground">
                    {getContractStatusLabel(contract.status, messages)} · {messages.common.supplier}{" "}
                    {labelById(suppliers, contract.supplierId)}
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
              placeholder={messages.common.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value ?? "all")}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder={messages.overview.filters.allChannelsPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{messages.common.allChannels}</SelectItem>
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
            {messages.common.clearFilters}
          </Button>
        ) : null}
      </div>
    </>
  )
}
