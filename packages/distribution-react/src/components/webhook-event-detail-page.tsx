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
import { ArrowLeft, Link2, Loader2, Webhook } from "lucide-react"
import { useDistributionUiI18nOrDefault } from "../i18n/index.js"
import {
  distributionQueryKeys,
  fetchWithValidation,
  getChannelQueryOptions,
  getWebhookEventQueryOptions,
  successEnvelope,
  useVoyantDistributionContext,
} from "../index.js"
import { formatDistributionDateTime } from "./distribution-shared.js"

export interface WebhookEventDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onChannelOpen?: (channelId: string) => void
}

const noop = () => {}

export function WebhookEventDetailPage({
  id,
  className,
  onBack = noop,
  onDeleted = noop,
  onChannelOpen = noop,
}: WebhookEventDetailPageProps) {
  const i18n = useDistributionUiI18nOrDefault()
  const { messages } = i18n
  const detail = messages.details.webhookEvent
  const client = useVoyantDistributionContext()
  const queryClient = useQueryClient()

  const eventQuery = useQuery({
    ...getWebhookEventQueryOptions(client, id),
    select: (result) => result.data,
  })
  const event = eventQuery.data

  const channelQuery = useQuery({
    ...getChannelQueryOptions(client, event?.channelId),
    select: (result) => result.data,
    enabled: Boolean(event?.channelId),
  })

  const remove = useMutation({
    mutationFn: () =>
      fetchWithValidation(`/v1/admin/distribution/webhook-events/${id}`, successEnvelope, client, {
        method: "DELETE", // i18n-literal-ok HTTP method
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: distributionQueryKeys.webhookEvents() })
      queryClient.removeQueries({ queryKey: distributionQueryKeys.webhookEvent(id) })
      onDeleted()
      onBack()
    },
  })

  if (eventQuery.isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!event) {
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
    <div data-slot="webhook-event-detail-page" className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{messages.common.webhookStatusLabels[event.status]}</Badge>
            <Badge variant="secondary">{event.eventType}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onChannelOpen(event.channelId)}>
            <Link2 className="mr-2 h-4 w-4" />
            {detail.openChannel}
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Webhook className="h-4 w-4" />
            <CardTitle>{detail.sections.details}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{messages.common.channelLabel}:</span>{" "}
              <span>{channelQuery.data?.name ?? event.channelId}</span>
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
