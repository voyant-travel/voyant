import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Link2, Loader2, Package, Trash2, Webhook } from "lucide-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { api } from "@/lib/api-client"
import {
  formatDistributionDateTime,
  getChannelKindLabel,
  getChannelStatusLabel,
  getContractStatusLabel,
  getPaymentOwnerLabel,
} from "../../../distribution-ui/src/components/distribution-shared"
import { useDistributionUiI18nOrDefault } from "../../../distribution-ui/src/index"
import {
  getDistributionChannelBookingLinksQueryOptions,
  getDistributionChannelBookingsQueryOptions,
  getDistributionChannelContractsQueryOptions,
  getDistributionChannelMappingsQueryOptions,
  getDistributionChannelProductsQueryOptions,
  getDistributionChannelQueryOptions,
  getDistributionChannelSuppliersQueryOptions,
  getDistributionChannelWebhookEventsQueryOptions,
} from "./distribution-detail-query-options"
import { useRegistryDistributionMessagesOrDefault } from "./i18n/provider"
import { formatRegistryDistributionDate } from "./i18n/utils"

type ChannelDetailPageProps = {
  id: string
}

export function ChannelDetailPage({ id }: ChannelDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const i18n = useDistributionUiI18nOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const detail = messages.details.channel

  const { data: channelData, isPending } = useQuery(getDistributionChannelQueryOptions(id))
  const contractsQuery = useQuery(getDistributionChannelContractsQueryOptions(id))
  const mappingsQuery = useQuery(getDistributionChannelMappingsQueryOptions(id))
  const bookingLinksQuery = useQuery(getDistributionChannelBookingLinksQueryOptions(id))
  const webhookEventsQuery = useQuery(getDistributionChannelWebhookEventsQueryOptions(id))
  const productsQuery = useQuery(getDistributionChannelProductsQueryOptions())
  const bookingsQuery = useQuery(getDistributionChannelBookingsQueryOptions())
  const suppliersQuery = useQuery(getDistributionChannelSuppliersQueryOptions())

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/distribution/channels/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["distribution", "channels"] })
      void navigate({ to: "/distribution" })
    },
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const channel = channelData?.data
  if (!channel) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detail.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/distribution" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{channel.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{getChannelKindLabel(channel.kind, i18n.messages)}</Badge>
            <Badge variant={channel.status === "active" ? "default" : "secondary"}>
              {getChannelStatusLabel(channel.status, i18n.messages)}
            </Badge>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => {
            if (confirm(detail.deleteConfirm)) {
              deleteMutation.mutate()
            }
          }}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {detail.deleteButton}
        </Button>
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
                onClick={() =>
                  void navigate({
                    to: "/distribution/contracts/$id",
                    params: { id: contract.id },
                  })
                }
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {getContractStatusLabel(contract.status, i18n.messages)}
                  </Badge>
                  <span>
                    {formatRegistryDistributionDate(i18n, contract.startsAt)} to{" "}
                    {contract.endsAt
                      ? formatRegistryDistributionDate(i18n, contract.endsAt)
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
                  {detail.labels.payment}:{" "}
                  {getPaymentOwnerLabel(contract.paymentOwner, i18n.messages)}
                  {" · "}
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
                onClick={() =>
                  void navigate({
                    to: "/distribution/mappings/$id",
                    params: { id: mapping.id },
                  })
                }
              >
                <div className="font-medium">
                  {productsById.get(mapping.productId)?.name ?? mapping.productId}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.externalProduct}: {mapping.externalProductId}
                </div>
                <div className="text-muted-foreground">
                  {detail.labels.rate}: {mapping.externalRateId ?? messages.common.none}
                  {" · "}
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
                onClick={() =>
                  void navigate({
                    to: "/distribution/booking-links/$id",
                    params: { id: link.id },
                  })
                }
              >
                <div className="font-medium">
                  {detail.labels.booking}:{" "}
                  {bookingsById.get(link.bookingId)?.bookingNumber ?? link.bookingId}
                </div>
                <div className="text-muted-foreground">
                  {messages.details.bookingLink.labels.externalBooking}:{" "}
                  {link.externalBookingId ?? messages.common.none}
                </div>
                <div className="text-muted-foreground">
                  {messages.details.bookingLink.labels.reference}:{" "}
                  {link.externalReference ?? messages.common.none}
                </div>
                <div className="text-muted-foreground">
                  {messages.details.bookingLink.labels.lastSynced}:{" "}
                  {formatDistributionDateTime(link.lastSyncedAt, i18n)}
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
                onClick={() =>
                  void navigate({
                    to: "/distribution/webhook-events/$id",
                    params: { id: event.id },
                  })
                }
              >
                <div className="font-medium">{event.eventType}</div>
                <div className="text-muted-foreground">
                  {distributionMessages.common.received}:{" "}
                  {formatDistributionDateTime(event.receivedAt, i18n)}
                </div>
                <div className="mt-2">
                  <Badge variant="outline">
                    {i18n.messages.common.webhookStatusLabels[event.status]}
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
