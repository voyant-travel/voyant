"use client"

import { formatMessage } from "@voyant-travel/i18n"
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components"
import { cn } from "@voyant-travel/ui/lib/utils"
import { AlertCircle, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useCustomFieldDefinitionMutation } from "../hooks/use-custom-field-definition-mutation.js"
import { useCustomFieldDefinitions } from "../hooks/use-custom-field-definitions.js"
import { useCustomFieldTargets } from "../hooks/use-custom-field-targets.js"
import { useCustomFieldsUiI18nOrDefault } from "../i18n/index.js"
import type { CustomFieldDefinitionRecord } from "../schemas.js"
import {
  CustomFieldDefinitionSheet,
  getCustomFieldTypeLabels,
} from "./custom-field-definition-sheet.js"

const PAGE_SIZE = 25
const ALL_ENTITIES = "all"
const ALL_OWNERS = "all"

export interface CustomFieldDefinitionsPageProps {
  className?: string
  pageSize?: number
}

export function CustomFieldDefinitionsPage({
  className,
  pageSize = PAGE_SIZE,
}: CustomFieldDefinitionsPageProps = {}) {
  const { messages } = useCustomFieldsUiI18nOrDefault()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CustomFieldDefinitionRecord | undefined>()
  const [deleting, setDeleting] = useState<CustomFieldDefinitionRecord | undefined>()
  const [entityFilter, setEntityFilter] = useState<string>(ALL_ENTITIES)
  const [ownerFilter, setOwnerFilter] = useState<string>(ALL_OWNERS)
  const [pageIndex, setPageIndex] = useState(0)
  const { remove } = useCustomFieldDefinitionMutation()
  const targets = useCustomFieldTargets()

  const query = useCustomFieldDefinitions({
    entityType: entityFilter === ALL_ENTITIES ? undefined : entityFilter,
    ownerKind:
      ownerFilter === ALL_OWNERS ? undefined : (ownerFilter as "platform" | "operator" | "app"),
    limit: pageSize,
    offset: pageIndex * pageSize,
  })

  const definitions = query.data?.data ?? []
  const total = query.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const entityLabels = Object.fromEntries(
    (targets.data?.data ?? []).map((target) => [target.id, target.label]),
  )
  const fieldTypeLabels = getCustomFieldTypeLabels(messages)

  return (
    <div
      data-slot="custom-field-definitions-page"
      className={cn("flex flex-col gap-6 p-6", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold tracking-tight">{messages.page.title}</h2>
          <p className="text-sm text-muted-foreground">{messages.page.description}</p>
        </div>
        <Button
          size="sm"
          disabled={targets.isPending || (targets.data?.data.length ?? 0) === 0}
          onClick={() => {
            setEditing(undefined)
            setSheetOpen(true)
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          {messages.page.addField}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {messages.page.entity}
        </Label>
        <Select
          value={entityFilter}
          onValueChange={(value) => {
            setEntityFilter(value ?? ALL_ENTITIES)
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ENTITIES}>{messages.page.allEntities}</SelectItem>
            {(targets.data?.data ?? []).map((target) => (
              <SelectItem key={target.id} value={target.id}>
                {target.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {messages.page.owner}
        </Label>
        <Select
          value={ownerFilter}
          onValueChange={(value) => {
            setOwnerFilter(value ?? ALL_OWNERS)
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_OWNERS}>{messages.page.allOwners}</SelectItem>
            <SelectItem value="operator">{messages.page.operatorOwned}</SelectItem>
            <SelectItem value="app">{messages.page.appOwned}</SelectItem>
            <SelectItem value="platform">{messages.page.platformOwned}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {messages.page.loadFailed}{" "}
            {query.error instanceof Error ? query.error.message : messages.page.requestFailed}
          </AlertDescription>
        </Alert>
      ) : query.isPending ? (
        <CustomFieldDefinitionsSkeleton />
      ) : (
        <div className="rounded-md border bg-card text-card-foreground shadow-sm">
          {definitions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <p className="text-sm font-medium">{messages.page.emptyTitle}</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {messages.page.emptyDescription}
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y">
              {definitions.map((definition) => {
                const isOperatorOwned =
                  definition.ownerKind === "operator" && definition.namespace === "custom"
                const ownerLabel =
                  definition.ownerKind === "operator"
                    ? messages.page.operatorOwned
                    : definition.ownerKind === "app"
                      ? messages.page.appOwned
                      : messages.page.platformOwned
                return (
                  <div
                    key={definition.id}
                    className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{definition.label}</span>
                        <Badge variant="outline">
                          {entityLabels[definition.entityType] ?? definition.entityType}
                        </Badge>
                        <Badge variant="secondary">
                          {fieldTypeLabels[definition.fieldType] ?? definition.fieldType}
                        </Badge>
                        <Badge variant="outline">{ownerLabel}</Badge>
                        {!isOperatorOwned ? (
                          <Badge variant="outline">{messages.page.readOnly}</Badge>
                        ) : null}
                        {definition.isRequired ? <Badge>{messages.page.required}</Badge> : null}
                        {definition.isSearchable ? (
                          <Badge variant="outline">{messages.page.searchable}</Badge>
                        ) : null}
                        {definition.isExportable ? (
                          <Badge variant="outline">{messages.page.exportable}</Badge>
                        ) : null}
                        {definition.isInvoiceable ? (
                          <Badge variant="outline">{messages.page.invoiceable}</Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{definition.key}</span>
                        <span>
                          {messages.page.namespace}:{" "}
                          <span className="font-mono">{definition.namespace}</span>
                        </span>
                        {definition.ownerId ? (
                          <span className="font-mono">{definition.ownerId}</span>
                        ) : null}
                        {definition.options?.length ? (
                          <span>
                            {formatMessage(messages.page.optionsCount, {
                              count: definition.options.length,
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {isOperatorOwned ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(definition)
                              setSheetOpen(true)
                            }}
                          >
                            <Pencil className="size-4" />
                            {messages.page.edit}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={remove.isPending}
                            onClick={() => setDeleting(definition)}
                          >
                            <Trash2 className="size-4" />
                            {messages.page.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>
          {formatMessage(messages.page.paginationSummary, {
            shown: definitions.length,
            total,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
          >
            {messages.page.previous}
          </Button>
          <span>
            {formatMessage(messages.page.paginationPage, { page: pageIndex + 1, pageCount })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(pageIndex + 1) * pageSize >= total}
            onClick={() => setPageIndex((current) => current + 1)}
          >
            {messages.page.next}
          </Button>
        </div>
      </div>

      <CustomFieldDefinitionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        definition={editing}
        targets={targets.data?.data ?? []}
        onSuccess={() => {
          setSheetOpen(false)
          setEditing(undefined)
          void query.refetch()
        }}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{messages.page.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage(messages.page.deleteDescription, { label: deleting?.label ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {messages.page.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending || !deleting}
              onClick={async () => {
                if (!deleting) return
                await remove.mutateAsync(deleting.id)
                setDeleting(undefined)
                void query.refetch()
              }}
            >
              {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {messages.page.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CustomFieldDefinitionsSkeleton() {
  const rows = ["first", "second", "third", "fourth", "fifth"]

  return (
    <div className="rounded-md border bg-card text-card-foreground shadow-sm">
      {rows.map((row) => (
        <div
          key={row}
          className="flex items-center justify-between border-b px-6 py-4 last:border-b-0"
        >
          <div className="space-y-2">
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-3 w-72 rounded bg-muted" />
          </div>
          <div className="h-8 w-8 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
