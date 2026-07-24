import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { ArrowLeft, Link2, Loader2, ReceiptText } from "lucide-react"
import { useDistributionUiI18nOrDefault } from "../i18n/index.js"
import {
  distributionQueryKeys,
  fetchWithValidation,
  getBookingLinkQueryOptions,
  getBookingQueryOptions,
  getChannelQueryOptions,
  successEnvelope,
  useVoyantDistributionContext,
} from "../index.js"
import { formatDistributionDateTime } from "./distribution-shared.js"

export interface BookingLinkDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onChannelOpen?: (channelId: string) => void
  onBookingOpen?: (bookingId: string) => void
}

const noop = () => {}

export function BookingLinkDetailPage({
  id,
  className,
  onBack = noop,
  onDeleted = noop,
  onChannelOpen = noop,
  onBookingOpen = noop,
}: BookingLinkDetailPageProps) {
  const i18n = useDistributionUiI18nOrDefault()
  const { messages } = i18n
  const detail = messages.details.bookingLink
  const client = useVoyantDistributionContext()
  const queryClient = useQueryClient()

  const linkQuery = useQuery({
    ...getBookingLinkQueryOptions(client, id),
    select: (result) => result.data,
  })
  const link = linkQuery.data

  const channelQuery = useQuery({
    ...getChannelQueryOptions(client, link?.channelId),
    select: (result) => result.data,
    enabled: Boolean(link?.channelId),
  })
  const bookingQuery = useQuery({
    ...getBookingQueryOptions(client, link?.bookingId),
    select: (result) => result.data,
    enabled: Boolean(link?.bookingId),
  })

  const remove = useMutation({
    mutationFn: () =>
      fetchWithValidation(`/v1/admin/distribution/booking-links/${id}`, successEnvelope, client, {
        method: "DELETE", // i18n-literal-ok HTTP method
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: distributionQueryKeys.bookingLinks() })
      queryClient.removeQueries({ queryKey: distributionQueryKeys.bookingLink(id) })
      onDeleted()
      onBack()
    },
  })

  if (linkQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!link) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detail.notFound}</p>
        <Button variant="outline" onClick={onBack}>
          {messages.common.backToDistribution}
        </Button>
      </div>
    )
  }

  return (
    <div data-slot="booking-link-detail-page" className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
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
          <Button variant="outline" onClick={() => onChannelOpen(link.channelId)}>
            <Link2 className="mr-2 h-4 w-4" />
            {detail.openChannel}
          </Button>
          <Button variant="outline" onClick={() => onBookingOpen(link.bookingId)}>
            <ReceiptText className="mr-2 h-4 w-4" />
            {detail.openBooking}
          </Button>
          <ConfirmActionButton
            buttonLabel={detail.deleteButton}
            confirmLabel={detail.deleteButton}
            title={detail.deleteConfirm}
            description={detail.deleteDescription}
            variant="destructive"
            confirmVariant="destructive"
            disabled={remove.isPending}
            onConfirm={async () => {
              await remove.mutateAsync()
            }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{detail.sections.details}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{messages.common.channelLabel}:</span>{" "}
            <span>{channelQuery.data?.name ?? link.channelId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.common.bookingLabel}:</span>{" "}
            <span>{bookingQuery.data?.bookingNumber ?? link.bookingId}</span>
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
