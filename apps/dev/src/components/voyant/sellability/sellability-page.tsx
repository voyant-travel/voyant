import type { ColumnDef } from "@tanstack/react-table"
import {
  type SellabilityPolicyRecord,
  useSellabilityPolicies,
  useSellabilityPolicyMutation,
} from "@voyantjs/sellability-react"
import { PolicyDialog } from "@voyantjs/sellability-ui/components/policy-dialog"
import { Loader2, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react"
import * as React from "react"
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"

const PAGE_SIZE = 25

const POLICY_SCOPE_OPTIONS = [
  { value: "all", label: "All scopes" },
  { value: "global", label: "Global" },
  { value: "product", label: "Product" },
  { value: "option", label: "Option" },
  { value: "market", label: "Market" },
  { value: "channel", label: "Channel" },
] as const

const POLICY_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "capability", label: "Capability" },
  { value: "occupancy", label: "Occupancy" },
  { value: "pickup", label: "Pickup" },
  { value: "question", label: "Question" },
  { value: "allotment", label: "Allotment" },
  { value: "availability_window", label: "Availability window" },
  { value: "currency", label: "Currency" },
  { value: "custom", label: "Custom" },
] as const

const ACTIVE_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const

export function SellabilityPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SellabilityPolicyRecord | undefined>()
  const [scope, setScope] = React.useState<(typeof POLICY_SCOPE_OPTIONS)[number]["value"]>("all")
  const [policyType, setPolicyType] =
    React.useState<(typeof POLICY_TYPE_OPTIONS)[number]["value"]>("all")
  const [active, setActive] = React.useState<(typeof ACTIVE_OPTIONS)[number]["value"]>("all")
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = useSellabilityPolicies({
    scope: scope === "all" ? undefined : scope,
    policyType: policyType === "all" ? undefined : policyType,
    active: active === "all" ? undefined : active === "active",
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useSellabilityPolicyMutation()

  const rows = React.useMemo(
    () => (data?.data ?? []).slice().sort((left, right) => left.priority - right.priority),
    [data?.data],
  )

  const columns = React.useMemo<ColumnDef<SellabilityPolicyRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "scope",
        header: "Scope",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.scope}
          </Badge>
        ),
      },
      {
        accessorKey: "policyType",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.policyType.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.priority}</span>
        ),
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "default" : "outline"}>
            {row.original.active ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <div className="w-20" />,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setEditing(row.original)
                setDialogOpen(true)
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete policy "${row.original.name}"?`)) {
                  remove.mutate(row.original.id, { onSuccess: () => void refetch() })
                }
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [refetch, remove],
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sellability</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Declarative policies that decide when offers can be sold across global, product,
              option, market, and channel scopes.
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Policy
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={scope}
          onValueChange={(value) => {
            setScope(value as typeof scope)
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            {POLICY_SCOPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={policyType}
          onValueChange={(value) => {
            setPolicyType(value as typeof policyType)
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {POLICY_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={active}
          onValueChange={(value) => {
            setActive(value as typeof active)
            setPageIndex(0)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {ACTIVE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage="No policies found."
          pagination={{
            pageIndex,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            onPageIndexChange: setPageIndex,
          }}
        />
      )}

      <PolicyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        policy={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}
