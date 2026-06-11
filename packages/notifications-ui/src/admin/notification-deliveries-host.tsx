"use client"

import {
  type NotificationDeliveryRecord,
  type UseNotificationDeliveriesOptions,
  useNotificationDeliveries,
  useNotificationDeliveryMutation,
} from "@voyantjs/notifications-react"
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Loader2, RotateCcw, Search } from "lucide-react"
import { useState } from "react"

/**
 * Packaged admin host for the notification deliveries page (packaged-admin
 * RFC Phase 3). Zero-prop: filter state stays component-local and the
 * details dialog is in-page — no cross-route navigation.
 */
export function NotificationDeliveriesHost() {
  const [channel, setChannel] = useState<UseNotificationDeliveriesOptions["channel"] | "all">("all")
  const [status, setStatus] = useState<UseNotificationDeliveriesOptions["status"] | "all">("all")
  const [selectedDelivery, setSelectedDelivery] = useState<NotificationDeliveryRecord | null>(null)
  const deliveryMutation = useNotificationDeliveryMutation()
  const selectedDeliveryId = selectedDelivery?.id
  const { data, isPending } = useNotificationDeliveries({
    channel: channel === "all" ? undefined : channel,
    status: status === "all" ? undefined : status,
    limit: 50,
    offset: 0,
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deliveries</h1>
        <p className="text-sm text-muted-foreground">
          Review notification delivery attempts, rendered payloads, and provider-level outcomes.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={channel} onValueChange={(value) => setChannel(value ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {!isPending && (!data?.data || data.data.length === 0) ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No deliveries yet.</p>
        </div>
      ) : null}

      {!isPending && data?.data && data.data.length > 0 ? (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Logs</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((delivery) => (
                <tr key={delivery.id} className="border-t">
                  <td className="px-4 py-3">
                    <div>{delivery.toAddress}</div>
                    {delivery.subject ? (
                      <div className="text-xs text-muted-foreground">{delivery.subject}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {delivery.templateSlug ?? "direct"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{delivery.channel}</Badge>
                  </td>
                  <td className="px-4 py-3">{delivery.provider}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        delivery.status === "sent"
                          ? "default"
                          : delivery.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {delivery.status}
                    </Badge>
                    {delivery.status === "failed" && delivery.errorMessage ? (
                      <div className="mt-1 max-w-[280px] truncate text-destructive text-xs">
                        {delivery.errorMessage}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{new Date(delivery.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {delivery.status === "failed" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={deliveryMutation.resend.isPending}
                          onClick={() => {
                            deliveryMutation.resend.mutate(delivery.id, {
                              onError(error) {
                                window.alert(
                                  error instanceof Error
                                    ? error.message
                                    : "Notification resend failed",
                                )
                              },
                            })
                          }}
                        >
                          {deliveryMutation.resend.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-2 h-4 w-4" />
                          )}
                          Resend
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDelivery(delivery)}
                      >
                        <Search className="mr-2 h-4 w-4" />
                        Details
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <DeliveryDetailsDialog
        delivery={selectedDelivery}
        open={Boolean(selectedDelivery)}
        onOpenChange={(open) => {
          if (!open) setSelectedDelivery(null)
        }}
        onResend={
          selectedDelivery?.status === "failed" && selectedDeliveryId
            ? () => {
                deliveryMutation.resend.mutate(selectedDeliveryId, {
                  onError(error) {
                    window.alert(
                      error instanceof Error ? error.message : "Notification resend failed",
                    )
                  },
                })
              }
            : undefined
        }
        isResending={deliveryMutation.resend.isPending}
      />
    </div>
  )
}

function DeliveryDetailsDialog({
  delivery,
  open,
  onOpenChange,
  onResend,
  isResending = false,
}: {
  delivery: NotificationDeliveryRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onResend?: () => void
  isResending?: boolean
}) {
  if (!delivery) return null

  const failureLog = readRecord(delivery.metadata?.failureLog)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="space-y-2">
              <DialogTitle>Delivery details</DialogTitle>
              <DialogDescription>
                Provider response, failure log, rendered content, and payload for this notification.
              </DialogDescription>
            </div>
            {onResend ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isResending}
                onClick={onResend}
              >
                {isResending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Resend
              </Button>
            ) : null}
          </div>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <Detail label="Delivery ID" value={delivery.id} mono />
            <Detail label="Status" value={delivery.status} />
            <Detail label="Provider" value={delivery.provider} />
            <Detail label="Provider message ID" value={delivery.providerMessageId ?? "—"} mono />
            <Detail label="Template" value={delivery.templateSlug ?? "direct"} mono />
            <Detail label="Channel" value={delivery.channel} />
            <Detail label="Created" value={formatDateTime(delivery.createdAt)} />
            <Detail label="Failed" value={formatDateTime(delivery.failedAt)} />
            <Detail label="Sent" value={formatDateTime(delivery.sentAt)} />
            <Detail label="Scheduled" value={formatDateTime(delivery.scheduledFor)} />
          </section>

          {delivery.errorMessage ? (
            <LogSection title="Error message" tone="destructive">
              {delivery.errorMessage}
            </LogSection>
          ) : null}

          {failureLog ? (
            <JsonSection title="Failure log" value={failureLog} />
          ) : delivery.status === "failed" ? (
            <LogSection title="Failure log">No structured failure log was captured.</LogSection>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2">
            <Detail label="To" value={delivery.toAddress} />
            <Detail label="From" value={delivery.fromAddress ?? "—"} />
            <Detail label="Subject" value={delivery.subject ?? "—"} />
            <Detail label="Target" value={formatTarget(delivery)} mono />
          </section>

          <JsonSection title="Payload data" value={delivery.payloadData} />
          <JsonSection title="Metadata" value={delivery.metadata} />
          <BodySection title="Text body" value={delivery.textBody} />
          <BodySection title="HTML body" value={delivery.htmlBody} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div className={`mt-1 break-words text-sm ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  )
}

function LogSection({
  title,
  children,
  tone,
}: {
  title: string
  children: string
  tone?: "destructive"
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-medium text-sm">{title}</h2>
      <pre
        className={`max-h-56 overflow-auto rounded-md border p-3 text-xs ${
          tone === "destructive" ? "border-destructive/30 bg-destructive/10" : "bg-muted/30"
        }`}
      >
        {children}
      </pre>
    </section>
  )
}

function JsonSection({ title, value }: { title: string; value: unknown }) {
  if (!value) return null
  return <LogSection title={title}>{JSON.stringify(value, null, 2)}</LogSection>
}

function BodySection({ title, value }: { title: string; value: string | null }) {
  if (!value) return null
  return <LogSection title={title}>{value}</LogSection>
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—"
}

function formatTarget(delivery: NotificationDeliveryRecord) {
  const targetId =
    delivery.bookingId ??
    delivery.invoiceId ??
    delivery.paymentSessionId ??
    delivery.personId ??
    delivery.organizationId ??
    delivery.targetId

  return targetId ? `${delivery.targetType}:${targetId}` : delivery.targetType
}
