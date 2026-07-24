import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmActionButton,
} from "@voyant-travel/ui/components"
import { cn } from "@voyant-travel/ui/lib/utils"
import { ArrowLeft, Link2, Loader2, Package, Webhook } from "lucide-react"
import { useDistributionUiI18nOrDefault } from "../i18n/index.js"
import {
  useBookingLinks,
  useBookings,
  useChannel,
  useChannelMutation,
  useContracts,
  useMappings,
  useProducts,
  useSuppliers,
  useWebhookEvents,
} from "../index.js"
import {
  formatDistributionDate,
  formatDistributionDateTime,
  getChannelKindLabel,
  getChannelStatusLabel,
  getContractStatusLabel,
  getPaymentOwnerLabel,
} from "./distribution-shared.js"

export interface ChannelDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onContractOpen?: (contractId: string) => void
  onMappingOpen?: (mappingId: string) => void
  onBookingLinkOpen?: (bookingLinkId: string) => void
  onWebhookEventOpen?: (webhookEventId: string) => void
}

const noop = () => {}

export function ChannelDetailPage({
  id,
  className,
  onBack = noop,
  onDeleted = noop,
  onContractOpen = noop,
  onMappingOpen = noop,
  onBookingLinkOpen = noop,
  onWebhookEventOpen = noop,
}: ChannelDetailPageProps) {
  const i18n = useDistributionUiI18nOrDefault()
  const { messages } = i18n
  const detail = messages.details.channel
  const channelQuery = useChannel(id)
  const contractsQuery = useContracts({ channelId: id, limit: 25, offset: 0 })
  const mappingsQuery = useMappings({ channelId: id, limit: 25, offset: 0 })
  const bookingLinksQuery = useBookingLinks({ channelId: id, limit: 25, offset: 0 })
  const webhookEventsQuery = useWebhookEvents({ channelId: id, limit: 25, offset: 0 })
  const productsQuery = useProducts({ limit: 25, offset: 0 })
  const bookingsQuery = useBookings({ limit: 25, offset: 0 })
  const suppliersQuery = useSuppliers({ limit: 25, offset: 0 })
  const { remove } = useChannelMutation()

  if (channelQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const channel = channelQuery.data
  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detail.notFound}</p>
        <Button variant="outline" onClick={onBack}>
          {messages.common.backToDistribution}
        </Button>
      </div>
    )
  }

  const productsById = new Map(
    (productsQuery.data?.data ?? []).map((product) => [product.id, product]),
  )
  const bookingsById = new Map(
    (bookingsQuery.data?.data ?? []).map((booking) => [booking.id, booking]),
  )
  const suppliersById = new Map(
    (suppliersQuery.data?.data ?? []).map((supplier) => [supplier.id, supplier]),
  )

  return (
    <div data-slot="channel-detail-page" className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{channel.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{getChannelKindLabel(channel.kind, messages)}</Badge>
            <Badge variant={channel.status === "active" ? "default" : "secondary"}>
              {getChannelStatusLabel(channel.status, messages)}
            </Badge>
          </div>
        </div>
        <ConfirmActionButton
          buttonLabel={detail.deleteButton}
          confirmLabel={detail.deleteButton}
          title={detail.deleteConfirm}
          description={detail.deleteDescription}
          variant="destructive"
          confirmVariant="destructive"
          disabled={remove.isPending}
          onConfirm={async () => {
            await remove.mutateAsync(id)
            onDeleted()
            onBack()
          }}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detail.sections.details}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{detail.labels.website}:</span>{" "}
              <span>{channel.website ?? messages.common.none}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.contactName}:</span>{" "}
              <span>{channel.contactName ?? messages.common.none}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.contactEmail}:</span>{" "}
              <span>{channel.contactEmail ?? messages.common.none}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.common.createdLabel}:</span>{" "}
              <span>{formatDistributionDateTime(channel.createdAt, i18n)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.common.updatedLabel}:</span>{" "}
              <span>{formatDistributionDateTime(channel.updatedAt, i18n)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detail.sections.metadata}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {channel.metadata ? (
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(channel.metadata, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground">{detail.empty.metadata}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Link2 className="h-4 w-4" />
          <CardTitle>{detail.sections.contracts}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(contractsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detail.empty.contracts}</p>
          ) : (
            contractsQuery.data?.data.map((contract) => (
              <button
                key={contract.id}
                type="button"
                className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                onClick={() => onContractOpen(contract.id)}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {getContractStatusLabel(contract.status, messages)}
                  </Badge>
                  <span>
                    {formatDistributionDate(contract.startsAt, i18n)} -{" "}
                    {contract.endsAt
                      ? formatDistributionDate(contract.endsAt, i18n)
                      : messages.common.openEnded}
                  </span>
                </div>
                <div className="mt-2 text-muted-foreground">
                  {detail.labels.supplier}:{" "}
                  {suppliersById.get(contract.supplierId ?? "")?.name ??
                    contract.supplierId ??
                    messages.common.none}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.payment}: {getPaymentOwnerLabel(contract.paymentOwner, messages)}
                  {" - "}
                  {detail.labels.cancellation}:{" "}
                  {messages.common.cancellationOwnerLabels[contract.cancellationOwner]}
                </div>
                {contract.settlementTerms ? (
                  <div className="mt-2 whitespace-pre-wrap">{contract.settlementTerms}</div>
                ) : null}
                {contract.notes ? (
                  <div className="mt-2 whitespace-pre-wrap">{contract.notes}</div>
                ) : null}
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Package className="h-4 w-4" />
          <CardTitle>{detail.sections.mappings}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(mappingsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detail.empty.mappings}</p>
          ) : (
            mappingsQuery.data?.data.map((mapping) => (
              <button
                key={mapping.id}
                type="button"
                className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                onClick={() => onMappingOpen(mapping.id)}
              >
                <div className="font-medium">
                  {productsById.get(mapping.productId)?.name ?? mapping.productId}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.externalProduct}: {mapping.externalProductId}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.rate}: {mapping.externalRateId ?? messages.common.none}
                  {" - "}
                  {detail.labels.category}: {mapping.externalCategoryId ?? messages.common.none}
                </div>
                <div className="mt-2">
                  <Badge variant={mapping.active ? "default" : "secondary"}>
                    {mapping.active ? messages.common.active : messages.common.inactive}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{detail.sections.bookingLinks}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(bookingLinksQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detail.empty.bookingLinks}</p>
          ) : (
            bookingLinksQuery.data?.data.map((link) => (
              <button
                key={link.id}
                type="button"
                className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                onClick={() => onBookingLinkOpen(link.id)}
              >
                <div className="font-medium">
                  {detail.labels.booking}:{" "}
                  {bookingsById.get(link.bookingId)?.bookingNumber ?? link.bookingId}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.externalBooking}: {link.externalBookingId ?? messages.common.none}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.reference}: {link.externalReference ?? messages.common.none}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.lastSynced}: {formatDistributionDateTime(link.lastSyncedAt, i18n)}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Webhook className="h-4 w-4" />
          <CardTitle>{detail.sections.webhooks}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(webhookEventsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detail.empty.webhooks}</p>
          ) : (
            webhookEventsQuery.data?.data.map((event) => (
              <button
                key={event.id}
                type="button"
                className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                onClick={() => onWebhookEventOpen(event.id)}
              >
                <div className="font-medium">{event.eventType}</div>
                <div className="text-muted-foreground">
                  {messages.common.received}: {formatDistributionDateTime(event.receivedAt, i18n)}
                </div>
                <div className="mt-2">
                  <Badge variant="outline">
                    {messages.common.webhookStatusLabels[event.status]}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
