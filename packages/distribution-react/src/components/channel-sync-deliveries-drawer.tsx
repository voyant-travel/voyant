import { useQuery } from "@tanstack/react-query"
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"

import type { useDistributionUiMessagesOrDefault } from "../i18n/index.js"
import type { VoyantFetcher } from "../index.js"
import {
  channelPushAdminPaths,
  type DeliveriesResponse,
  fetchJson,
  formatRelative,
  formatTemplate,
} from "./channel-sync-page-utils.js"

export function DeliveriesDrawer({
  bookingId,
  bookingItemId,
  client,
  onClose,
  messages,
}: {
  bookingId: string | null
  bookingItemId?: string | null
  client: { baseUrl: string; fetcher: VoyantFetcher }
  onClose: () => void
  messages: ReturnType<typeof useDistributionUiMessagesOrDefault>["channelSync"]
}) {
  const isOpen = bookingId !== null
  const query = useQuery<DeliveriesResponse>({
    enabled: isOpen,
    queryKey: ["channel-push-deliveries", bookingId],
    queryFn: () => {
      const params = new URLSearchParams({ bookingId: bookingId ?? "", limit: "200" })
      return fetchJson<DeliveriesResponse>(`${channelPushAdminPaths.deliveries}?${params}`, client)
    },
  })

  const rows = query.data?.data ?? []

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle>
            {formatTemplate(messages.drawer.title, { bookingId: bookingId ?? "" })}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {bookingItemId
              ? formatTemplate(messages.drawer.itemScopeDescription, { itemId: bookingItemId })
              : messages.drawer.bookingScopeDescription}
          </p>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          {query.isPending ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{messages.drawer.emptyTitle}</EmptyTitle>
                <EmptyDescription>{messages.drawer.emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            rows.map((row) => (
              <Card key={row.id} className="text-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={row.status === "succeeded" ? "default" : "destructive"}>
                        {row.status}
                      </Badge>
                      <span className="font-mono">{row.sourceEvent}</span>
                      <span className="text-muted-foreground">
                        {formatTemplate(messages.drawer.attempt, { number: row.attemptNumber })}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {row.durationMs != null ? `${row.durationMs}ms` : ""}
                    </span>
                  </div>
                  <CardDescription className="font-mono">
                    {row.requestMethod} {row.targetUrl}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {row.responseStatus != null ? (
                      <Badge variant="outline">
                        {formatTemplate(messages.drawer.httpStatus, { status: row.responseStatus })}
                      </Badge>
                    ) : null}
                    {row.errorClass ? <Badge variant="destructive">{row.errorClass}</Badge> : null}
                    <span className="text-muted-foreground">{formatRelative(row.createdAt)}</span>
                  </div>
                  {row.errorMessage ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-destructive/10 p-2 text-destructive">
                      {row.errorMessage}
                    </pre>
                  ) : null}
                  {row.responseBodyExcerpt ? (
                    <pre className="overflow-x-auto rounded bg-muted p-2">
                      {row.responseBodyExcerpt}
                    </pre>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
