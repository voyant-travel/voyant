import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useLocale } from "@voyantjs/admin"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Link2, Loader2, ReceiptText, Trash2 } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import {
  getDistributionBookingLinkBookingQueryOptions,
  getDistributionBookingLinkChannelQueryOptions,
  getDistributionBookingLinkQueryOptions,
} from "./distribution-detail-query-options"
import { formatDistributionDateTime } from "./distribution-shared"

type DistributionBookingLinkDetailPageProps = {
  id: string
}

export function DistributionBookingLinkDetailPage({ id }: DistributionBookingLinkDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()
  const commonMessages = messages.distribution.details.common
  const detailMessages = messages.distribution.details.bookingLink
  const noValue = messages.distribution.table.noValue

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

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!link) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detailMessages.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          {commonMessages.back}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/distribution" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{detailMessages.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{link.externalStatus ?? detailMessages.unmappedStatus}</Badge>
            <Badge variant="secondary">
              {link.externalReference ?? detailMessages.noReference}
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
            {commonMessages.openChannel}
          </Button>
          <Button
            variant="outline"
            onClick={() => void navigate({ to: "/bookings/$id", params: { id: link.bookingId } })}
          >
            <ReceiptText className="mr-2 h-4 w-4" />
            {commonMessages.openBooking}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(detailMessages.deleteConfirm)) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {commonMessages.delete}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{detailMessages.detailsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.channel}:</span>{" "}
            <span>{channelQuery.data?.data.name ?? link.channelId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.booking}:</span>{" "}
            <span>{bookingQuery.data?.data.bookingNumber ?? link.bookingId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.externalBooking}:</span>{" "}
            <span>{link.externalBookingId ?? noValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.reference}:</span>{" "}
            <span>{link.externalReference ?? noValue}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.bookedAtExternal}:</span>{" "}
            <span>
              {formatDistributionDateTime(link.bookedAtExternal, resolvedLocale, noValue)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.lastSynced}:</span>{" "}
            <span>{formatDistributionDateTime(link.lastSyncedAt, resolvedLocale, noValue)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.created}:</span>{" "}
            <span>{formatDistributionDateTime(link.createdAt, resolvedLocale, noValue)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.fields.updated}:</span>{" "}
            <span>{formatDistributionDateTime(link.updatedAt, resolvedLocale, noValue)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
