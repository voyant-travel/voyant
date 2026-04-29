import { type QueryClient, useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { formatMessage } from "@voyantjs/i18n"
import {
  defaultFetcher,
  getLegalContractTemplatesQueryOptions,
  getLegalContractTemplateVersionsQueryOptions,
  type LegalContractTemplateRecord,
  useLegalContractTemplateMutation,
  useLegalContractTemplates,
} from "@voyantjs/legal-react"
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useState } from "react"

import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"

import { useRegistryLegalI18nOrDefault, useRegistryLegalMessagesOrDefault } from "./i18n/provider"
import { formatRegistryLegalDate } from "./i18n/utils"
import { TemplateDialog } from "./template-dialog"
import { TemplateVersionDialog } from "./template-version-dialog"

type EnsureQueryData = QueryClient["ensureQueryData"]
const SCOPES = ["customer", "supplier", "partner", "channel", "other"] as const

export function loadTemplatesPage(ensureQueryData: EnsureQueryData) {
  return ensureQueryData(
    getLegalContractTemplatesQueryOptions(
      { baseUrl: "", fetcher: defaultFetcher },
      { search: "", scope: "all" },
    ),
  )
}

export function TemplatesPage() {
  const navigate = useNavigate()
  const m = useRegistryLegalMessagesOrDefault()
  const [search, setSearch] = useState("")
  const [scope, setScope] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<LegalContractTemplateRecord | undefined>()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [versionDialogTemplateId, setVersionDialogTemplateId] = useState<string>("")
  const { remove } = useLegalContractTemplateMutation()

  const { data, isPending, refetch } = useLegalContractTemplates({ search, scope })

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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{m.templatesPage.title}</h1>
          <p className="text-sm text-muted-foreground">{m.templatesPage.description}</p>
        </div>
        <Button
          onClick={() => {
            setEditingTemplate(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {m.templatesPage.create}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={m.templatesPage.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={scope} onValueChange={(value) => setScope(value ?? "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={m.contractsPage.filters.scope} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.templatesPage.allScopes}</SelectItem>
            {SCOPES.map((item) => (
              <SelectItem key={item} value={item}>
                {m.common.contractScopeLabels[item]}
              </SelectItem>
            ))}
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
          <p className="text-sm text-muted-foreground">{m.templatesPage.empty}</p>
        </div>
      ) : null}

      {!isPending && data?.data && data.data.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.data.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              expanded={expandedIds.has(template.id)}
              onToggle={() => toggleExpand(template.id)}
              onOpen={() => {
                void navigate({ to: "/legal/templates/$id", params: { id: template.id } })
              }}
              onEdit={() => {
                setEditingTemplate(template)
                setDialogOpen(true)
              }}
              onDelete={() => {
                if (
                  confirm(
                    formatMessage(m.templatesPage.confirms.deleteTemplate, {
                      name: template.name,
                    }),
                  )
                ) {
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
      ) : null}

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        onSuccess={() => {
          setDialogOpen(false)
          setEditingTemplate(undefined)
          void refetch()
        }}
      />

      {versionDialogTemplateId ? (
        <TemplateVersionDialog
          open={versionDialogOpen}
          onOpenChange={setVersionDialogOpen}
          templateId={versionDialogTemplateId}
          onSuccess={() => {
            setVersionDialogOpen(false)
            void refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function TemplateRow({
  template,
  expanded,
  onToggle,
  onOpen,
  onEdit,
  onDelete,
  onAddVersion,
}: {
  template: LegalContractTemplateRecord
  expanded: boolean
  onToggle: () => void
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onAddVersion: () => void
}) {
  const i18n = useRegistryLegalI18nOrDefault()
  const m = useRegistryLegalMessagesOrDefault()
  const { data: versions } = useQuery({
    ...getLegalContractTemplateVersionsQueryOptions(
      { baseUrl: "", fetcher: defaultFetcher },
      { templateId: template.id },
    ),
    enabled: expanded,
  })

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="text-left text-sm font-medium hover:underline"
            >
              {template.name}
            </button>
            <span className="font-mono text-xs text-muted-foreground">{template.slug}</span>
            <Badge variant="outline">{m.common.contractScopeLabels[template.scope]}</Badge>
            <Badge variant={template.active ? "default" : "secondary"}>
              {template.active ? m.common.active : m.common.inactive}
            </Badge>
          </div>
          {template.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onOpen}>
            {m.common.open}
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {m.templatesPage.versions}
            </p>
            <Button variant="outline" size="sm" onClick={onAddVersion}>
              <Plus className="mr-1 h-3 w-3" />
              {m.common.addVersion}
            </Button>
          </div>

          {!versions || versions.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              {m.templatesPage.noVersions}
            </p>
          ) : (
            <div className="rounded border bg-background">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">{m.templatesPage.columns.version}</th>
                    <th className="p-2 text-left font-medium">
                      {m.templatesPage.columns.changelog}
                    </th>
                    <th className="p-2 text-left font-medium">
                      {m.templatesPage.columns.createdBy}
                    </th>
                    <th className="p-2 text-left font-medium">
                      {m.templatesPage.columns.createdAt}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((version) => (
                    <tr key={version.id} className="border-b last:border-b-0">
                      <td className="p-2 font-mono">v{version.version}</td>
                      <td className="p-2">{version.changelog ?? m.common.noResultsDash}</td>
                      <td className="p-2">{version.createdBy ?? m.common.noResultsDash}</td>
                      <td className="p-2">{formatRegistryLegalDate(i18n, version.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
