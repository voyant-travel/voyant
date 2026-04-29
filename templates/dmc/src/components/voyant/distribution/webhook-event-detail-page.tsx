import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useLocale } from "@voyantjs/admin"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Link2, Loader2, Trash2, Webhook } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import {
  getDistributionWebhookEventChannelQueryOptions,
  getDistributionWebhookEventQueryOptions,
} from "./distribution-detail-query-options"
import { formatDistributionDateTime } from "./distribution-shared"

type DistributionWebhookEventDetailPageProps = {
  id: string
}

export function DistributionWebhookEventDetailPage({
  id,
}: DistributionWebhookEventDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()
  const commonMessages = messages.distribution.details.common
  const detailMessages = messages.distribution.details.webhook
  const valueMessages = messages.distribution.values
  const noValue = messages.distribution.table.noValue

  const { data: eventData, isPending } = useQuery(getDistributionWebhookEventQueryOptions(id))
  const event = eventData?.data

  const channelQuery = useQuery({
    ...getDistributionWebhookEventChannelQueryOptions(event?.channelId ?? ""),
    enabled: Boolean(event?.channelId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/distribution/webhook-events/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["distribution", "webhook-events"] })
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

  if (!event) {
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
            <Badge variant="outline" className="capitalize">
              {valueMessages.webhookStatus[event.status] ?? event.status}
            </Badge>
            <Badge variant="secondary">{event.eventType}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/distribution/$id", params: { id: event.channelId } })
            }
          >
            <Link2 className="mr-2 h-4 w-4" />
            {commonMessages.openChannel}
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Webhook className="h-4 w-4" />
            <CardTitle>{detailMessages.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.channel}:</span>{" "}
              <span>{channelQuery.data?.data.name ?? event.channelId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.externalEvent}:</span>{" "}
              <span>{event.externalEventId ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.received}:</span>{" "}
              <span>{formatDistributionDateTime(event.receivedAt, resolvedLocale, noValue)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.processed}:</span>{" "}
              <span>{formatDistributionDateTime(event.processedAt, resolvedLocale, noValue)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.created}:</span>{" "}
              <span>{formatDistributionDateTime(event.createdAt, resolvedLocale, noValue)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.fields.updated}:</span>{" "}
              <span>{formatDistributionDateTime(event.updatedAt, resolvedLocale, noValue)}</span>
            </div>
            {event.errorMessage ? (
              <div>
                <div className="mb-1 text-muted-foreground">{detailMessages.errorTitle}</div>
                <div className="whitespace-pre-wrap rounded-md border p-3">
                  {event.errorMessage}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.payloadTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
