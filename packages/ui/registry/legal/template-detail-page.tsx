import { type QueryClient, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { formatMessage } from "@voyantjs/i18n"
import {
  defaultFetcher,
  getLegalContractTemplateQueryOptions,
  getLegalContractTemplateVersionsQueryOptions,
  type LegalContractTemplateVersionRecord,
  legalQueryKeys,
  useLegalContractTemplate,
  useLegalContractTemplateAuthoring,
  useLegalContractTemplateMutation,
  useLegalContractTemplateVersions,
} from "@voyantjs/legal-react"
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ContractTemplateAuthoringHelp,
} from "@/components/ui"

import { useRegistryLegalI18nOrDefault, useRegistryLegalMessagesOrDefault } from "./i18n/provider"
import { formatRegistryLegalDate, formatRegistryLegalDateTime } from "./i18n/utils"
import { TemplateDialog } from "./template-dialog"
import { TemplateVersionDialog } from "./template-version-dialog"

type EnsureQueryData = QueryClient["ensureQueryData"]

export function loadTemplateDetailPage(id: string, ensureQueryData: EnsureQueryData) {
  return Promise.all([
    ensureQueryData(
      getLegalContractTemplateQueryOptions({ baseUrl: "", fetcher: defaultFetcher }, id),
    ),
    ensureQueryData(
      getLegalContractTemplateVersionsQueryOptions(
        { baseUrl: "", fetcher: defaultFetcher },
        { templateId: id },
      ),
    ),
  ])
}

export function TemplateDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const i18n = useRegistryLegalI18nOrDefault()
  const m = useRegistryLegalMessagesOrDefault()
  const { remove } = useLegalContractTemplateMutation()
  const { variableCatalog, liquidSnippets } = useLegalContractTemplateAuthoring()
  const [editOpen, setEditOpen] = useState(false)
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const variableGroups = useMemo(
    () =>
      variableCatalog.map((group) => ({
        ...group,
        variables: group.variables.map((variable) => ({
          ...variable,
          example: String(variable.example),
        })),
      })),
    [variableCatalog],
  )

  const { data: template, isPending } = useLegalContractTemplate(id)
  const { data: versions } = useLegalContractTemplateVersions({ templateId: id })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{m.templateDetailPage.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/legal/templates" })}>
          {m.templateDetailPage.backToTemplates}
        </Button>
      </div>
    )
  }

  const currentVersion =
    versions?.find((version) => version.id === template.currentVersionId) ?? versions?.[0] ?? null

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate({ to: "/legal/templates" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{template.slug}</span>
            <Badge variant="outline">{m.common.contractScopeLabels[template.scope]}</Badge>
            <Badge variant={template.active ? "default" : "secondary"}>
              {template.active ? m.common.active : m.common.inactive}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {m.common.edit}
          </Button>
          <Button size="sm" onClick={() => setVersionDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {m.templateDetailPage.actions.addVersion}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (
                confirm(
                  formatMessage(m.templateDetailPage.confirms.deleteTemplate, {
                    name: template.name,
                  }),
                )
              ) {
                remove.mutate(template.id, {
                  onSuccess: () => {
                    void navigate({ to: "/legal/templates" })
                  },
                })
              }
            }}
            disabled={remove.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {m.common.delete}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{m.templateDetailPage.sections.details}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{m.templateDetailPage.fields.language}:</span>{" "}
              <span>{template.language}</span>
            </div>
            {template.currentVersionId ? (
              <div>
                <span className="text-muted-foreground">
                  {m.templateDetailPage.fields.currentVersionId}:
                </span>{" "}
                <span className="font-mono text-xs">{template.currentVersionId}</span>
              </div>
            ) : null}
            <div>
              <span className="text-muted-foreground">{m.templateDetailPage.fields.created}:</span>{" "}
              <span>{formatRegistryLegalDate(i18n, template.createdAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{m.templateDetailPage.fields.updated}:</span>{" "}
              <span>{formatRegistryLegalDate(i18n, template.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{m.templateDetailPage.sections.description}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {template.description?.trim()
              ? template.description
              : m.templateDetailPage.empty.noDescription}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m.templateDetailPage.sections.currentBody}</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateBodyPreview body={template.body} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.templateDetailPage.sections.variables}</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractTemplateAuthoringHelp
            title={m.authoringHelp.title}
            description={m.templateDetailPage.variablesDescription}
            messages={m.authoringHelp}
            variableGroups={variableGroups}
            snippets={liquidSnippets}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.templateDetailPage.sections.versions}</CardTitle>
        </CardHeader>
        <CardContent>
          {!versions || versions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {m.templateDetailPage.empty.noVersions}
            </p>
          ) : (
            <div className="overflow-hidden rounded border bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">
                      {m.templateDetailPage.fields.version}
                    </th>
                    <th className="p-2 text-left font-medium">
                      {m.templateDetailPage.fields.changelog}
                    </th>
                    <th className="p-2 text-left font-medium">
                      {m.templateDetailPage.fields.createdBy}
                    </th>
                    <th className="p-2 text-left font-medium">
                      {m.templateDetailPage.fields.createdAt}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((version) => (
                    <TemplateVersionRow
                      key={version.id}
                      version={version}
                      isCurrent={version.id === currentVersion?.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <TemplateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        template={template}
        onSuccess={() => {
          setEditOpen(false)
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: legalQueryKeys.templates() }),
            queryClient.invalidateQueries({ queryKey: legalQueryKeys.template(template.id) }),
          ])
        }}
      />

      <TemplateVersionDialog
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        templateId={template.id}
        onSuccess={() => {
          setVersionDialogOpen(false)
          void queryClient.invalidateQueries({
            queryKey: legalQueryKeys.templateVersions(template.id),
          })
        }}
      />
    </div>
  )
}

function TemplateBodyPreview({ body }: { body: string }) {
  if (!body.trim().startsWith("<")) {
    return (
      <div className="prose prose-sm max-w-none rounded-md border bg-muted/30 p-4">
        <pre className="whitespace-pre-wrap text-sm">{body}</pre>
      </div>
    )
  }

  return (
    <div
      className="prose prose-sm max-w-none rounded-md border bg-muted/30 p-4 [&_.variable-node]:inline-flex [&_.variable-node]:items-center [&_.variable-node]:rounded-md [&_.variable-node]:border [&_.variable-node]:border-emerald-500/30 [&_.variable-node]:bg-emerald-500/10 [&_.variable-node]:px-1.5 [&_.variable-node]:py-0.5 [&_.variable-node]:font-mono [&_.variable-node]:text-xs [&_.variable-node]:text-emerald-200"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Template body is trusted admin-authored HTML rendered for preview.
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}

function TemplateVersionRow({
  version,
  isCurrent,
}: {
  version: LegalContractTemplateVersionRecord
  isCurrent: boolean
}) {
  const i18n = useRegistryLegalI18nOrDefault()
  const m = useRegistryLegalMessagesOrDefault()

  return (
    <tr className="border-b last:border-b-0">
      <td className="p-2">
        <div className="flex items-center gap-2">
          <span className="font-mono">v{version.version}</span>
          {isCurrent ? (
            <Badge variant="secondary">{m.templateDetailPage.currentBadge}</Badge>
          ) : null}
        </div>
      </td>
      <td className="p-2">{version.changelog ?? m.common.noResultsDash}</td>
      <td className="p-2">{version.createdBy ?? m.common.noResultsDash}</td>
      <td className="p-2">{formatRegistryLegalDateTime(i18n, version.createdAt)}</td>
    </tr>
  )
}
