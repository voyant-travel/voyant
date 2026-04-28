import { useQuery } from "@tanstack/react-query"
import { getLegalPolicyRulesQueryOptions, useLegalPolicyRuleMutation } from "@voyantjs/legal-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import { legalQueryClient } from "./legal-query-client"
import { type PolicyVersion, versionStatusVariant } from "./policy-detail-shared"
import type { RuleData } from "./policy-rule-dialog"

export function PolicyVersionRow({
  version,
  expanded,
  onToggle,
  onEdit,
  onPublish,
  onRetire,
  onAddRule,
  onEditRule,
}: {
  version: PolicyVersion
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onPublish: () => void
  onRetire: () => void
  onAddRule: () => void
  onEditRule: (rule: RuleData) => void
}) {
  const { remove } = useLegalPolicyRuleMutation()
  const { data: rulesData } = useQuery({
    ...getLegalPolicyRulesQueryOptions(legalQueryClient, { versionId: version.id }),
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
            <span className="text-sm font-medium">v{version.version}</span>
            <Badge
              variant={versionStatusVariant[version.status] ?? "secondary"}
              className="capitalize"
            >
              {version.status}
            </Badge>
            <span className="text-sm text-muted-foreground">{version.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {version.status === "draft" && (
            <Button variant="outline" size="sm" onClick={onPublish}>
              Publish
            </Button>
          )}
          {version.status === "published" && (
            <Button variant="outline" size="sm" onClick={onRetire}>
              Retire
            </Button>
          )}
          {version.status === "draft" && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/30 p-3">
          {version.body ? (
            <div className="mb-4 rounded border bg-background p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Body
              </p>
              {version.body.trim().startsWith("<") ? (
                <div
                  className="prose prose-invert max-w-none text-sm [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_p]:my-2"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Policy version body is trusted admin-authored HTML rendered for preview.
                  dangerouslySetInnerHTML={{ __html: version.body }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{version.body}</pre>
              )}
            </div>
          ) : null}
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rules
            </p>
            <Button variant="outline" size="sm" onClick={onAddRule}>
              <Plus className="mr-1 h-3 w-3" />
              Add Rule
            </Button>
          </div>

          {(!rulesData || rulesData.length === 0) && (
            <p className="py-2 text-center text-xs text-muted-foreground">No rules yet.</p>
          )}

          {rulesData && rulesData.length > 0 && (
            <div className="rounded border bg-background">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">Sort</th>
                    <th className="p-2 text-left font-medium">Type</th>
                    <th className="p-2 text-left font-medium">Label</th>
                    <th className="p-2 text-left font-medium">Days</th>
                    <th className="p-2 text-left font-medium">Refund</th>
                    <th className="p-2 text-left font-medium">Type</th>
                    <th className="w-16 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {rulesData
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((rule) => (
                      <tr key={rule.id} className="border-b last:border-b-0">
                        <td className="p-2 font-mono">{rule.sortOrder}</td>
                        <td className="p-2 capitalize">{rule.ruleType.replace(/_/g, " ")}</td>
                        <td className="p-2">{rule.label ?? "-"}</td>
                        <td className="p-2">{rule.daysBeforeDeparture ?? "-"}</td>
                        <td className="p-2">
                          {rule.refundPercent != null
                            ? `${(rule.refundPercent / 100).toFixed(2)}%`
                            : rule.flatAmountCents != null
                              ? `${(rule.flatAmountCents / 100).toFixed(2)} ${rule.currency ?? ""}`
                              : "-"}
                        </td>
                        <td className="p-2 capitalize">
                          {rule.refundType?.replace(/_/g, " ") ?? "-"}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditRule(rule)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("Delete this rule?")) {
                                  remove.mutate({ versionId: version.id, id: rule.id })
                                }
                              }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
