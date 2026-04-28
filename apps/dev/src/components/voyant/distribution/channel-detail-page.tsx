import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { formatDateTime } from "@voyantjs/distribution-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Link2, Loader2, Package, Trash2, Webhook } from "lucide-react"
import { api } from "@/lib/api-client"
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

type ChannelDetailPageProps = {
  id: string
}

export function ChannelDetailPage({ id }: ChannelDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
        <p className="text-muted-foreground">Channel not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          Back to Distribution
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
            <Badge variant="outline" className="capitalize">
              {channel.kind.replace("_", " ")}
            </Badge>
            <Badge
              variant={channel.status === "active" ? "default" : "secondary"}
              className="capitalize"
            >
              {channel.status}
            </Badge>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => {
            if (confirm("Delete this channel?")) {
              deleteMutation.mutate()
            }
          }}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Channel Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Website:</span>{" "}
              <span>{channel.website ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Contact Name:</span>{" "}
              <span>{channel.contactName ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Contact Email:</span>{" "}
              <span>{channel.contactEmail ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              <span>{new Date(channel.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{" "}
              <span>{new Date(channel.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {channel.metadata ? (
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(channel.metadata, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground">No metadata set.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Link2 className="h-4 w-4" />
          <CardTitle>Contracts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(contractsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No contracts for this channel.</p>
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
                  <Badge variant="outline" className="capitalize">
                    {contract.status}
                  </Badge>
                  <span>
                    {contract.startsAt} to {contract.endsAt ?? "open-ended"}
                  </span>
                </div>
                <div className="mt-2 text-muted-foreground">
                  Supplier:{" "}
                  {suppliersById.get(contract.supplierId ?? "")?.name ?? contract.supplierId ?? "-"}
                </div>
                <div className="text-muted-foreground">
                  Payment: {contract.paymentOwner} · Cancellation: {contract.cancellationOwner}
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
          <CardTitle>Product Mappings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(mappingsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No product mappings for this channel.</p>
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
                  External Product: {mapping.externalProductId}
                </div>
                <div className="text-muted-foreground">
                  Rate: {mapping.externalRateId ?? "-"} · Category:{" "}
                  {mapping.externalCategoryId ?? "-"}
                </div>
                <div className="mt-2">
                  <Badge variant={mapping.active ? "default" : "secondary"}>
                    {mapping.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(bookingLinksQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No booking links for this channel.</p>
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
                  {bookingsById.get(link.bookingId)?.bookingNumber ?? link.bookingId}
                </div>
                <div className="text-muted-foreground">
                  External Booking: {link.externalBookingId ?? "-"} · Ref:{" "}
                  {link.externalReference ?? "-"}
                </div>
                <div className="text-muted-foreground">
                  Status: {link.externalStatus ?? "-"} · Synced: {formatDateTime(link.lastSyncedAt)}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Webhook className="h-4 w-4" />
          <CardTitle>Webhook Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(webhookEventsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No webhook events recorded for this channel.</p>
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {event.status}
                  </Badge>
                  <span>{event.eventType}</span>
                </div>
                <div className="mt-2 text-muted-foreground">
                  External Event: {event.externalEventId ?? "-"}
                </div>
                <div className="text-muted-foreground">
                  Received: {formatDateTime(event.receivedAt)} · Processed:{" "}
                  {formatDateTime(event.processedAt)}
                </div>
                {event.errorMessage ? (
                  <div className="mt-2 whitespace-pre-wrap">{event.errorMessage}</div>
                ) : null}
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
