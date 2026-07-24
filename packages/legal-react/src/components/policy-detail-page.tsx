// agent-quality: file-size exception -- owner: legal-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
import { useQueryClient } from "@tanstack/react-query"
import { formatMessage } from "@voyant-travel/i18n"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { ArrowLeft, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import { useLegalUiI18nOrDefault, useLegalUiMessagesOrDefault } from "../i18n/index.js"
import {
  type LegalPolicyAcceptanceRecord,
  type LegalPolicyAssignmentRecord,
  type LegalPolicyRecord,
  type LegalPolicyVersionRecord,
  useLegalPolicy,
  useLegalPolicyAcceptances,
  useLegalPolicyAssignmentMutation,
  useLegalPolicyAssignments,
  useLegalPolicyMutation,
  useLegalPolicyRuleMutation,
  useLegalPolicyRules,
  useLegalPolicyVersionMutation,
  useLegalPolicyVersions,
} from "../index.js"
import { PolicyRuleDialog, type RuleData } from "./policy-rule-dialog.js"
import { PolicyVersionDialog } from "./policy-version-dialog.js"

const versionStatusVariant: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  published: "default",
  retired: "secondary",
}

export interface PolicyDetailPageProps {
  id: string
  onBackToPolicies?: () => void
  renderPolicyDialog?: (props: PolicyDetailDialogRenderProps) => ReactNode
  renderPolicyAssignmentDialog?: (props: PolicyAssignmentDialogRenderProps) => ReactNode
}

export interface PolicyDetailDialogRenderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy: LegalPolicyRecord
  onSuccess: () => void
}

export interface PolicyAssignmentDialogRenderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  policyId: string
  assignment?: LegalPolicyAssignmentRecord
  onSuccess: () => void
}

