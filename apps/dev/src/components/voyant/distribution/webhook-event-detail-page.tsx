import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { formatDateTime } from "@voyantjs/distribution-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Link2, Loader2, Trash2, Webhook } from "lucide-react"
import { api } from "@/lib/api-client"
import {
  getDistributionWebhookEventChannelQueryOptions,
  getDistributionWebhookEventQueryOptions,
} from "./distribution-detail-query-options"

type DistributionWebhookEventDetailPageProps = {
  id: string
}

export function DistributionWebhookEventDetailPage({
  id,
}: DistributionWebhookEventDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
        <p className="text-muted-foreground">Webhook event not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          Back to Distribution
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
          <h1 className="text-2xl font-bold tracking-tight">Webhook Event</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {event.status}
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
            Open Channel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this webhook event?")) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Webhook className="h-4 w-4" />
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Channel:</span>{" "}
              <span>{channelQuery.data?.data.name ?? event.channelId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">External Event:</span>{" "}
              <span>{event.externalEventId ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Received:</span>{" "}
              <span>{formatDateTime(event.receivedAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Processed:</span>{" "}
              <span>{formatDateTime(event.processedAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              <span>{new Date(event.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{" "}
              <span>{new Date(event.updatedAt).toLocaleString()}</span>
            </div>
            {event.errorMessage ? (
              <div>
                <div className="mb-1 text-muted-foreground">Error</div>
                <div className="whitespace-pre-wrap rounded-md border p-3">
                  {event.errorMessage}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payload</CardTitle>
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
