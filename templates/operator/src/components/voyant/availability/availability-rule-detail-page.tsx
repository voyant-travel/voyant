import type { QueryClient } from "@tanstack/react-query"
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { AvailabilityRuleDetailSkeleton } from "@voyantjs/availability-ui"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, CalendarDays, Package, Trash2 } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { getSlotStatusLabel } from "./availability-shared"

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

export async function loadAvailabilityRuleDetailPage(queryClient: QueryClient, id: string) {
  const ruleData = await queryClient.ensureQueryData(getAvailabilityRuleQueryOptions(id))

  return Promise.all([
    Promise.resolve(ruleData),
    queryClient.ensureQueryData(getAvailabilityRuleSlotsQueryOptions(id)),
    queryClient.ensureQueryData(getAvailabilityRuleProductQueryOptions(ruleData.data.productId)),
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
  const messages = useAdminMessages()
  const detailMessages = messages.availability.details
  const noValue = detailMessages.noValue

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
    return <AvailabilityRuleDetailSkeleton />
  }

  if (!rule) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detailMessages.rule.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/availability" })}>
          {detailMessages.backToAvailability}
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
          <h1 className="text-2xl font-bold tracking-tight">{detailMessages.rule.pageTitle}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={rule.active ? "default" : "secondary"}>
              {rule.active
                ? messages.availability.statusActive
                : messages.availability.statusInactive}
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
            {detailMessages.openProduct}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(detailMessages.rule.deleteConfirm)) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {detailMessages.delete}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.rule.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{messages.availability.productLabel}:</span>{" "}
              <span>{productQuery.data?.data.name ?? rule.productId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {messages.availability.recurrenceLabel}:
              </span>
              <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                {rule.recurrenceRule}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.rule.capacityPolicyTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{messages.availability.maxPaxLabel}:</span>{" "}
              <span>{rule.maxCapacity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {detailMessages.rule.maxPickupCapacityLabel}:
              </span>{" "}
              <span>{rule.maxPickupCapacity ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.rule.minTotalPaxLabel}:</span>{" "}
              <span>{rule.minTotalPax ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {detailMessages.rule.cutoffMinutesLabel}:
              </span>{" "}
              <span>{rule.cutoffMinutes ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {detailMessages.rule.earlyBookingLimitLabel}:
              </span>{" "}
              <span>{rule.earlyBookingLimitMinutes ?? noValue}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          <CardTitle>{detailMessages.rule.generatedSlotsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(slotsQuery.data?.data.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">{detailMessages.rule.generatedSlotsEmpty}</p>
          ) : (
            slotsQuery.data?.data.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                onClick={() => void navigate({ to: "/availability/$id", params: { id: slot.id } })}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {getSlotStatusLabel(slot.status, messages.availability)}
                  </Badge>
                  <span>
                    {slot.dateLocal} · {formatDateTime(slot.startsAt)}
                  </span>
                </div>
                <div className="mt-2 text-muted-foreground">
                  {messages.availability.remainingPaxLabel}: {slot.remainingPax ?? noValue}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
