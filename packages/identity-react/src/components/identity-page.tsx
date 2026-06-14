"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge, Button } from "@voyant-travel/ui/components"
import { DataTable } from "@voyant-travel/ui/components/data-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyant-travel/ui/components/tabs"
import { IdCard, Pencil, Plus, Star, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useIdentityUiMessagesOrDefault } from "../i18n/index.js"
import {
  type AddressRecord,
  type ContactPointRecord,
  type NamedContactRecord,
  useAddresses,
  useAddressMutation,
  useContactPointMutation,
  useContactPoints,
  useNamedContactMutation,
  useNamedContacts,
} from "../index.js"
import { AddressDialog } from "./address-dialog.js"
import { ContactPointDialog } from "./contact-point-dialog.js"
import { EntityRefPicker } from "./entity-ref-picker.js"
import { NamedContactDialog } from "./named-contact-dialog.js"

const PAGE_SIZE = 25

export type IdentityTab = "contact-points" | "addresses" | "named-contacts"

export interface IdentityPageProps {
  entityType?: string
  entityId?: string
  tab?: IdentityTab
  onScopeChange?: (scope: { entityType: string; entityId: string }) => void
  onTabChange?: (tab: IdentityTab) => void
}

export function IdentityPage({
  entityType,
  entityId,
  tab,
  onScopeChange,
  onTabChange,
}: IdentityPageProps = {}) {
  const messages = useIdentityUiMessagesOrDefault()
  const pageMessages = messages.identityPage
  const [innerEntityType, setInnerEntityType] = useState(entityType ?? "")
  const [innerEntityId, setInnerEntityId] = useState(entityId ?? "")
  const [innerTab, setInnerTab] = useState<IdentityTab>(tab ?? "contact-points")
  const activeEntityType = entityType ?? innerEntityType
  const activeEntityId = entityId ?? innerEntityId
  const activeTab = tab ?? innerTab
  const scopeReady = activeEntityType.trim().length > 0 && activeEntityId.trim().length > 0

  const updateScope = (next: { entityType?: string; entityId?: string }) => {
    const nextEntityType = next.entityType ?? activeEntityType
    const nextEntityId = next.entityId ?? activeEntityId
    if (entityType === undefined) setInnerEntityType(nextEntityType)
    if (entityId === undefined) setInnerEntityId(nextEntityId)
    onScopeChange?.({ entityType: nextEntityType, entityId: nextEntityId })
  }

  const updateTab = (next: IdentityTab) => {
    if (tab === undefined) setInnerTab(next)
    onTabChange?.(next)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <IdCard className="size-5 text-muted-foreground" aria-hidden="true" />
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
        <Tabs
          value={activeTab}
          onValueChange={(value) => updateTab(value as IdentityTab)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="contact-points">{pageMessages.tabs.contactPoints}</TabsTrigger>
            <TabsTrigger value="addresses">{pageMessages.tabs.addresses}</TabsTrigger>
            <TabsTrigger value="named-contacts">{pageMessages.tabs.namedContacts}</TabsTrigger>
          </TabsList>
          <TabsContent value="contact-points" className="mt-4">
            <ContactPointsTab entityType={activeEntityType} entityId={activeEntityId} />
          </TabsContent>
          <TabsContent value="addresses" className="mt-4">
            <AddressesTab entityType={activeEntityType} entityId={activeEntityId} />
          </TabsContent>
          <TabsContent value="named-contacts" className="mt-4">
            <NamedContactsTab entityType={activeEntityType} entityId={activeEntityId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export interface IdentityEntityTabProps {
  entityType: string
  entityId: string
}

export function ContactPointsTab({ entityType, entityId }: IdentityEntityTabProps) {
  const messages = useIdentityUiMessagesOrDefault()
  const tabMessages = messages.contactPointsTab
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ContactPointRecord | undefined>()
  const { data, isPending, refetch } = useContactPoints({
    entityType,
    entityId,
    limit: PAGE_SIZE,
    offset: 0,
    enabled: Boolean(entityType) && Boolean(entityId),
  })
  const { remove } = useContactPointMutation()

  const columns = useMemo<ColumnDef<ContactPointRecord>[]>(
    () => [
      {
        accessorKey: "kind",
        header: tabMessages.columns.kind,
        cell: ({ row }) => (
          <Badge variant="outline">
            {messages.common.contactPointKindLabels[row.original.kind]}
          </Badge>
        ),
      },
      {
        accessorKey: "value",
        header: tabMessages.columns.value,
        cell: ({ row }) => <span className="font-medium">{row.original.value}</span>,
      },
      {
        accessorKey: "label",
        header: tabMessages.columns.label,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.label ?? "-"}</span>
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
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ],
    [refetch, remove, messages.common.contactPointKindLabels, tabMessages],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
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
      />

      <ContactPointDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        contactPoint={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}

export function AddressesTab({ entityType, entityId }: IdentityEntityTabProps) {
  const messages = useIdentityUiMessagesOrDefault()
  const tabMessages = messages.addressesTab
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AddressRecord | undefined>()
  const { data, isPending, refetch } = useAddresses({
    entityType,
    entityId,
    limit: PAGE_SIZE,
    offset: 0,
    enabled: Boolean(entityType) && Boolean(entityId),
  })
  const { remove } = useAddressMutation()

  const columns = useMemo<ColumnDef<AddressRecord>[]>(
    () => [
      {
        accessorKey: "label",
        header: tabMessages.columns.label,
        cell: ({ row }) => (
          <Badge variant="outline">{messages.common.addressLabelLabels[row.original.label]}</Badge>
        ),
      },
      {
        accessorKey: "line1",
        header: tabMessages.columns.street,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.line1 ?? "-"}</span>
        ),
      },
      {
        accessorKey: "city",
        header: tabMessages.columns.city,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.city ?? "-"}</span>
        ),
      },
      {
        accessorKey: "country",
        header: tabMessages.columns.country,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.country ?? "-"}
          </span>
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
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ],
    [refetch, remove, messages.common.addressLabelLabels, tabMessages],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
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
      />

      <AddressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        address={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}

export function NamedContactsTab({ entityType, entityId }: IdentityEntityTabProps) {
  const messages = useIdentityUiMessagesOrDefault()
  const tabMessages = messages.namedContactsTab
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<NamedContactRecord | undefined>()
  const { data, isPending, refetch } = useNamedContacts({
    entityType,
    entityId,
    limit: PAGE_SIZE,
    offset: 0,
    enabled: Boolean(entityType) && Boolean(entityId),
  })
  const { remove } = useNamedContactMutation()

  const columns = useMemo<ColumnDef<NamedContactRecord>[]>(
    () => [
      {
        accessorKey: "role",
        header: tabMessages.columns.role,
        cell: ({ row }) => (
          <Badge variant="outline">
            {messages.common.namedContactRoleLabels[row.original.role]}
          </Badge>
        ),
      },
      {
        accessorKey: "name",
        header: tabMessages.columns.name,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "title",
        header: tabMessages.columns.title,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.title ?? "-"}</span>
        ),
      },
      {
        accessorKey: "email",
        header: tabMessages.columns.email,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email ?? "-"}</span>
        ),
      },
      {
        accessorKey: "phone",
        header: tabMessages.columns.phone,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.phone ?? "-"}</span>
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
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ],
    [refetch, remove, messages.common.namedContactRoleLabels, tabMessages],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
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
      />

      <NamedContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        namedContact={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
