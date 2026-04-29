import { useLocale } from "@voyantjs/admin"
import { DollarSign, ExternalLink, Link2, Search, Webhook } from "lucide-react"
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
} from "@/components/ui"
import type {
  ChannelContractRow,
  ChannelProductMappingRow,
  ChannelRow,
  ChannelWebhookEventRow,
  SupplierOption,
} from "@/components/voyant/distribution/distribution-shared"
import {
  formatDistributionDateTime,
  labelById,
} from "@/components/voyant/distribution/distribution-shared"
import { useAdminMessages } from "@/lib/admin-i18n"

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
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()
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
          title={messages.distribution.overview.activeChannelsTitle}
          value={activeChannelsCount}
          description={messages.distribution.overview.activeChannelsDescription}
          icon={Link2}
        />
        <OverviewMetric
          title={messages.distribution.overview.activeContractsTitle}
          value={activeContractsCount}
          description={messages.distribution.overview.activeContractsDescription}
          icon={DollarSign}
        />
        <OverviewMetric
          title={messages.distribution.overview.activeMappingsTitle}
          value={activeMappingsCount}
          description={messages.distribution.overview.activeMappingsDescription}
          icon={ExternalLink}
        />
        <OverviewMetric
          title={messages.distribution.overview.syncQueueTitle}
          value={syncQueue.length}
          description={messages.distribution.overview.syncQueueDescription}
          icon={Webhook}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>{messages.distribution.overview.webhookQueueTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {syncQueue.length === 0 ? (
              <p className="text-muted-foreground">
                {messages.distribution.overview.webhookQueueEmpty}
              </p>
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
                    {messages.distribution.values.webhookStatus[event.status] ?? event.status} ·{" "}
                    {messages.distribution.overview.received}{" "}
                    {formatDistributionDateTime(
                      event.receivedAt,
                      resolvedLocale,
                      messages.distribution.table.noValue,
                    )}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>{messages.distribution.overview.contractsToReviewTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contractsNeedingReview.length === 0 ? (
              <p className="text-muted-foreground">
                {messages.distribution.overview.contractsToReviewEmpty}
              </p>
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
                    {messages.distribution.values.contractStatus[contract.status] ??
                      contract.status}{" "}
                    · {messages.distribution.overview.supplier}{" "}
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
              placeholder={messages.distribution.overview.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value ?? "all")}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder={messages.distribution.overview.allChannels} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{messages.distribution.overview.allChannels}</SelectItem>
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
            {messages.distribution.overview.clearFilters}
          </Button>
        ) : null}
      </div>
    </>
  )
}
