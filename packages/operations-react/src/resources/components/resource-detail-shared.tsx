"use client"

import { formatMessage } from "@voyant-travel/i18n"
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@voyant-travel/ui/components"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import { useResourcesUiMessagesOrDefault } from "../i18n/index.js"

export type ConfirmAction = (message: string) => boolean

export const defaultConfirmAction: ConfirmAction = (message) =>
  globalThis.confirm?.(message) ?? true

export function ResourceDetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

export function ResourceDetailState({
  className,
  message,
  onBack,
}: {
  className?: string
  message: string
  onBack?: () => void
}) {
  const messages = useResourcesUiMessagesOrDefault()

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-12", className)}>
      <p className="text-muted-foreground">{message}</p>
      {onBack ? (
        <Button variant="outline" onClick={onBack}>
          {messages.detailPages.common.backToResources}
        </Button>
      ) : null}
    </div>
  )
}

export function ResourceDetailCard({
  children,
  className,
  title,
}: {
  children: ReactNode
  className?: string
  title: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">{children}</CardContent>
    </Card>
  )
}

export function ResourceDetailHeader({
  actions,
  badges,
  className,
  confirmAction = defaultConfirmAction,
  deleteConfirmName,
  deleteConfirmTemplate,
  deleteErrorMessage,
  deleting: deletingProp,
  onBack,
  onDelete,
  onEdit,
  title,
}: {
  actions?: ReactNode
  badges?: ReactNode
  className?: string
  confirmAction?: ConfirmAction
  deleteConfirmName: string
  deleteConfirmTemplate: string
  deleteErrorMessage: string
  deleting?: boolean
  onBack?: () => void
  onDelete?: () => Promise<void> | void
  onEdit?: () => void
  title: string
}) {
  const messages = useResourcesUiMessagesOrDefault()
  const [deletingState, setDeletingState] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleting = deletingProp || deletingState

  async function handleDelete() {
    if (!onDelete) return
    setDeleteError(null)
    const confirmed = confirmAction(
      formatMessage(deleteConfirmTemplate, { name: deleteConfirmName }),
    )
    if (!confirmed) return

    setDeletingState(true)
    try {
      await onDelete()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : deleteErrorMessage)
    } finally {
      setDeletingState(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {onBack ? (
            <Button type="button" variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              <span className="sr-only">{messages.detailPages.common.backToResources}</span>
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
            {badges ? <div className="mt-1 flex flex-wrap items-center gap-2">{badges}</div> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {onEdit ? (
            <Button type="button" variant="outline" onClick={onEdit}>
              <Pencil data-icon="inline-start" aria-hidden="true" />
              {messages.detailPages.common.edit}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 data-icon="inline-start" aria-hidden="true" />
              )}
              {messages.detailPages.common.delete}
            </Button>
          ) : null}
        </div>
      </div>
      {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
    </div>
  )
}

export function ResourceDetailSkeleton({
  actionCount,
  detailRows,
  showNotes = true,
  stackedCards = 2,
}: {
  actionCount: number
  detailRows: number
  showNotes?: boolean
  stackedCards?: number
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-9 rounded-md" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        {Array.from({ length: actionCount }).map((_, index) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: resources-react; existing suppression is intentional pending typed cleanup.
            key={index}
            className="h-9 w-28"
          />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: detailRows }).map((_, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: resources-react; existing suppression is intentional pending typed cleanup.
                key={index}
                className="flex items-center gap-2"
              >
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3.5 w-40" />
              </div>
            ))}
          </CardContent>
        </Card>
        {showNotes ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3.5 w-2/3" />
            </CardContent>
          </Card>
        ) : null}
      </div>

      {Array.from({ length: stackedCards }).map((_, cardIndex) => (
        <Card
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: resources-react; existing suppression is intentional pending typed cleanup.
          key={cardIndex}
        >
          <CardHeader className="flex flex-row items-center gap-2">
            <Skeleton className="size-4" />
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, rowIndex) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholder -- owner: resources-react; existing suppression is intentional pending typed cleanup.
                key={rowIndex}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
