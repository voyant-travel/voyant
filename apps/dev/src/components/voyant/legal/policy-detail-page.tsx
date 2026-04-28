import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  type LegalPolicyVersionRecord,
  useLegalPolicy,
  useLegalPolicyAcceptances,
  useLegalPolicyAssignmentMutation,
  useLegalPolicyAssignments,
  useLegalPolicyMutation,
  useLegalPolicyVersionMutation,
  useLegalPolicyVersions,
} from "@voyantjs/legal-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { type AssignmentData, PolicyAssignmentDialog } from "./policy-assignment-dialog"
import {
  type Acceptance,
  type EnsureQueryData,
  getLegalPolicyAcceptancesQueryOptions,
  getLegalPolicyAssignmentsQueryOptions,
  getLegalPolicyQueryOptions,
  getLegalPolicyVersionsQueryOptions,
} from "./policy-detail-shared"
import { PolicyDialog } from "./policy-dialog"
import { PolicyRuleDialog, type RuleData } from "./policy-rule-dialog"
import { PolicyVersionDialog } from "./policy-version-dialog"
import { PolicyVersionRow } from "./policy-version-row"

export function loadPolicyDetailPage(id: string, ensureQueryData: EnsureQueryData) {
  return Promise.all([
    ensureQueryData(getLegalPolicyQueryOptions(id)),
    ensureQueryData(getLegalPolicyVersionsQueryOptions(id)),
    ensureQueryData(getLegalPolicyAssignmentsQueryOptions(id)),
    ensureQueryData(getLegalPolicyAcceptancesQueryOptions()),
  ])
}

export function PolicyDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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
  const [editingAssignment, setEditingAssignment] = useState<AssignmentData | undefined>()

  const { data: policy, isPending } = useLegalPolicy(id)
  const { data: versionsData, refetch: refetchVersions } = useLegalPolicyVersions({ policyId: id })
  const { data: assignmentsData, refetch: refetchAssignments } = useLegalPolicyAssignments({
    policyId: id,
  })
  const { data: acceptancesData } = useLegalPolicyAcceptances({ limit: 50, offset: 0 })
  const assignments = assignmentsData?.data ?? []
  const acceptances = acceptancesData?.data ?? []

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!policy) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Policy not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/legal/policies" })}>
          Back to Policies
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate({ to: "/legal/policies" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{policy.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {policy.kind.replace(/_/g, " ")}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">{policy.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this policy?")) {
                remove.mutate(id, { onSuccess: () => void navigate({ to: "/legal/policies" }) })
              }
            }}
            disabled={remove.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
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
          <CardTitle>Versions</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingVersion(undefined)
              setVersionDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Version
          </Button>
        </CardHeader>
        <CardContent>
          {!versionsData || versionsData.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No versions yet.</p>
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
          <CardTitle>Assignments</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingAssignment(undefined)
              setAssignmentDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Assignment
          </Button>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No assignments yet.</p>
          ) : null}
          {assignments.length > 0 ? (
            <div className="rounded border bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">Scope</th>
                    <th className="p-2 text-left font-medium">Target ID</th>
                    <th className="p-2 text-left font-medium">Priority</th>
                    <th className="p-2 text-left font-medium">Valid</th>
                    <th className="w-16 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b last:border-b-0">
                      <td className="p-2 capitalize">{assignment.scope}</td>
                      <td className="p-2 font-mono text-xs">
                        {assignment.productId ||
                          assignment.channelId ||
                          assignment.supplierId ||
                          assignment.marketId ||
                          assignment.organizationId ||
                          "-"}
                      </td>
                      <td className="p-2">{assignment.priority}</td>
                      <td className="p-2 text-xs">
                        {assignment.validFrom || assignment.validTo
                          ? `${assignment.validFrom ?? "..."} — ${assignment.validTo ?? "..."}`
                          : "Always"}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAssignment(assignment)
                              setAssignmentDialogOpen(true)
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Delete this assignment?")) {
                                removeAssignment.mutate({ policyId: id, id: assignment.id })
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
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Acceptances</CardTitle>
        </CardHeader>
        <CardContent>
          {acceptances.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No acceptances yet.</p>
          ) : null}
          {acceptances.length > 0 ? (
            <div className="rounded border bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">Version ID</th>
                    <th className="p-2 text-left font-medium">Person ID</th>
                    <th className="p-2 text-left font-medium">Booking ID</th>
                    <th className="p-2 text-left font-medium">Method</th>
                    <th className="p-2 text-left font-medium">Accepted At</th>
                  </tr>
                </thead>
                <tbody>
                  {acceptances.map((acceptance: Acceptance) => (
                    <tr key={acceptance.id} className="border-b last:border-b-0">
                      <td className="p-2 font-mono text-xs">{acceptance.policyVersionId}</td>
                      <td className="p-2 font-mono text-xs">{acceptance.personId ?? "-"}</td>
                      <td className="p-2 font-mono text-xs">{acceptance.bookingId ?? "-"}</td>
                      <td className="p-2 capitalize">{acceptance.method.replace(/_/g, " ")}</td>
                      <td className="p-2">{new Date(acceptance.acceptedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <PolicyDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        policy={policy}
        onSuccess={() => {
          setEditOpen(false)
          void queryClient.invalidateQueries()
        }}
      />

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

      <PolicyAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        policyId={id}
        assignment={editingAssignment}
        onSuccess={() => {
          setAssignmentDialogOpen(false)
          setEditingAssignment(undefined)
          void refetchAssignments()
        }}
      />
    </div>
  )
}
