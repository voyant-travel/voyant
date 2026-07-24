import { useQueryClient } from "@tanstack/react-query"
import { formatMessage } from "@voyant-travel/i18n"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ContractTemplateAuthoringHelp,
  confirmDialog,
} from "@voyant-travel/ui/components"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { useLegalUiI18nOrDefault, useLegalUiMessagesOrDefault } from "../i18n/index.js"
import {
  type LegalContractTemplateVersionRecord,
  legalQueryKeys,
  useLegalContractTemplate,
  useLegalContractTemplateAuthoring,
  useLegalContractTemplateMutation,
  useLegalContractTemplateVersions,
} from "../index.js"
import type {
  TemplateDialogRenderProps,
  TemplateVersionDialogRenderProps,
} from "./templates-page.js"

export interface TemplateDetailPageProps {
  id: string
  onBackToTemplates?: () => void
  renderTemplateDialog?: (props: TemplateDialogRenderProps) => ReactNode
  renderTemplateVersionDialog?: (props: TemplateVersionDialogRenderProps) => ReactNode
}

export function TemplateDetailPage({
  id,
  onBackToTemplates,
  renderTemplateDialog,
  renderTemplateVersionDialog,
}: TemplateDetailPageProps) {
  const queryClient = useQueryClient()
  const i18n = useLegalUiI18nOrDefault()
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.templateDetailPage
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
      <div className="flex flex-col gap-6">
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{messages.common.loading}</p>
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{f.notFound}</p>
        {onBackToTemplates ? (
          <Button variant="outline" onClick={onBackToTemplates}>
            {f.backToTemplates}
          </Button>
        ) : null}
      </div>
    )
  }

  const currentVersion =
    versions?.find((version) => version.id === template.currentVersionId) ?? versions?.[0] ?? null

  const invalidateTemplate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: legalQueryKeys.templates() }),
      queryClient.invalidateQueries({ queryKey: legalQueryKeys.template(template.id) }),
      queryClient.invalidateQueries({
        queryKey: legalQueryKeys.templateVersions(template.id),
      }),
    ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        {onBackToTemplates ? (
          <Button variant="ghost" size="icon" onClick={onBackToTemplates}>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{template.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{template.slug}</span>
            <Badge variant="outline">
              {messages.common.contractScopeLabels[
                template.scope as keyof typeof messages.common.contractScopeLabels
              ] ?? template.scope}
            </Badge>
            <Badge variant={template.active ? "default" : "secondary"}>
              {template.active ? messages.common.active : messages.common.inactive}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {renderTemplateDialog ? (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 size-4" aria-hidden="true" />
              {messages.common.edit}
            </Button>
          ) : null}
          {renderTemplateVersionDialog ? (
            <Button size="sm" onClick={() => setVersionDialogOpen(true)}>
              <Plus className="mr-2 size-4" aria-hidden="true" />
              {f.actions.addVersion}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (
                await confirmDialog({
                  description: formatMessage(f.deleteConfirm, { name: template.name }),
                  destructive: true,
                })
              ) {
                remove.mutate(template.id, {
                  onSuccess: () => {
                    onBackToTemplates?.()
                  },
                })
              }
            }}
            disabled={remove.isPending}
          >
            <Trash2 className="mr-2 size-4" aria-hidden="true" />
            {messages.common.delete}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{f.sections.details}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <DetailRow label={f.fields.language}>{template.language}</DetailRow>
            {template.currentVersionId ? (
              <DetailRow label={f.fields.currentVersionId}>
                <span className="font-mono text-xs">{template.currentVersionId}</span>
              </DetailRow>
            ) : null}
            <DetailRow label={f.fields.created}>{i18n.formatDate(template.createdAt)}</DetailRow>
            <DetailRow label={f.fields.updated}>{i18n.formatDate(template.updatedAt)}</DetailRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{f.sections.description}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {template.description?.trim() ? template.description : f.empty.noDescription}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{f.sections.currentBody}</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateBodyPreview body={template.body} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{f.sections.variables}</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractTemplateAuthoringHelp
            variableGroups={variableGroups}
            snippets={liquidSnippets}
            description={f.variablesDescription}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{f.sections.versions}</CardTitle>
        </CardHeader>
        <CardContent>
          {!versions || versions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{f.empty.noVersions}</p>
          ) : (
            <div className="overflow-hidden rounded border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{f.fields.version}</TableHead>
                    <TableHead>{f.fields.changelog}</TableHead>
                    <TableHead>{f.fields.createdBy}</TableHead>
                    <TableHead>{f.fields.createdAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((version) => (
                    <TemplateVersionRow
                      key={version.id}
                      version={version}
                      isCurrent={version.id === currentVersion?.id}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {renderTemplateDialog?.({
        open: editOpen,
        onOpenChange: setEditOpen,
        template,
        onSuccess: () => {
          setEditOpen(false)
          void invalidateTemplate()
        },
      })}

      {renderTemplateVersionDialog?.({
        open: versionDialogOpen,
        onOpenChange: setVersionDialogOpen,
        templateId: template.id,
        onSuccess: () => {
          setVersionDialogOpen(false)
          void invalidateTemplate()
        },
      })}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> <span>{children}</span>
    </div>
  )
}

function TemplateBodyPreview({ body }: { body: string }) {
  if (!body.trim().startsWith("<")) {
    return (
      <div className="max-h-[70vh] overflow-auto rounded-md border bg-muted/30 p-4">
        <pre className="whitespace-pre-wrap text-sm">{body}</pre>
      </div>
    )
  }

  return (
    <div
      className="prose prose-sm max-h-[70vh] max-w-none overflow-auto rounded-md border bg-muted/30 p-4 [&_.variable-node]:inline-flex [&_.variable-node]:items-center [&_.variable-node]:rounded-md [&_.variable-node]:border [&_.variable-node]:border-emerald-500/30 [&_.variable-node]:bg-emerald-500/10 [&_.variable-node]:px-1.5 [&_.variable-node]:py-0.5 [&_.variable-node]:font-mono [&_.variable-node]:text-xs [&_.variable-node]:text-emerald-200"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Template body is trusted admin-authored HTML rendered for preview. -- owner: legal-react; existing suppression is intentional pending typed cleanup.
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
  const i18n = useLegalUiI18nOrDefault()
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.templateDetailPage

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-mono">v{version.version}</span>
          {isCurrent ? <Badge variant="secondary">{f.currentBadge}</Badge> : null}
        </div>
      </TableCell>
      <TableCell>{version.changelog ?? messages.common.noResultsDash}</TableCell>
      <TableCell>{version.createdBy ?? messages.common.noResultsDash}</TableCell>
      <TableCell>{i18n.formatDateTime(version.createdAt)}</TableCell>
    </TableRow>
  )
}
