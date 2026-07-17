"use client"

import { formatMessage } from "@voyant-travel/i18n"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Separator,
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"

import type { AppsUiMessages } from "../i18n/messages.js"
import type { AppPurgePreview } from "../schemas.js"

export function UninstallDialog({
  open,
  appName,
  messages,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean
  appName: string
  messages: AppsUiMessages
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = messages.detail
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{t.uninstallTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {formatMessage(t.uninstallDescription, { name: appName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{t.uninstallRetained}</p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{messages.common.cancel}</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t.uninstall}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function PurgeDialog({
  open,
  appName,
  messages,
  preview,
  loadingPreview,
  onLoadPreview,
  onCancel,
}: {
  open: boolean
  appName: string
  messages: AppsUiMessages
  preview: AppPurgePreview | null
  loadingPreview: boolean
  onLoadPreview: () => void
  onCancel: () => void
}) {
  const t = messages.detail
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{t.purgeTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {formatMessage(t.purgeDescription, { name: appName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {preview ? (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{t.purgePreviewTitle}</p>
            <Separator />
            <PurgeRow label={t.purgePreviewGrants} value={preview.grants} />
            <PurgeRow label={t.purgePreviewCredentials} value={preview.credentials} />
            <PurgeRow label={t.purgePreviewExtensions} value={preview.extensions} />
            <PurgeRow label={t.purgePreviewWebhooks} value={preview.webhooks} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.uninstallRetained}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{messages.common.cancel}</AlertDialogCancel>
          {preview ? (
            <AlertDialogAction variant="destructive" disabled>
              {t.purgeConfirm}
            </AlertDialogAction>
          ) : (
            <Button disabled={loadingPreview} onClick={onLoadPreview}>
              {loadingPreview ? <Loader2 className="size-4 animate-spin" /> : null}
              {t.purgeReviewFirst}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function PurgeRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}
