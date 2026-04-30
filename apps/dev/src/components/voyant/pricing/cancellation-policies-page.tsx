"use client"

import {
  type CancellationPolicyRecord,
  type CancellationPolicyRuleRecord,
  useCancellationPolicies,
  useCancellationPolicyMutation,
  useCancellationPolicyRuleMutation,
  useCancellationPolicyRules,
} from "@voyantjs/pricing-react"
import { CancellationPolicyRuleDialog } from "@voyantjs/pricing-ui/components/cancellation-policy-rule-dialog"
import { Badge, Button, Input } from "@voyantjs/ui/components"
import { ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react"
import * as React from "react"
import { CancellationPolicyDialog } from "./cancellation-policy-dialog"

const POLICY_PAGE_SIZE = 25
const RULE_PAGE_SIZE = 10

export function CancellationPoliciesPage() {
  const [policyDialogOpen, setPolicyDialogOpen] = React.useState(false)
  const [editingPolicy, setEditingPolicy] = React.useState<CancellationPolicyRecord | undefined>()
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const [ruleDialogOpen, setRuleDialogOpen] = React.useState(false)
  const [ruleDialogPolicyId, setRuleDialogPolicyId] = React.useState<string | null>(null)
  const [editingRule, setEditingRule] = React.useState<CancellationPolicyRuleRecord | undefined>()
  const [nextRuleSortOrder, setNextRuleSortOrder] = React.useState<number>(0)
  const [search, setSearch] = React.useState("")
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = useCancellationPolicies({
    search: search || undefined,
    limit: POLICY_PAGE_SIZE,
    offset: pageIndex * POLICY_PAGE_SIZE,
  })
  const { remove } = useCancellationPolicyMutation()

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
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Cancellation Fee Policies</h2>
          <p className="text-sm text-muted-foreground">
            Pricing-side cancellation fee policies with cutoff-based fee rules and ordered steps.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingPolicy(undefined)
            setPolicyDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Policy
        </Button>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search cancellation fee policies…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPageIndex(0)
          }}
          className="pl-9"
        />
      </div>

      {isPending ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Loading cancellation fee policies...
        </div>
      ) : (data?.data ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No cancellation fee policies yet. Create one to start defining cancellation rules.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(data?.data ?? []).map((policy) => (
            <PolicyRow
              key={policy.id}
              policy={policy}
              expanded={expandedIds.has(policy.id)}
              onToggle={() => toggleExpand(policy.id)}
              onEdit={() => {
                setEditingPolicy(policy)
                setPolicyDialogOpen(true)
              }}
              onDelete={() => {
                if (confirm(`Delete policy "${policy.name}"?`)) {
                  remove.mutate(policy.id, { onSuccess: () => void refetch() })
                }
              }}
              onAddRule={(nextSort) => {
                setRuleDialogPolicyId(policy.id)
                setEditingRule(undefined)
                setNextRuleSortOrder(nextSort)
                setRuleDialogOpen(true)
              }}
              onEditRule={(rule) => {
                setRuleDialogPolicyId(policy.id)
                setEditingRule(rule)
                setRuleDialogOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <PaginationBar
        pageIndex={pageIndex}
        pageSize={POLICY_PAGE_SIZE}
        total={data?.total ?? 0}
        onPageIndexChange={setPageIndex}
      />

      <CancellationPolicyDialog
        open={policyDialogOpen}
        onOpenChange={setPolicyDialogOpen}
        policy={editingPolicy}
        onSuccess={() => {
          setPolicyDialogOpen(false)
          setEditingPolicy(undefined)
          void refetch()
        }}
      />

      {ruleDialogPolicyId ? (
        <CancellationPolicyRuleDialog
          open={ruleDialogOpen}
          onOpenChange={setRuleDialogOpen}
          policyId={ruleDialogPolicyId}
          rule={editingRule}
          nextSortOrder={nextRuleSortOrder}
          onSuccess={() => {
            setRuleDialogOpen(false)
            setEditingRule(undefined)
          }}
        />
      ) : null}
    </div>
  )
}

function PolicyRow({
  policy,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddRule,
  onEditRule,
}: {
  policy: CancellationPolicyRecord
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddRule: (nextSortOrder: number) => void
  onEditRule: (rule: CancellationPolicyRuleRecord) => void
}) {
  const [rulePageIndex, setRulePageIndex] = React.useState(0)
  const rulesQuery = useCancellationPolicyRules({
    cancellationPolicyId: policy.id,
    limit: RULE_PAGE_SIZE,
    offset: rulePageIndex * RULE_PAGE_SIZE,
    enabled: expanded,
  })
  const { remove } = useCancellationPolicyRuleMutation()

  const rules = rulesQuery.data?.data ?? []
  const nextSort =
    rules.length > 0
      ? Math.max(...rules.map((rule) => rule.sortOrder)) + 1
      : rulePageIndex * RULE_PAGE_SIZE

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
            <span className="text-sm font-medium">{policy.name}</span>
            {policy.code ? (
              <span className="font-mono text-xs text-muted-foreground">{policy.code}</span>
            ) : null}
            <Badge variant="outline" className="capitalize">
              {policy.policyType.replace("_", " ")}
            </Badge>
            {policy.isDefault ? <Badge variant="secondary">Default</Badge> : null}
            <Badge variant={policy.active ? "default" : "outline"}>
              {policy.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          {policy.policyType === "simple" && policy.simpleCutoffHours != null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Simple cutoff: {policy.simpleCutoffHours}h
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
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
              Rules
            </p>
            <Button variant="outline" size="sm" onClick={() => onAddRule(nextSort)}>
              <Plus className="mr-1 h-3 w-3" />
              Add Rule
            </Button>
          </div>

          {rulesQuery.isPending ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Loading rules...</p>
          ) : rules.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">No rules yet.</p>
          ) : (
            <div className="rounded border bg-background">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">Sort</th>
                    <th className="p-2 text-left font-medium">Cutoff</th>
                    <th className="p-2 text-left font-medium">Charge</th>
                    <th className="p-2 text-left font-medium">Status</th>
                    <th className="p-2 text-left font-medium">Notes</th>
                    <th className="w-16 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {rules
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((rule) => (
                      <tr key={rule.id} className="border-b last:border-b-0">
                        <td className="p-2 font-mono">{rule.sortOrder}</td>
                        <td className="p-2">{formatCutoff(rule.cutoffMinutesBefore)}</td>
                        <td className="p-2">{formatCharge(rule)}</td>
                        <td className="p-2">
                          <Badge variant={rule.active ? "default" : "outline"}>
                            {rule.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="p-2 text-muted-foreground">{rule.notes ?? "-"}</td>
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
                                  remove.mutate(rule.id, {
                                    onSuccess: () => void rulesQuery.refetch(),
                                  })
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

          <div className="mt-3">
            <PaginationBar
              pageIndex={rulePageIndex}
              pageSize={RULE_PAGE_SIZE}
              total={rulesQuery.data?.total ?? 0}
              onPageIndexChange={setRulePageIndex}
              compact
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PaginationBar({
  pageIndex,
  pageSize,
  total,
  onPageIndexChange,
  compact = false,
}: {
  pageIndex: number
  pageSize: number
  total: number
  onPageIndexChange: (pageIndex: number) => void
  compact?: boolean
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const canPrevious = pageIndex > 0
  const canNext = pageIndex + 1 < pageCount

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        Page {total === 0 ? 0 : pageIndex + 1} / {pageCount}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={!canPrevious}
          onClick={() => onPageIndexChange(pageIndex - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={!canNext}
          onClick={() => onPageIndexChange(pageIndex + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

function formatCutoff(minutes: number | null): string {
  if (minutes == null || minutes === 0) return "At start"
  if (minutes % 1440 === 0) return `${minutes / 1440}d before`
  if (minutes % 60 === 0) return `${minutes / 60}h before`
  return `${minutes}m before`
}

function formatCharge(rule: CancellationPolicyRuleRecord): string {
  if (rule.chargeType === "none") return "None"
  if (rule.chargeType === "amount") {
    return rule.chargeAmountCents != null ? (rule.chargeAmountCents / 100).toFixed(2) : "-"
  }
  return rule.chargePercentBasisPoints != null
    ? `${(rule.chargePercentBasisPoints / 100).toFixed(2)}%`
    : "-"
}
