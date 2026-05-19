"use client"

import { type BookingRecord, useBookings } from "@voyantjs/bookings-react"
import {
  type OrganizationRecord,
  type PersonRecord,
  useOrganizations,
  usePeople,
} from "@voyantjs/crm-react"
import { type ProductRecord, useProducts } from "@voyantjs/products-react"
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@voyantjs/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { ListFilter } from "lucide-react"
import * as React from "react"

import { api } from "@/lib/api-client"

export const ANY = "__all__"
export const RISK_ALL = ANY
export const STATUS_ALL = ANY
export const PRINCIPAL_TYPE_ALL = ANY
export const TARGET_TYPE_ALL = ANY

const PRINCIPAL_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: PRINCIPAL_TYPE_ALL, label: "Any principal" },
  { value: "user", label: "Staff user" },
  { value: "api_key", label: "API key" },
  { value: "agent", label: "Agent" },
  { value: "workflow", label: "Workflow" },
  { value: "system", label: "System" },
]

const PRINCIPAL_ID_PLACEHOLDER: Record<string, string> = {
  [PRINCIPAL_TYPE_ALL]: "principal id",
  user: "staff user id",
  api_key: "api key id",
  agent: "agent id",
  workflow: "workflow run id",
  system: "system id",
}

type TargetTypeKey =
  | typeof TARGET_TYPE_ALL
  | "booking"
  | "product"
  | "person"
  | "organization"
  | "invoice"
  | "supplier"

const TARGET_TYPE_OPTIONS: ReadonlyArray<{ value: TargetTypeKey; label: string }> = [
  { value: TARGET_TYPE_ALL, label: "Any target" },
  { value: "booking", label: "Booking" },
  { value: "product", label: "Product" },
  { value: "person", label: "Person" },
  { value: "organization", label: "Organization" },
  { value: "invoice", label: "Invoice" },
  { value: "supplier", label: "Supplier" },
]

const RISK_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: RISK_ALL, label: "Any risk" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
]

const STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: STATUS_ALL, label: "Any status" },
  { value: "requested", label: "Requested" },
  { value: "awaiting_approval", label: "Awaiting approval" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "reversed", label: "Reversed" },
  { value: "compensated", label: "Compensated" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
  { value: "superseded", label: "Superseded" },
]

export interface ActionLedgerFiltersPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeFilterCount: number
  principalType: string
  onPrincipalTypeChange: (value: string) => void
  principalId: string
  onPrincipalIdChange: (value: string) => void
  targetType: string
  onTargetTypeChange: (value: string) => void
  targetId: string
  onTargetIdChange: (value: string) => void
  workflowRunId: string
  onWorkflowRunIdChange: (value: string) => void
  correlationId: string
  onCorrelationIdChange: (value: string) => void
  evaluatedRisk: string
  onEvaluatedRiskChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
}

