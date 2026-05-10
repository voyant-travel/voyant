import { formatMessage } from "@voyantjs/i18n"
import {
  type LegalContractTemplateRecord,
  useLegalContractTemplateMutation,
  useLegalContractTemplates,
  useLegalContractTemplateVersions,
} from "@voyantjs/legal-react"
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { cn } from "@voyantjs/ui/lib/utils"
import { ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import { useLegalUiI18nOrDefault, useLegalUiMessagesOrDefault } from "../i18n/index.js"
import { legalContractScopes } from "../i18n/messages.js"

const SCOPE_ALL = "__all__"

export interface TemplateDialogRenderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: LegalContractTemplateRecord
  onSuccess: () => void
}

export interface TemplateVersionDialogRenderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: string
  onSuccess: () => void
}

export interface TemplatesPageProps {
  className?: string
  onOpenTemplate?: (templateId: string) => void
  renderTemplateDialog?: (props: TemplateDialogRenderProps) => ReactNode
  renderTemplateVersionDialog?: (props: TemplateVersionDialogRenderProps) => ReactNode
}

export function TemplatesPage({
  className,
  onOpenTemplate,
  renderTemplateDialog,
  renderTemplateVersionDialog,
}: TemplatesPageProps = {}) {
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.templatesPage
  const [search, setSearch] = useState("")
  const [scope, setScope] = useState<string>(SCOPE_ALL)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<LegalContractTemplateRecord | undefined>()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [versionDialogTemplateId, setVersionDialogTemplateId] = useState<string>("")
  const { remove } = useLegalContractTemplateMutation()

  const { data, isPending, isFetching, isError, refetch } = useLegalContractTemplates({
    search,
    scope: scope === SCOPE_ALL ? "all" : scope,
  })

  const templates = data?.data ?? []
  const showSkeleton = isPending || (isFetching && templates.length === 0)
  const canEditTemplates = !!renderTemplateDialog
  const canAddVersions = !!renderTemplateVersionDialog

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{f.title}</h1>
          <p className="text-sm text-muted-foreground">{f.description}</p>
        </div>
        {renderTemplateDialog ? (
          <Button
            onClick={() => {
              setEditingTemplate(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {f.create}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] max-w-sm flex-1">
          <Label htmlFor="templates-search" className="sr-only">
            {f.searchPlaceholder}
          </Label>
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="templates-search"
            placeholder={f.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={scope} onValueChange={(value) => setScope(value ?? SCOPE_ALL)}>
          <SelectTrigger className="w-[12.5rem]">
            <SelectValue placeholder={f.filters.scope} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SCOPE_ALL}>{f.filters.allScopes}</SelectItem>
            {legalContractScopes.map((value) => (
              <SelectItem key={value} value={value}>
                {messages.common.contractScopeLabels[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSkeleton ? (
        <TemplatesSkeleton />
      ) : isError ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-destructive">{f.loadFailed}</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{f.empty}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              expanded={expandedIds.has(template.id)}
              canEdit={canEditTemplates}
              canAddVersion={canAddVersions}
              onToggle={() => toggleExpand(template.id)}
              onOpen={onOpenTemplate ? () => onOpenTemplate(template.id) : undefined}
              onEdit={() => {
                setEditingTemplate(template)
                setDialogOpen(true)
              }}
              onDelete={() => {
                if (confirm(formatMessage(f.deleteConfirm, { name: template.name }))) {
                  remove.mutate(template.id, { onSuccess: () => void refetch() })
                }
              }}
              onAddVersion={() => {
                setVersionDialogTemplateId(template.id)
                setVersionDialogOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {renderTemplateDialog?.({
        open: dialogOpen,
        onOpenChange: setDialogOpen,
        template: editingTemplate,
        onSuccess: () => {
          setDialogOpen(false)
          setEditingTemplate(undefined)
          void refetch()
        },
      })}

      {versionDialogTemplateId
        ? renderTemplateVersionDialog?.({
            open: versionDialogOpen,
            onOpenChange: setVersionDialogOpen,
            templateId: versionDialogTemplateId,
            onSuccess: () => {
              setVersionDialogOpen(false)
              void refetch()
            },
          })
        : null}
    </div>
  )
}

function TemplateRow({
  template,
  expanded,
  canEdit,
  canAddVersion,
  onToggle,
  onOpen,
  onEdit,
  onDelete,
  onAddVersion,
}: {
  template: LegalContractTemplateRecord
  expanded: boolean
  canEdit: boolean
  canAddVersion: boolean
  onToggle: () => void
  onOpen?: () => void
  onEdit: () => void
  onDelete: () => void
  onAddVersion: () => void
}) {
  const messages = useLegalUiMessagesOrDefault()
  const scopeLabel =
    messages.common.contractScopeLabels[
      template.scope as keyof typeof messages.common.contractScopeLabels
    ] ?? template.scope

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="size-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4" aria-hidden="true" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              disabled={!onOpen}
              className={cn(
                "text-left text-sm font-medium",
                onOpen && "hover:underline",
                !onOpen && "cursor-default",
              )}
            >
              {template.name}
            </button>
            <span className="font-mono text-xs text-muted-foreground">{template.slug}</span>
            <Badge variant="outline">{scopeLabel}</Badge>
            <Badge variant={template.active ? "default" : "secondary"}>
              {template.active ? messages.common.active : messages.common.inactive}
            </Badge>
          </div>
          {template.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {onOpen ? (
            <Button variant="ghost" size="sm" onClick={onOpen}>
              {messages.common.open}
            </Button>
          ) : null}
          {canEdit ? (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {expanded ? (
        <TemplateVersions
          templateId={template.id}
          canAddVersion={canAddVersion}
          onAddVersion={onAddVersion}
        />
      ) : null}
    </div>
  )
}

function TemplateVersions({
  templateId,
  canAddVersion,
  onAddVersion,
}: {
  templateId: string
  canAddVersion: boolean
  onAddVersion: () => void
}) {
  const i18n = useLegalUiI18nOrDefault()
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.templatesPage
  const { data: versions, isPending } = useLegalContractTemplateVersions({
    templateId,
    enabled: true,
  })

  return (
    <div className="border-t bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {f.versions}
        </p>
        {canAddVersion ? (
          <Button variant="outline" size="sm" onClick={onAddVersion}>
            <Plus className="mr-1 size-3" aria-hidden="true" />
            {messages.common.addVersion}
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <div className="rounded border bg-background">
          <Table>
            <TableBody>
              <TemplateVersionRowSkeleton rows={3} />
            </TableBody>
          </Table>
        </div>
      ) : !versions || versions.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">{f.noVersions}</p>
      ) : (
        <div className="rounded border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{f.columns.version}</TableHead>
                <TableHead className="text-xs">{f.columns.changelog}</TableHead>
                <TableHead className="text-xs">{f.columns.createdBy}</TableHead>
                <TableHead className="text-xs">{f.columns.createdAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => (
                <TableRow key={version.id}>
                  <TableCell className="font-mono text-xs">v{version.version}</TableCell>
                  <TableCell className="text-xs">
                    {version.changelog ?? messages.common.noResultsDash}
                  </TableCell>
                  <TableCell className="text-xs">
                    {version.createdBy ?? messages.common.noResultsDash}
                  </TableCell>
                  <TableCell className="text-xs">{i18n.formatDate(version.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function TemplatesSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are stable
        <div key={`template-skeleton-${index}`} className="rounded-md border p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="size-4" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TemplateVersionRowSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are stable
        <TableRow key={`template-version-skeleton-${index}`}>
          <TableCell>
            <Skeleton className="h-3 w-12" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-24" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
