import { type QueryClient, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  getLegalContractTemplateQueryOptions,
  getLegalContractTemplateVersionsQueryOptions,
  type LegalContractTemplateVersionRecord,
  legalQueryKeys,
  useLegalContractTemplate,
  useLegalContractTemplateAuthoring,
  useLegalContractTemplateMutation,
  useLegalContractTemplateVersions,
} from "@voyantjs/legal-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ContractTemplateAuthoringHelp,
} from "@voyantjs/ui/components"
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { legalQueryClient } from "./legal-query-client"
import { TemplateDialog } from "./template-dialog"

type EnsureQueryData = QueryClient["ensureQueryData"]

export function loadTemplateDetailPage(id: string, ensureQueryData: EnsureQueryData) {
  return Promise.all([
    ensureQueryData(getLegalContractTemplateQueryOptions(legalQueryClient, id)),
    ensureQueryData(
      getLegalContractTemplateVersionsQueryOptions(legalQueryClient, { templateId: id }),
    ),
  ])
}

export function TemplateDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { remove } = useLegalContractTemplateMutation()
  const { variableCatalog, liquidSnippets } = useLegalContractTemplateAuthoring()
  const [editOpen, setEditOpen] = useState(false)
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
        <p className="text-muted-foreground">Template not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/legal/templates" })}>
          Back to Templates
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
            <Badge variant="outline" className="capitalize">
              {template.scope}
            </Badge>
            <Badge variant={template.active ? "default" : "secondary"}>
              {template.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Delete template "${template.name}"?`)) {
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
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Language:</span>{" "}
              <span>{template.language}</span>
            </div>
            {template.currentVersionId ? (
              <div>
                <span className="text-muted-foreground">Current Version ID:</span>{" "}
                <span className="font-mono text-xs">{template.currentVersionId}</span>
              </div>
            ) : null}
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              <span>{new Date(template.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{" "}
              <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {template.description?.trim() ? template.description : "No description provided."}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Body</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateBodyPreview body={template.body} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template Variables &amp; Liquid</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractTemplateAuthoringHelp
            variableGroups={variableGroups}
            snippets={liquidSnippets}
            description="Templates render with Liquid. Use the reference below to see available variables, filters, loops, and conditionals."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent>
          {!versions || versions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <div className="overflow-hidden rounded border bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">Version</th>
                    <th className="p-2 text-left font-medium">Changelog</th>
                    <th className="p-2 text-left font-medium">Created By</th>
                    <th className="p-2 text-left font-medium">Created At</th>
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
          // Body edits auto-create a new version server-side, so we
          // need to invalidate the versions query alongside the
          // template/templates queries — the new version appears
          // only after this refetch completes.
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: legalQueryKeys.templates() }),
            queryClient.invalidateQueries({ queryKey: legalQueryKeys.template(template.id) }),
            queryClient.invalidateQueries({
              queryKey: legalQueryKeys.templateVersions(template.id),
            }),
          ])
        }}
      />
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
      className="prose prose-sm max-w-none overflow-auto rounded-md border bg-muted/30 p-4 [&_.variable-node]:inline-flex [&_.variable-node]:items-center [&_.variable-node]:rounded-md [&_.variable-node]:border [&_.variable-node]:border-emerald-500/30 [&_.variable-node]:bg-emerald-500/10 [&_.variable-node]:px-1.5 [&_.variable-node]:py-0.5 [&_.variable-node]:font-mono [&_.variable-node]:text-xs [&_.variable-node]:text-emerald-200"
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
  return (
    <tr className="border-b last:border-b-0">
      <td className="p-2">
        <div className="flex items-center gap-2">
          <span className="font-mono">v{version.version}</span>
          {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
        </div>
      </td>
      <td className="p-2">{version.changelog ?? "-"}</td>
      <td className="p-2">{version.createdBy ?? "-"}</td>
      <td className="p-2">{new Date(version.createdAt).toLocaleString()}</td>
    </tr>
  )
}
