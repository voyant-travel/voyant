import type { QueryClient } from "@tanstack/react-query"
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useLocale } from "@voyantjs/admin"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Package, Trash2, Wrench } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { ResourceAllocationDetailSkeleton } from "./resource-allocation-detail-skeleton"
import { getAllocationModeLabel } from "./resources-shared"

type AllocationDetail = {
  id: string
  poolId: string
  productId: string
  availabilityRuleId: string | null
  startTimeId: string | null
  quantityRequired: number
  allocationMode: "shared" | "exclusive"
  priority: number
  createdAt: string
  updatedAt: string
}

type Pool = { id: string; name: string }
type Product = { id: string; name: string }
type Rule = { id: string; recurrenceRule: string }
type StartTime = { id: string; label: string | null; startTimeLocal: string }

export function getResourceAllocationDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["resource-allocation", id],
    queryFn: () => api.get<{ data: AllocationDetail }>(`/v1/resources/allocations/${id}`),
  })
}

export function getResourceAllocationPoolQueryOptions(poolId: string) {
  return queryOptions({
    queryKey: ["resource-allocation-pool", poolId],
    queryFn: () => api.get<{ data: Pool }>(`/v1/resources/pools/${poolId}`),
  })
}

export function getResourceAllocationProductQueryOptions(productId: string) {
  return queryOptions({
    queryKey: ["resource-allocation-product", productId],
    queryFn: () => api.get<{ data: Product }>(`/v1/products/${productId}`),
  })
}

export function getResourceAllocationRuleQueryOptions(ruleId: string) {
  return queryOptions({
    queryKey: ["resource-allocation-rule", ruleId],
    queryFn: () => api.get<{ data: Rule }>(`/v1/availability/rules/${ruleId}`),
  })
}

export function getResourceAllocationStartTimeQueryOptions(startTimeId: string) {
  return queryOptions({
    queryKey: ["resource-allocation-start-time", startTimeId],
    queryFn: () => api.get<{ data: StartTime }>(`/v1/availability/start-times/${startTimeId}`),
  })
}

export async function ensureResourceAllocationDetailPageData(queryClient: QueryClient, id: string) {
  const allocationData = await queryClient.ensureQueryData(
    getResourceAllocationDetailQueryOptions(id),
  )

  await Promise.all([
    queryClient.ensureQueryData(getResourceAllocationPoolQueryOptions(allocationData.data.poolId)),
    queryClient.ensureQueryData(
      getResourceAllocationProductQueryOptions(allocationData.data.productId),
    ),
    ...(allocationData.data.availabilityRuleId
      ? [
          queryClient.ensureQueryData(
            getResourceAllocationRuleQueryOptions(allocationData.data.availabilityRuleId),
          ),
        ]
      : []),
    ...(allocationData.data.startTimeId
      ? [
          queryClient.ensureQueryData(
            getResourceAllocationStartTimeQueryOptions(allocationData.data.startTimeId),
          ),
        ]
      : []),
  ])
}

export function ResourceAllocationDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { resolvedLocale } = useLocale()
  const messages = useAdminMessages()
  const detailMessages = messages.resources.details

  const { data: allocationData, isPending } = useQuery(getResourceAllocationDetailQueryOptions(id))

  const allocation = allocationData?.data

  const poolQuery = useQuery({
    ...getResourceAllocationPoolQueryOptions(allocation?.poolId ?? ""),
    enabled: Boolean(allocation?.poolId),
  })

  const productQuery = useQuery({
    ...getResourceAllocationProductQueryOptions(allocation?.productId ?? ""),
    enabled: Boolean(allocation?.productId),
  })

  const ruleQuery = useQuery({
    ...getResourceAllocationRuleQueryOptions(allocation?.availabilityRuleId ?? ""),
    enabled: Boolean(allocation?.availabilityRuleId),
  })

  const startTimeQuery = useQuery({
    ...getResourceAllocationStartTimeQueryOptions(allocation?.startTimeId ?? ""),
    enabled: Boolean(allocation?.startTimeId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/resources/allocations/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resources", "allocations"] })
      void navigate({ to: "/resources" })
    },
  })

  if (isPending) {
    return <ResourceAllocationDetailSkeleton />
  }

  if (!allocation) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detailMessages.allocation.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/resources" })}>
          {detailMessages.backToResources}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/resources" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {detailMessages.allocation.pageTitle}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {getAllocationModeLabel(allocation.allocationMode, messages)}
            </Badge>
            <Badge variant="secondary">
              {detailMessages.quantityPrefix} {allocation.quantityRequired}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/resources/pools/$id", params: { id: allocation.poolId } })
            }
          >
            <Wrench className="mr-2 h-4 w-4" />
            {detailMessages.openPool}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/products/$id", params: { id: allocation.productId } })
            }
          >
            <Package className="mr-2 h-4 w-4" />
            {detailMessages.openProduct}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(detailMessages.allocation.deleteConfirm)) {
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

      <Card>
        <CardHeader>
          <CardTitle>{detailMessages.allocation.detailsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">{messages.resources.poolLabel}:</span>{" "}
            <span>{poolQuery.data?.data.name ?? allocation.poolId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.resources.productLabel}:</span>{" "}
            <span>{productQuery.data?.data.name ?? allocation.productId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{detailMessages.allocation.ruleLabel}:</span>{" "}
            <span>
              {ruleQuery.data?.data.recurrenceRule ??
                allocation.availabilityRuleId ??
                detailMessages.noRule}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {detailMessages.allocation.startTimeLabel}:
            </span>{" "}
            <span>
              {startTimeQuery.data?.data.label ??
                startTimeQuery.data?.data.startTimeLocal ??
                allocation.startTimeId ??
                detailMessages.noStartTime}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {detailMessages.allocation.priorityLabel}:
            </span>{" "}
            <span>{allocation.priority}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.resources.createdLabel}:</span>{" "}
            <span>{new Date(allocation.createdAt).toLocaleString(resolvedLocale)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{messages.resources.updatedLabel}:</span>{" "}
            <span>{new Date(allocation.updatedAt).toLocaleString(resolvedLocale)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
