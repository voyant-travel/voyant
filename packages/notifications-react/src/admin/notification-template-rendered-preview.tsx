import type { NotificationsUiMessages } from "../i18n/index.js"

type RenderedPreviewData = {
  subject?: string | null
  html?: string | null
  text?: string | null
}

type NotificationTemplateRenderedPreviewProps = {
  channel: "email" | "sms"
  data: RenderedPreviewData | null | undefined
  t: NotificationsUiMessages["admin"]["templateDialog"]
}

export function NotificationTemplateRenderedPreview({
  channel,
  data,
  t,
}: NotificationTemplateRenderedPreviewProps) {
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="text-sm font-medium">{t.renderedPreviewTitle}</div>

      {channel === "email" ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t.renderedSubjectLabel}
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
              {data?.subject || t.noSubjectRendered}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t.renderedHtmlLabel}
            </div>
            <div className="rounded-md border bg-background">
              {data?.html ? (
                <div
                  className="prose prose-sm max-w-none px-3 py-3 dark:prose-invert"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Preview HTML is generated server-side for template preview. -- owner: notifications-react; existing suppression is intentional pending typed cleanup.
                  dangerouslySetInnerHTML={{ __html: data.html }}
                />
              ) : (
                <div className="px-3 py-3 text-sm text-muted-foreground">{t.noHtmlRendered}</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t.renderedSmsLabel}
          </div>
          <pre className="whitespace-pre-wrap rounded-md border bg-muted/20 px-3 py-3 text-xs">
            {data?.text || t.noSmsRendered}
          </pre>
        </div>
      )}
    </div>
  )
}
