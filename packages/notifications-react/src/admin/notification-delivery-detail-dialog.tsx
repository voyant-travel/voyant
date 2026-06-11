"use client"

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"
import { useNotificationDelivery } from "../index.js"

type NotificationDeliveryDetailDialogProps = {
  deliveryId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationDeliveryDetailDialog({
  deliveryId,
  open,
  onOpenChange,
}: NotificationDeliveryDetailDialogProps) {
  const messages = useNotificationsUiMessagesOrDefault()
  const t = messages.admin.deliveryDetail
  const { data, isPending, error } = useNotificationDelivery(deliveryId ?? "", {
    enabled: open && Boolean(deliveryId),
  })

  const delivery = data ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 pr-1">
          {isPending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {!isPending && error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error instanceof Error ? error.message : t.loadFailed}
            </div>
          ) : null}

          {!isPending && delivery ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard label={t.labels.to} value={delivery.toAddress} />
                <InfoCard
                  label={t.labels.template}
                  value={delivery.templateSlug ?? messages.admin.common.directTemplate}
                  mono
                />
                <InfoCard label={t.labels.provider} value={delivery.provider} />
                <div className="rounded-md border p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.labels.status}
                  </div>
                  <div className="mt-2">
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
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Section title={t.metadataTitle}>
                  <KeyValue label={t.labels.channel} value={delivery.channel} />
                  <KeyValue label={t.labels.from} value={delivery.fromAddress ?? "—"} />
                  <KeyValue label={t.labels.targetType} value={delivery.targetType} />
                  <KeyValue label={t.labels.targetId} value={delivery.targetId ?? "—"} mono />
                  <KeyValue
                    label={t.labels.providerMessageId}
                    value={delivery.providerMessageId ?? "—"}
                    mono
                  />
                  <KeyValue
                    label={t.labels.created}
                    value={new Date(delivery.createdAt).toLocaleString()}
                  />
                  <KeyValue
                    label={t.labels.sent}
                    value={delivery.sentAt ? new Date(delivery.sentAt).toLocaleString() : "—"}
                  />
                  <KeyValue
                    label={t.labels.failed}
                    value={delivery.failedAt ? new Date(delivery.failedAt).toLocaleString() : "—"}
                  />
                </Section>

                <Section title={t.renderedPayloadTitle}>
                  <KeyValue label={t.labels.subject} value={delivery.subject ?? "—"} />
                  <KeyValue label={t.labels.error} value={delivery.errorMessage ?? "—"} />
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t.labels.text}
                    </div>
                    <pre className="whitespace-pre-wrap rounded-md border bg-muted/20 px-3 py-3 text-xs">
                      {delivery.textBody ?? "—"}
                    </pre>
                  </div>
                </Section>
              </div>

              <Section title={t.htmlBodyTitle}>
                {delivery.htmlBody ? (
                  <div
                    className="prose prose-sm max-w-none rounded-md border bg-background px-4 py-4 dark:prose-invert"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: Notification HTML body is stored template output rendered for preview.
                    dangerouslySetInnerHTML={{ __html: delivery.htmlBody }}
                  />
                ) : (
                  <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    {t.noHtmlStored}
                  </div>
                )}
              </Section>

              <Section title={t.payloadDataTitle}>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted/20 px-3 py-3 text-xs">
                  {JSON.stringify(delivery.payloadData ?? {}, null, 2)}
                </pre>
              </Section>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

function InfoCard({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {/* i18n-literal-ok tailwind utilities behind a mono toggle, not user-facing copy. */}
      <div className={`mt-2 break-words text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  )
}

function KeyValue({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="grid gap-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {/* i18n-literal-ok tailwind utilities behind a mono toggle, not user-facing copy. */}
      <div className={`break-words text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  )
}
