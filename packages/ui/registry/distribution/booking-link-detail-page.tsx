import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Link2, Loader2, ReceiptText, Trash2 } from "lucide-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { api } from "@/lib/api-client"
import { formatDistributionDateTime } from "../../../distribution-ui/src/components/distribution-shared"
import { useDistributionUiI18nOrDefault } from "../../../distribution-ui/src/index"
import {
  getDistributionBookingLinkBookingQueryOptions,
  getDistributionBookingLinkChannelQueryOptions,
  getDistributionBookingLinkQueryOptions,
} from "./distribution-detail-query-options"
import { useRegistryDistributionMessagesOrDefault } from "./i18n/provider"

type DistributionBookingLinkDetailPageProps = { id: string }

export function DistributionBookingLinkDetailPage({ id }: DistributionBookingLinkDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const i18n = useDistributionUiI18nOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const detail = messages.details.bookingLink
  const { data: linkData, isPending } = useQuery(getDistributionBookingLinkQueryOptions(id))
  const link = linkData?.data
  const channelQuery = useQuery({
    ...getDistributionBookingLinkChannelQueryOptions(link?.channelId ?? ""),
    enabled: Boolean(link?.channelId),
  })
  const bookingQuery = useQuery({
    ...getDistributionBookingLinkBookingQueryOptions(link?.bookingId ?? ""),
    enabled: Boolean(link?.bookingId),
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/distribution/booking-links/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["distribution", "booking-links"] })
      void navigate({ to: "/distribution" })
    },
  })
  if (isPending)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  if (!link)
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detail.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          {messages.common.backToDistribution}
        </Button>
      </div>
    )
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/distribution" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{link.externalStatus ?? messages.common.unmappedStatus}</Badge>
            <Badge variant="secondary">
              {link.externalReference ?? messages.common.noReference}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/distribution/$id", params: { id: link.channelId } })
            }
          >
            <Link2 className="mr-2 h-4 w-4" />
            {detail.openChannel}
          </Button>
          <Button
            variant="outline"
            onClick={() => void navigate({ to: "/bookings/$id", params: { id: link.bookingId } })}
          >
            <ReceiptText className="mr-2 h-4 w-4" />
            {detail.openBooking}
          </Button>
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
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{detail.sections.details}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{messages.common.channelLabel}:</span>{" "}
            <span>{channelQuery.data?.data.name ?? link.channelId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.bookingLabel}:</span>{" "}
            <span>{bookingQuery.data?.data.bookingNumber ?? link.bookingId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.externalBooking}:</span>{" "}
            <span>{link.externalBookingId ?? messages.common.none}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.reference}:</span>{" "}
            <span>{link.externalReference ?? messages.common.none}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.bookedAtExternal}:</span>{" "}
            <span>{formatDistributionDateTime(link.bookedAtExternal, i18n)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detail.labels.lastSynced}:</span>{" "}
            <span>{formatDistributionDateTime(link.lastSyncedAt, i18n)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.createdLabel}:</span>{" "}
            <span>{formatDistributionDateTime(link.createdAt, i18n)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.updatedLabel}:</span>{" "}
            <span>{formatDistributionDateTime(link.updatedAt, i18n)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
