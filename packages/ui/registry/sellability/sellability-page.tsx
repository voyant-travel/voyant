"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  type SellabilityPolicyRecord,
  useSellabilityPolicies,
  useSellabilityPolicyMutation,
} from "@voyantjs/sellability-react"
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
import { useSellabilityUiMessagesOrDefault } from "../../../sellability-ui/src/index"

import { useRegistrySellabilityMessagesOrDefault } from "./i18n"
import { PolicyDialog } from "./policy-dialog"

const PAGE_SIZE = 25

export function SellabilityPage() {
  const sharedMessages = useSellabilityUiMessagesOrDefault()
  const pageMessages = useRegistrySellabilityMessagesOrDefault().page
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SellabilityPolicyRecord | undefined>()
  const [scope, setScope] = React.useState<"all" | SellabilityPolicyRecord["scope"]>("all")
  const [policyType, setPolicyType] = React.useState<"all" | SellabilityPolicyRecord["policyType"]>(
    "all",
  )
  const [active, setActive] = React.useState<"all" | "active" | "inactive">("all")
  const [pageIndex, setPageIndex] = React.useState(0)

  const { data, isPending, refetch } = useSellabilityPolicies({
    scope: scope === "all" ? undefined : scope,
    policyType: policyType === "all" ? undefined : policyType,
    active: active === "all" ? undefined : active === "active",
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useSellabilityPolicyMutation()

  React.useEffect(() => {
    setPageIndex(0)
  }, [])

  const rows = React.useMemo(
    () => (data?.data ?? []).slice().sort((left, right) => left.priority - right.priority),
    [data?.data],
  )

  const columns = React.useMemo<ColumnDef<SellabilityPolicyRecord>[]>(
    () => [
      {
        accessorKey: "name",
        header: pageMessages.columns.name,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "scope",
        header: pageMessages.columns.scope,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {sharedMessages.common.policyScopeLabels[row.original.scope]}
          </Badge>
        ),
      },
      {
        accessorKey: "policyType",
        header: pageMessages.columns.type,
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {sharedMessages.common.policyTypeLabels[row.original.policyType]}
          </Badge>
        ),
      },
      {
        accessorKey: "priority",
        header: pageMessages.columns.priority,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.priority}</span>
        ),
      },
      {
        accessorKey: "active",
        header: pageMessages.columns.status,
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "default" : "outline"}>
            {row.original.active ? pageMessages.filters.active : pageMessages.filters.inactive}
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
                if (confirm(pageMessages.actions.deleteConfirm)) {
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
    [
      pageMessages,
      refetch,
      remove,
      sharedMessages.common.policyScopeLabels,
      sharedMessages.common.policyTypeLabels,
    ],
  )

  const scopeOptions: Array<{ value: "all" | SellabilityPolicyRecord["scope"]; label: string }> = [
    { value: "all", label: pageMessages.filters.scopeAll },
    { value: "global", label: sharedMessages.common.policyScopeLabels.global },
    { value: "product", label: sharedMessages.common.policyScopeLabels.product },
    { value: "option", label: sharedMessages.common.policyScopeLabels.option },
    { value: "market", label: sharedMessages.common.policyScopeLabels.market },
    { value: "channel", label: sharedMessages.common.policyScopeLabels.channel },
  ]

  const typeOptions: Array<{
    value: "all" | SellabilityPolicyRecord["policyType"]
    label: string
  }> = [
    { value: "all", label: pageMessages.filters.typeAll },
    ...Object.entries(sharedMessages.common.policyTypeLabels).map(([value, label]) => ({
      value: value as SellabilityPolicyRecord["policyType"],
      label,
    })),
  ]

  const statusOptions = [
    { value: "all", label: pageMessages.filters.statusAll },
    { value: "active", label: pageMessages.filters.active },
    { value: "inactive", label: pageMessages.filters.inactive },
  ] as const

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">{pageMessages.description}</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {pageMessages.addPolicy}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={scope} onValueChange={(value) => setScope(value as typeof scope)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={pageMessages.filters.scopePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {scopeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={policyType}
          onValueChange={(value) => setPolicyType(value as typeof policyType)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={pageMessages.filters.typePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={active} onValueChange={(value) => setActive(value as typeof active)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={pageMessages.filters.statusPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
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
          emptyMessage={pageMessages.empty.noPolicies}
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