export function PolicyDetailPage({
  id,
  onBackToPolicies,
  renderPolicyDialog,
  renderPolicyAssignmentDialog,
}: PolicyDetailPageProps) {
  const queryClient = useQueryClient()
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.policyDetailPage
  const { remove } = useLegalPolicyMutation()
  const { publish, retire } = useLegalPolicyVersionMutation()
  const { remove: removeAssignment } = useLegalPolicyAssignmentMutation()
  const [editOpen, setEditOpen] = useState(false)
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [editingVersion, setEditingVersion] = useState<LegalPolicyVersionRecord | undefined>()
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [ruleDialogVersionId, setRuleDialogVersionId] = useState("")
  const [editingRule, setEditingRule] = useState<RuleData | undefined>()
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<
    LegalPolicyAssignmentRecord | undefined
  >()

  const { data: policy, isPending } = useLegalPolicy(id)
  const { data: versionsData, refetch: refetchVersions } = useLegalPolicyVersions({ policyId: id })
  const { data: assignmentsData, refetch: refetchAssignments } = useLegalPolicyAssignments({
    policyId: id,
  })
  const { data: acceptancesData } = useLegalPolicyAcceptances({
    policyId: id,
    limit: 50,
    offset: 0,
  })
  const assignments = assignmentsData?.data ?? []
  const acceptances = acceptancesData?.data ?? []

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{messages.common.loading}</p>
        </div>
      </div>
    )
  }

  if (!policy) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{f.notFound}</p>
        {onBackToPolicies ? (
          <Button variant="outline" onClick={onBackToPolicies}>
            {f.backToPolicies}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {onBackToPolicies ? (
          <Button variant="ghost" size="icon" onClick={onBackToPolicies}>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{policy.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {messages.common.policyKindLabels[
                policy.kind as keyof typeof messages.common.policyKindLabels
              ] ?? policy.kind}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">{policy.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {renderPolicyDialog ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 size-4" aria-hidden="true" />
              {messages.common.edit}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={async () => {
              if (
                await confirmDialog({
                  description: formatMessage(f.deleteConfirm, { name: policy.name }),
                  destructive: true,
                })
              ) {
                remove.mutate(id, { onSuccess: () => onBackToPolicies?.() })
              }
            }}
            disabled={remove.isPending}
          >
            <Trash2 className="mr-2 size-4" aria-hidden="true" />
            {messages.common.delete}
          </Button>
        </div>
      </div>

      {policy.description ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">{policy.description}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{f.sections.versions}</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingVersion(undefined)
              setVersionDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {f.actions.newVersion}
          </Button>
        </CardHeader>
        <CardContent>
          {!versionsData || versionsData.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{f.empty.noVersions}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            {versionsData?.map((version) => (
              <PolicyVersionRow
                key={version.id}
                version={version}
                expanded={expandedVersionId === version.id}
                onToggle={() =>
                  setExpandedVersionId(expandedVersionId === version.id ? null : version.id)
                }
                onEdit={() => {
                  setEditingVersion(version)
                  setVersionDialogOpen(true)
                }}
                onPublish={() => publish.mutate(version.id)}
                onRetire={() => retire.mutate(version.id)}
                onAddRule={() => {
                  setRuleDialogVersionId(version.id)
                  setEditingRule(undefined)
                  setRuleDialogOpen(true)
                }}
                onEditRule={(rule) => {
                  setRuleDialogVersionId(version.id)
                  setEditingRule(rule)
                  setRuleDialogOpen(true)
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{f.sections.assignments}</CardTitle>
          {renderPolicyAssignmentDialog ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingAssignment(undefined)
                setAssignmentDialogOpen(true)
              }}
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              {f.actions.addAssignment}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {f.empty.noAssignments}
            </p>
          ) : null}
          {assignments.length > 0 ? (
            <div className="rounded border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{f.fields.scope}</TableHead>
                    <TableHead>{f.fields.targetId}</TableHead>
                    <TableHead>{f.fields.priority}</TableHead>
                    <TableHead>{f.fields.valid}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <AssignmentRow
                      key={assignment.id}
                      assignment={assignment}
                      onEdit={
                        renderPolicyAssignmentDialog
                          ? () => {
                              setEditingAssignment(assignment)
                              setAssignmentDialogOpen(true)
                            }
                          : undefined
                      }
                      onDelete={async () => {
                        if (
                          await confirmDialog({
                            description: f.deleteAssignmentConfirm,
                            destructive: true,
                          })
                        ) {
                          removeAssignment.mutate({ policyId: id, id: assignment.id })
                        }
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{f.sections.acceptances}</CardTitle>
        </CardHeader>
        <CardContent>
          {acceptances.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {f.empty.noAcceptances}
            </p>
          ) : null}
          {acceptances.length > 0 ? (
            <div className="rounded border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{f.fields.versionId}</TableHead>
                    <TableHead>{f.fields.personId}</TableHead>
                    <TableHead>{f.fields.bookingId}</TableHead>
                    <TableHead>{f.fields.target}</TableHead>
                    <TableHead>{f.fields.method}</TableHead>
                    <TableHead>{f.fields.acceptedAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acceptances.map((acceptance) => (
                    <AcceptanceRow key={acceptance.id} acceptance={acceptance} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {renderPolicyDialog?.({
        open: editOpen,
        onOpenChange: setEditOpen,
        policy,
        onSuccess: () => {
          setEditOpen(false)
          void queryClient.invalidateQueries()
        },
      })}

      <PolicyVersionDialog
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        policyId={id}
        version={editingVersion}
        onSuccess={() => {
          setVersionDialogOpen(false)
          setEditingVersion(undefined)
          void refetchVersions()
        }}
      />

      {ruleDialogVersionId ? (
        <PolicyRuleDialog
          open={ruleDialogOpen}
          onOpenChange={setRuleDialogOpen}
          versionId={ruleDialogVersionId}
          rule={editingRule}
          onSuccess={() => {
            setRuleDialogOpen(false)
            setEditingRule(undefined)
            void queryClient.invalidateQueries()
          }}
        />
      ) : null}

      {renderPolicyAssignmentDialog?.({
        open: assignmentDialogOpen,
        onOpenChange: setAssignmentDialogOpen,
        policyId: id,
        assignment: editingAssignment,
        onSuccess: () => {
          setAssignmentDialogOpen(false)
          setEditingAssignment(undefined)
          void refetchAssignments()
        },
      })}
    </div>
  )
}

function PolicyVersionRow({
  version,
  expanded,
  onToggle,
  onEdit,
  onPublish,
  onRetire,
  onAddRule,
  onEditRule,
}: {
  version: LegalPolicyVersionRecord
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onPublish: () => void
  onRetire: () => void
  onAddRule: () => void
  onEditRule: (rule: RuleData) => void
}) {
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.policyDetailPage
  const { remove } = useLegalPolicyRuleMutation()
  const { data: rulesData } = useLegalPolicyRules({
    versionId: version.id,
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
          {expanded ? (
            <ChevronDown className="size-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4" aria-hidden="true" />
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">v{version.version}</span>
            <Badge variant={versionStatusVariant[version.status] ?? "secondary"}>
              {f.versionStatusLabels[version.status] ?? version.status}
            </Badge>
            <span className="text-sm text-muted-foreground">{version.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {version.status === "draft" ? (
            <Button variant="outline" size="sm" onClick={onPublish}>
              {f.actions.publish}
            </Button>
          ) : null}
          {version.status === "published" ? (
            <Button variant="outline" size="sm" onClick={onRetire}>
              {f.actions.retire}
            </Button>
          ) : null}
          {version.status === "draft" ? (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="border-t bg-muted/30 p-3">
          {version.body ? (
            <div className="mb-4 rounded border bg-background p-3">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                {f.sections.body}
              </p>
              {version.body.trim().startsWith("<") ? (
                <div
                  className="prose prose-invert max-w-none text-sm [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_p]:my-2"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: Policy version body is trusted admin-authored HTML rendered for preview. -- owner: legal-react; existing suppression is intentional pending typed cleanup.
                  dangerouslySetInnerHTML={{ __html: version.body }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{version.body}</pre>
              )}
            </div>
          ) : null}
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {f.sections.rules}
            </p>
            <Button variant="outline" size="sm" onClick={onAddRule}>
              <Plus className="mr-1 size-3" aria-hidden="true" />
              {f.actions.addRule}
            </Button>
          </div>

          {!rulesData || rulesData.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">{f.empty.noRules}</p>
          ) : null}

          {rulesData && rulesData.length > 0 ? (
            <div className="rounded border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{f.fields.sort}</TableHead>
                    <TableHead>{f.fields.type}</TableHead>
                    <TableHead>{f.fields.label}</TableHead>
                    <TableHead>{f.fields.days}</TableHead>
                    <TableHead>{f.fields.refund}</TableHead>
                    <TableHead>{f.fields.refundType}</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesData
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono">{rule.sortOrder}</TableCell>
                        <TableCell>
                          {messages.policyRuleDialog.ruleTypeLabels[
                            rule.ruleType as keyof typeof messages.policyRuleDialog.ruleTypeLabels
                          ] ?? rule.ruleType}
                        </TableCell>
                        <TableCell>{rule.label ?? messages.common.noResultsDash}</TableCell>
                        <TableCell>
                          {rule.daysBeforeDeparture ?? messages.common.noResultsDash}
                        </TableCell>
                        <TableCell>{formatRuleRefund(rule)}</TableCell>
                        <TableCell>
                          {rule.refundType
                            ? (messages.policyRuleDialog.refundTypeLabels[
                                rule.refundType as keyof typeof messages.policyRuleDialog.refundTypeLabels
                              ] ?? rule.refundType)
                            : messages.common.noResultsDash}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditRule(rule)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="size-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (
                                  await confirmDialog({
                                    description: f.deleteRuleConfirm,
                                    destructive: true,
                                  })
                                ) {
                                  remove.mutate({ versionId: version.id, id: rule.id })
                                }
                              }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3" aria-hidden="true" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function AssignmentRow({
  assignment,
  onEdit,
  onDelete,
}: {
  assignment: LegalPolicyAssignmentRecord
  onEdit?: () => void
  onDelete: () => void
}) {
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.policyDetailPage

  return (
    <TableRow>
      <TableCell>{f.assignmentScopeLabels[assignment.scope] ?? assignment.scope}</TableCell>
      <TableCell className="font-mono text-xs">{getAssignmentTargetId(assignment)}</TableCell>
      <TableCell>{assignment.priority}</TableCell>
      <TableCell className="text-xs">
        {assignment.validFrom || assignment.validTo
          ? `${assignment.validFrom ?? "..."} - ${assignment.validTo ?? "..."}`
          : f.always}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" aria-hidden="true" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function AcceptanceRow({ acceptance }: { acceptance: LegalPolicyAcceptanceRecord }) {
  const i18n = useLegalUiI18nOrDefault()
  const messages = useLegalUiMessagesOrDefault()

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{acceptance.policyVersionId}</TableCell>
      <TableCell className="font-mono text-xs">
        {acceptance.personId ?? messages.common.noResultsDash}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {acceptance.bookingId ?? messages.common.noResultsDash}
      </TableCell>
      <TableCell className="font-mono text-xs">{getAcceptanceTarget(acceptance)}</TableCell>
      <TableCell>{acceptance.method.replace(/_/g, " ")}</TableCell>
      <TableCell>{i18n.formatDateTime(acceptance.acceptedAt)}</TableCell>
    </TableRow>
  )
}

function getAcceptanceTarget(acceptance: LegalPolicyAcceptanceRecord) {
  if (acceptance.targetKind === "provider_source_ref") {
    if (!acceptance.targetProvider && !acceptance.targetSourceRef) return "-"
    return `${acceptance.targetProvider ?? "provider"}:${acceptance.targetSourceRef ?? ""}`
  }
  if (acceptance.targetKind && acceptance.targetId) {
    return `${acceptance.targetKind}:${acceptance.targetId}`
  }
  if (acceptance.legacyTransactionOfferId) {
    return `legacy_transaction_offer:${acceptance.legacyTransactionOfferId}`
  }
  if (acceptance.legacyTransactionOrderId) {
    return `legacy_transaction_order:${acceptance.legacyTransactionOrderId}`
  }
  return "-"
}

function getAssignmentTargetId(assignment: LegalPolicyAssignmentRecord) {
  return (
    assignment.productId ||
    assignment.channelId ||
    assignment.supplierId ||
    assignment.marketId ||
    assignment.organizationId ||
    "-"
  )
}

function formatRuleRefund(rule: RuleData) {
  if (rule.refundPercent != null) return `${(rule.refundPercent / 100).toFixed(2)}%`
  if (rule.flatAmountCents != null) {
    return `${(rule.flatAmountCents / 100).toFixed(2)} ${rule.currency ?? ""}`
  }
  return "-"
}