export function ActionLedgerFiltersPopover({
  open,
  onOpenChange,
  activeFilterCount,
  principalType,
  onPrincipalTypeChange,
  principalId,
  onPrincipalIdChange,
  targetType,
  onTargetTypeChange,
  targetId,
  onTargetIdChange,
  workflowRunId,
  onWorkflowRunIdChange,
  correlationId,
  onCorrelationIdChange,
  evaluatedRisk,
  onEvaluatedRiskChange,
  status,
  onStatusChange,
}: ActionLedgerFiltersPopoverProps) {
  const principalIdPlaceholder =
    PRINCIPAL_ID_PLACEHOLDER[principalType] ?? PRINCIPAL_ID_PLACEHOLDER[PRINCIPAL_TYPE_ALL]!

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="default">
            <ListFilter className="mr-2 size-4" />
            Filters
            {activeFilterCount > 0 ? (
              <Badge variant="secondary" className="ml-2 px-1.5">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[22rem] p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logs-filter-principal-type">Principal type</Label>
            <Select
              value={principalType}
              onValueChange={(value) => onPrincipalTypeChange(value ?? PRINCIPAL_TYPE_ALL)}
            >
              <SelectTrigger id="logs-filter-principal-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRINCIPAL_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logs-filter-principal-id">Principal ID</Label>
            <Input
              id="logs-filter-principal-id"
              placeholder={principalIdPlaceholder}
              value={principalId}
              onChange={(event) => onPrincipalIdChange(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logs-filter-target-type">Target type</Label>
            <Select
              value={isKnownTargetType(targetType) ? targetType : TARGET_TYPE_ALL}
              onValueChange={(value) => onTargetTypeChange(value ?? TARGET_TYPE_ALL)}
            >
              <SelectTrigger id="logs-filter-target-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logs-filter-target-id">Target</Label>
            <TargetCombobox
              targetType={targetType as TargetTypeKey}
              value={targetId}
              onChange={onTargetIdChange}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logs-filter-workflow">Workflow run</Label>
            <WorkflowRunCombobox value={workflowRunId} onChange={onWorkflowRunIdChange} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logs-filter-correlation">Correlation ID</Label>
            <Input
              id="logs-filter-correlation"
              placeholder="correlation id"
              value={correlationId}
              onChange={(event) => onCorrelationIdChange(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logs-filter-risk">Risk</Label>
            <Select
              value={evaluatedRisk}
              onValueChange={(value) => onEvaluatedRiskChange(value ?? RISK_ALL)}
            >
              <SelectTrigger id="logs-filter-risk">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RISK_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logs-filter-status">Status</Label>
            <Select value={status} onValueChange={(value) => onStatusChange(value ?? STATUS_ALL)}>
              <SelectTrigger id="logs-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function isKnownTargetType(value: string): value is TargetTypeKey {
  return TARGET_TYPE_OPTIONS.some((option) => option.value === value)
}

function TargetCombobox({
  targetType,
  value,
  onChange,
}: {
  targetType: TargetTypeKey
  value: string
  onChange: (value: string) => void
}) {
  switch (targetType) {
    case "booking":
      return <BookingTargetCombobox value={value} onChange={onChange} />
    case "product":
      return <ProductTargetCombobox value={value} onChange={onChange} />
    case "person":
      return <PersonTargetCombobox value={value} onChange={onChange} />
    case "organization":
      return <OrganizationTargetCombobox value={value} onChange={onChange} />
    default:
      return (
        <Input
          id="logs-filter-target-id"
          placeholder={
            targetType === TARGET_TYPE_ALL ? "pick a target type to browse" : "target id"
          }
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )
  }
}

function BookingTargetCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<BookingRecord | null>(null)
  const { data } = useBookings({ search: search || undefined, limit: 20 })
  const items = data?.data ?? []
  return (
    <AsyncCombobox<BookingRecord>
      value={value || null}
      onChange={(next) => {
        onChange(next ?? "")
        if (!next) setSelected(null)
        else {
          const match = items.find((booking) => booking.id === next)
          if (match) setSelected(match)
        }
      }}
      items={items}
      selectedItem={selected}
      getKey={(booking) => booking.id}
      getLabel={(booking) => booking.bookingNumber}
      onSearchChange={setSearch}
      placeholder="Search bookings"
      emptyText="No bookings"
    />
  )
}

function ProductTargetCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<ProductRecord | null>(null)
  const { data } = useProducts({ search: search || undefined, limit: 20 })
  const items = data?.data ?? []
  return (
    <AsyncCombobox<ProductRecord>
      value={value || null}
      onChange={(next) => {
        onChange(next ?? "")
        if (!next) setSelected(null)
        else {
          const match = items.find((product) => product.id === next)
          if (match) setSelected(match)
        }
      }}
      items={items}
      selectedItem={selected}
      getKey={(product) => product.id}
      getLabel={(product) => product.name}
      onSearchChange={setSearch}
      placeholder="Search products"
      emptyText="No products"
    />
  )
}

function PersonTargetCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<PersonRecord | null>(null)
  const { data } = usePeople({ search: search || undefined, limit: 20 })
  const items = data?.data ?? []
  return (
    <AsyncCombobox<PersonRecord>
      value={value || null}
      onChange={(next) => {
        onChange(next ?? "")
        if (!next) setSelected(null)
        else {
          const match = items.find((person) => person.id === next)
          if (match) setSelected(match)
        }
      }}
      items={items}
      selectedItem={selected}
      getKey={(person) => person.id}
      getLabel={formatPersonName}
      getSecondary={(person) => person.email ?? undefined}
      onSearchChange={setSearch}
      placeholder="Search people"
      emptyText="No people"
    />
  )
}

function OrganizationTargetCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<OrganizationRecord | null>(null)
  const { data } = useOrganizations({ search: search || undefined, limit: 20 })
  const items = data?.data ?? []
  return (
    <AsyncCombobox<OrganizationRecord>
      value={value || null}
      onChange={(next) => {
        onChange(next ?? "")
        if (!next) setSelected(null)
        else {
          const match = items.find((organization) => organization.id === next)
          if (match) setSelected(match)
        }
      }}
      items={items}
      selectedItem={selected}
      getKey={(organization) => organization.id}
      getLabel={(organization) => organization.name}
      onSearchChange={setSearch}
      placeholder="Search organizations"
      emptyText="No organizations"
    />
  )
}

function formatPersonName(person: PersonRecord): string {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim()
  return name || person.email || person.id
}

interface WorkflowRunSummary {
  id: string
  workflowName: string
  status: string
  startedAt: string
}

interface WorkflowRunsListResponse {
  data: WorkflowRunSummary[]
}

function WorkflowRunCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<WorkflowRunSummary | null>(null)
  const runsQuery = useWorkflowRunsList()
  const filtered = React.useMemo(() => {
    if (!search.trim()) return runsQuery.data ?? []
    const needle = search.trim().toLowerCase()
    return (runsQuery.data ?? []).filter(
      (run) =>
        run.workflowName.toLowerCase().includes(needle) || run.id.toLowerCase().includes(needle),
    )
  }, [runsQuery.data, search])

  return (
    <AsyncCombobox<WorkflowRunSummary>
      value={value || null}
      onChange={(next) => {
        onChange(next ?? "")
        if (!next) setSelected(null)
        else {
          const match = filtered.find((run) => run.id === next)
          if (match) setSelected(match)
        }
      }}
      items={filtered}
      selectedItem={selected}
      getKey={(run) => run.id}
      getLabel={(run) => run.workflowName}
      getSecondary={(run) => `${run.status} · ${formatRunTimestamp(run.startedAt)}`}
      onSearchChange={setSearch}
      placeholder="Recent workflow runs"
      emptyText={runsQuery.isLoading ? "Loading…" : "No runs"}
    />
  )
}

function useWorkflowRunsList() {
  const [data, setData] = React.useState<WorkflowRunSummary[] | undefined>(undefined)
  const [isLoading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get<WorkflowRunsListResponse>("/v1/admin/workflow-runs?limit=50")
      .then((res) => {
        if (cancelled) return
        setData(res.data ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setData([])
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading }
}

function formatRunTimestamp(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}
