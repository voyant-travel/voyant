"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge, Button } from "@voyant-travel/ui/components"
import { DataTable } from "@voyant-travel/ui/components/data-table"
import { cn } from "@voyant-travel/ui/lib/utils"
import { ChevronLeft, ChevronRight, Link2, Pencil, Plus, Star, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useExternalRefsUiMessagesOrDefault } from "../i18n/index.js"
import { type ExternalRefRecord, useExternalRefMutation, useExternalRefs } from "../index.js"
import { EntityRefPicker } from "./entity-ref-picker.js"
import { ExternalRefDialog } from "./external-ref-dialog.js"

const PAGE_SIZE = 25

export interface ExternalRefsPageProps {
  entityType?: string
  entityId?: string
  onScopeChange?: (scope: { entityType: string; entityId: string }) => void
  className?: string
}

export function ExternalRefsPage({
  entityType,
  entityId,
  onScopeChange,
  className,
}: ExternalRefsPageProps = {}) {
  const messages = useExternalRefsUiMessagesOrDefault()
  const pageMessages = messages.externalRefsPage
  const [innerEntityType, setInnerEntityType] = useState(entityType ?? "")
  const [innerEntityId, setInnerEntityId] = useState(entityId ?? "")
  const activeEntityType = entityType ?? innerEntityType
  const activeEntityId = entityId ?? innerEntityId
  const scopeReady = activeEntityType.trim().length > 0 && activeEntityId.trim().length > 0

  const updateScope = (next: { entityType?: string; entityId?: string }) => {
    const nextEntityType = next.entityType ?? activeEntityType
    const nextEntityId = next.entityId ?? activeEntityId
    if (entityType === undefined) setInnerEntityType(nextEntityType)
    if (entityId === undefined) setInnerEntityId(nextEntityId)
    onScopeChange?.({ entityType: nextEntityType, entityId: nextEntityId })
  }

  return (
    <div data-slot="external-refs-page" className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-center gap-3">
        <Link2 className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">{pageMessages.description}</p>

      <EntityRefPicker
        entityType={activeEntityType}
        entityId={activeEntityId}
        onChange={updateScope}
        messages={{
          entityTypeLabel: pageMessages.fields.entityType,
          entityLabel: pageMessages.fields.entity,
          customEntityTypeLabel: pageMessages.fields.customEntityType,
          typePlaceholder: pageMessages.placeholders.entityType,
          entityPlaceholder: pageMessages.placeholders.entity,
          entityTypeLabels: pageMessages.entityTypeLabels,
        }}
      />

      {!scopeReady ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">{pageMessages.emptyScope}</p>
        </div>
      ) : (
        <ExternalRefsTab entityType={activeEntityType} entityId={activeEntityId} />
      )}
    </div>
  )
}

export interface ExternalRefsTabProps {
  entityType: string
  entityId: string
}

export function ExternalRefsTab({ entityType, entityId }: ExternalRefsTabProps) {
  const messages = useExternalRefsUiMessagesOrDefault()
  const tabMessages = messages.externalRefsTab
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ExternalRefRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useExternalRefs({
    entityType,
    entityId,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
    enabled: Boolean(entityType) && Boolean(entityId),
  })
  const { remove } = useExternalRefMutation()
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPreviousPage = pageIndex > 0
  const canNextPage = pageIndex + 1 < pageCount

  const columns = useMemo<ColumnDef<ExternalRefRecord>[]>(
    () => [
      {
        accessorKey: "sourceSystem",
        header: tabMessages.columns.sourceSystem,
        cell: ({ row }) => <span className="font-medium">{row.original.sourceSystem}</span>,
      },
      {
        accessorKey: "objectType",
        header: tabMessages.columns.objectType,
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.objectType}</span>,
      },
      {
        accessorKey: "externalId",
        header: tabMessages.columns.externalId,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.externalId}</span>,
      },
      {
        accessorKey: "namespace",
        header: tabMessages.columns.namespace,
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.namespace}</span>,
      },
      {
        accessorKey: "status",
        header: tabMessages.columns.status,
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "active" ? "default" : "outline"}
            className="capitalize"
          >
            {messages.common.refStatusLabels[row.original.status]}
          </Badge>
        ),
      },
      {
        accessorKey: "isPrimary",
        header: tabMessages.columns.primary,
        cell: ({ row }) =>
          row.original.isPrimary ? (
            <Star className="size-3.5 fill-current text-amber-500" aria-hidden="true" />
          ) : null,
      },
      {
        id: "actions",
        header: () => <div className="w-20" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setEditing(row.original)
                setDialogOpen(true)
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label={tabMessages.actions.edit}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(tabMessages.actions.deleteConfirm)) {
                  remove.mutate(row.original.id, { onSuccess: () => void refetch() })
                }
              }}
              className="text-muted-foreground hover:text-destructive"
              aria-label={tabMessages.actions.delete}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ],
    [refetch, remove, messages.common.refStatusLabels, tabMessages],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{tabMessages.description}</p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          {tabMessages.add}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        emptyMessage={isPending ? tabMessages.empty.loading : tabMessages.empty.none}
        pageSize={PAGE_SIZE}
        showPagination={false}
      />

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            {tabMessages.pagination.page} {pageIndex + 1} {tabMessages.pagination.of} {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setPageIndex((page) => Math.max(0, page - 1))}
            disabled={!canPreviousPage}
            aria-label={tabMessages.pagination.previous}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setPageIndex((page) => page + 1)}
            disabled={!canNextPage}
            aria-label={tabMessages.pagination.next}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      <ExternalRefDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        externalRef={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
