import type { QueryClient } from "@tanstack/react-query"
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { useLocale } from "@voyantjs/voyant-admin"
import { ArrowLeft, Clock3, Loader2, Package, Trash2 } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { getSlotStatusLabel } from "./availability-shared"

type StartTimeDetail = {
  id: string
  productId: string
  label: string | null
  startTimeLocal: string
  durationMinutes: number | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

type Product = {
  id: string
  name: string
}

type Slot = {
  id: string
  dateLocal: string
  startsAt: string
  status: "open" | "closed" | "sold_out" | "cancelled"
  remainingPax: number | null
}

type ListResponse<T> = {
  data: T[]
  total: number
  limit: number
  offset: number
}

export async function loadAvailabilityStartTimeDetailPage(
  ensureQueryData: QueryClient["ensureQueryData"],
  id: string,
) {
  const startTimeData = await ensureQueryData(getAvailabilityStartTimeQueryOptions(id))

  return Promise.all([
    Promise.resolve(startTimeData),
    ensureQueryData(getAvailabilityStartTimeSlotsQueryOptions(id)),
    ensureQueryData(getAvailabilityStartTimeProductQueryOptions(startTimeData.data.productId)),
  ])
}

export function getAvailabilityStartTimeQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["availability-start-time", id],
    queryFn: () => api.get<{ data: StartTimeDetail }>(`/v1/availability/start-times/${id}`),
  })
}

export function getAvailabilityStartTimeProductQueryOptions(productId: string) {
  return queryOptions({
    queryKey: ["availability-start-time-product", productId],
    queryFn: () => api.get<{ data: Product }>(`/v1/products/${productId}`),
  })
}

export function getAvailabilityStartTimeSlotsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["availability-start-time-slots", id],
    queryFn: () => api.get<ListResponse<Slot>>(`/v1/availability/slots?startTimeId=${id}&limit=25`),
  })
}

function formatDateTime(value: string | null, noValue: string) {
  return value ? value.replace("T", " ").slice(0, 16) : noValue
}

export function AvailabilityStartTimeDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { resolvedLocale } = useLocale()
  const messages = useAdminMessages()
  const detailMessages = messages.availability.details
  const noValue = detailMessages.noValue

  const { data: startTimeData, isPending } = useQuery(getAvailabilityStartTimeQueryOptions(id))

  const startTime = startTimeData?.data

  const productQuery = useQuery({
    ...getAvailabilityStartTimeProductQueryOptions(startTime?.productId ?? ""),
    enabled: Boolean(startTime?.productId),
  })

  const slotsQuery = useQuery(getAvailabilityStartTimeSlotsQueryOptions(id))

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/availability/start-times/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["availability", "start-times"] })
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

  if (!startTime) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{detailMessages.startTime.notFound}</p>
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
          <h1 className="text-2xl font-bold tracking-tight">
            {startTime.label ?? detailMessages.startTime.fallbackTitle}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{startTime.startTimeLocal}</Badge>
            <Badge variant={startTime.active ? "default" : "secondary"}>
              {startTime.active
                ? messages.availability.statusActive
                : messages.availability.statusInactive}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/products/$id", params: { id: startTime.productId } })
            }
          >
            <Package className="mr-2 h-4 w-4" />
            {detailMessages.openProduct}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(detailMessages.startTime.deleteConfirm)) {
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
            <CardTitle>{detailMessages.startTime.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{messages.availability.productLabel}:</span>{" "}
              <span>{productQuery.data?.data.name ?? startTime.productId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.availability.labelLabel}:</span>{" "}
              <span>{startTime.label ?? noValue}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{messages.availability.durationLabel}:</span>{" "}
              <span>
                {startTime.durationMinutes == null ? noValue : `${startTime.durationMinutes} min`}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {detailMessages.startTime.sortOrderLabel}:
              </span>{" "}
              <span>{startTime.sortOrder}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.createdLabel}:</span>{" "}
              <span>{new Date(startTime.createdAt).toLocaleString(resolvedLocale)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{detailMessages.updatedLabel}:</span>{" "}
              <span>{new Date(startTime.updatedAt).toLocaleString(resolvedLocale)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Clock3 className="h-4 w-4" />
            <CardTitle>{detailMessages.startTime.generatedSlotsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(slotsQuery.data?.data.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">
                {detailMessages.startTime.generatedSlotsEmpty}
              </p>
            ) : (
              slotsQuery.data?.data.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
                  onClick={() =>
                    void navigate({ to: "/availability/$id", params: { id: slot.id } })
                  }
                >
                  <div className="font-medium">
                    {slot.dateLocal} · {formatDateTime(slot.startsAt, noValue)}
                  </div>
                  <div className="text-muted-foreground">
                    {messages.availability.statusLabel}: {getSlotStatusLabel(slot.status, messages)}{" "}
                    · {messages.availability.remainingPaxLabel}: {slot.remainingPax ?? noValue}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
