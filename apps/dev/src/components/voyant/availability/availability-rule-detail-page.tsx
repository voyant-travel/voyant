import type { QueryClient } from "@tanstack/react-query"
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, CalendarDays, Loader2, Package, Trash2 } from "lucide-react"
import { api } from "@/lib/api-client"

type RuleDetail = {
  id: string
  productId: string
  timezone: string
  recurrenceRule: string
  maxCapacity: number
  maxPickupCapacity: number | null
  minTotalPax: number | null
  cutoffMinutes: number | null
  earlyBookingLimitMinutes: number | null
  active: boolean
  createdAt: string
  updatedAt: string
}

type Product = { id: string; name: string }
type Slot = {
  id: string
  dateLocal: string
  startsAt: string
  status: "open" | "closed" | "sold_out" | "cancelled"
  remainingPax: number | null
}
type ListResponse<T> = { data: T[]; total: number; limit: number; offset: number }

export async function loadAvailabilityRuleDetailPage(
  ensureQueryData: QueryClient["ensureQueryData"],
  id: string,
) {
  const ruleData = await ensureQueryData(getAvailabilityRuleQueryOptions(id))

  return Promise.all([
    Promise.resolve(ruleData),
    ensureQueryData(getAvailabilityRuleSlotsQueryOptions(id)),
    ensureQueryData(getAvailabilityRuleProductQueryOptions(ruleData.data.productId)),
  ])
}

export function getAvailabilityRuleQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["availability-rule", id],
    queryFn: () => api.get<{ data: RuleDetail }>(`/v1/availability/rules/${id}`),
  })
}

export function getAvailabilityRuleProductQueryOptions(productId: string) {
  return queryOptions({
    queryKey: ["availability-rule-product", productId],
    queryFn: () => api.get<{ data: Product }>(`/v1/products/${productId}`),
  })
}

export function getAvailabilityRuleSlotsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["availability-rule-slots", id],
    queryFn: () =>
      api.get<ListResponse<Slot>>(`/v1/availability/slots?availabilityRuleId=${id}&limit=25`),
  })
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16)
}

export function AvailabilityRuleDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: ruleData, isPending } = useQuery(getAvailabilityRuleQueryOptions(id))

  const rule = ruleData?.data

  const productQuery = useQuery({
    ...getAvailabilityRuleProductQueryOptions(rule?.productId ?? ""),
    enabled: Boolean(rule?.productId),
  })

  const slotsQuery = useQuery(getAvailabilityRuleSlotsQueryOptions(id))

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/availability/rules/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["availability", "rules"] })
      void navigate({ to: "/availability" })
    },
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!rule) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Availability rule not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/availability" })}>
          Back to Availability
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/availability" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Availability Rule</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={rule.active ? "default" : "secondary"}>
              {rule.active ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline">{rule.timezone}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void navigate({ to: "/products/$id", params: { id: rule.productId } })}
          >
            <Package className="mr-2 h-4 w-4" />
            Open Product
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this availability rule?")) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rule Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Product:</span>{" "}
              <span>{productQuery.data?.data.name ?? rule.productId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Recurrence:</span>
              <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                {rule.recurrenceRule}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capacity Policy</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Max Capacity:</span>{" "}
              <span>{rule.maxCapacity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max Pickup Capacity:</span>{" "}
              <span>{rule.maxPickupCapacity ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Min Total Pax:</span>{" "}
              <span>{rule.minTotalPax ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Cutoff Minutes:</span>{" "}
              <span>{rule.cutoffMinutes ?? "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Early Booking Limit:</span>{" "}
              <span>{rule.earlyBookingLimitMinutes ?? "-"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          <CardTitle>Generated Slots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(slotsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No slots currently reference this rule.</p>
          ) : (
            slotsQuery.data?.data.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                onClick={() => void navigate({ to: "/availability/$id", params: { id: slot.id } })}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {slot.status.replace("_", " ")}
                  </Badge>
                  <span>
                    {slot.dateLocal} · {formatDateTime(slot.startsAt)}
                  </span>
                </div>
                <div className="mt-2 text-muted-foreground">
                  Remaining Pax: {slot.remainingPax ?? "-"}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
