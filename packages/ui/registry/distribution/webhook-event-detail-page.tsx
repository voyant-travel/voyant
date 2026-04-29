import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Link2, Loader2, Trash2, Webhook } from "lucide-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { api } from "@/lib/api-client"
import { formatDistributionDateTime } from "../../../distribution-ui/src/components/distribution-shared"
import { useDistributionUiI18nOrDefault } from "../../../distribution-ui/src/index"
import {
  getDistributionWebhookEventChannelQueryOptions,
  getDistributionWebhookEventQueryOptions,
} from "./distribution-detail-query-options"
import { useRegistryDistributionMessagesOrDefault } from "./i18n/provider"

type DistributionWebhookEventDetailPageProps = { id: string }

export function DistributionWebhookEventDetailPage({
  id,
}: DistributionWebhookEventDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const i18n = useDistributionUiI18nOrDefault()
  const messages = useRegistryDistributionMessagesOrDefault()
  const detail = messages.details.webhookEvent
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
  if (isPending)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  if (!event)
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
            <Badge variant="outline">
              {i18n.messages.common.webhookStatusLabels[event.status]}
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
            {detail.openChannel}
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
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Webhook className="h-4 w-4" />
            <CardTitle>{detail.sections.details}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{messages.common.channelLabel}:</span>{" "}
              <span>{channelQuery.data?.data.name ?? event.channelId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.externalEvent}:</span>{" "}
              <span>{event.externalEventId ?? messages.common.none}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.received}:</span>{" "}
              <span>{formatDistributionDateTime(event.receivedAt, i18n)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detail.labels.processed}:</span>{" "}
              <span>{formatDistributionDateTime(event.processedAt, i18n)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.common.createdLabel}:</span>{" "}
              <span>{formatDistributionDateTime(event.createdAt, i18n)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.common.updatedLabel}:</span>{" "}
              <span>{formatDistributionDateTime(event.updatedAt, i18n)}</span>
            </div>
            {event.errorMessage ? (
              <div>
                <div className="mb-1 text-muted-foreground">{detail.labels.error}</div>
                <div className="whitespace-pre-wrap rounded-md border p-3">
                  {event.errorMessage}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{detail.sections.payload}</CardTitle>
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
