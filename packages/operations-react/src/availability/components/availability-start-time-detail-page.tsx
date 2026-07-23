"use client"

import type { QueryClient } from "@tanstack/react-query"
import { queryOptions, useQuery } from "@tanstack/react-query"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from "@voyant-travel/ui/components"
import { ArrowLeft, Clock3, Package, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { z } from "zod"
import { useAvailabilityUiI18nOrDefault } from "../i18n/index.js"
import {
  type AvailabilitySlotRow,
  type AvailabilityStartTimeRow,
  availabilityQueryKeys,
  availabilityStartTimeRecordSchema,
  fetchWithValidation,
  getProductQueryOptions,
  getSlotsQueryOptions,
  singleEnvelope,
  slotLocalStart,
  useAvailabilityStartTimeMutation,
  useVoyantAvailabilityContext,
  type VoyantAvailabilityContextValue,
} from "../index.js"
import { getSlotStatusLabel } from "./availability-columns.js"
import { AvailabilityStartTimeDetailSkeleton } from "./availability-skeletons.js"

const availabilityStartTimeDetailResponse = singleEnvelope(
  availabilityStartTimeRecordSchema.extend({
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }),
)

export interface AvailabilityStartTimeDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onOpenProduct?: (productId: string) => void
  onOpenSlot?: (slotId: string) => void
  confirmAction?: (message: string) => boolean
}

export function getAvailabilityStartTimeDetailQueryOptions(
  client: VoyantAvailabilityContextValue,
  id: string | null | undefined,
) {
  return queryOptions({
    queryKey: availabilityQueryKeys.startTimeDetail(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("getAvailabilityStartTimeDetailQueryOptions requires an id")
      return fetchWithValidation(
        `/v1/admin/operations/availability/start-times/${id}`,
        availabilityStartTimeDetailResponse,
        client,
      )
    },
  })
}

export function getAvailabilityStartTimeSlotsQueryOptions(
  client: VoyantAvailabilityContextValue,
  id: string | null | undefined,
) {
  return getSlotsQueryOptions(client, { startTimeId: id ?? undefined, limit: 25, offset: 0 })
}

export async function loadAvailabilityStartTimeDetailPage(
  queryClient: QueryClient,
  client: VoyantAvailabilityContextValue,
  id: string,
) {
  const startTimeData = await queryClient.ensureQueryData(
    getAvailabilityStartTimeDetailQueryOptions(client, id),
  )

  return Promise.all([
    Promise.resolve(startTimeData),
    queryClient.ensureQueryData(getAvailabilityStartTimeSlotsQueryOptions(client, id)),
    queryClient.ensureQueryData(getProductQueryOptions(client, startTimeData.data.productId)),
  ])
}

export function AvailabilityStartTimeDetailPage({
  id,
  className,
  onBack,
  onDeleted,
  onOpenProduct,
  onOpenSlot,
  confirmAction = (message) => globalThis.confirm?.(message) ?? true,
}: AvailabilityStartTimeDetailPageProps) {
  const client = useVoyantAvailabilityContext()
  const i18n = useAvailabilityUiI18nOrDefault()
  const messages = i18n.messages
  const detailMessages = messages.details
  const noValue = detailMessages.noValue
  const startTimeMutation = useAvailabilityStartTimeMutation()
  const { data: startTimeData, isPending } = useQuery(
    getAvailabilityStartTimeDetailQueryOptions(client, id),
  )
  const startTime = startTimeData?.data
  const productQuery = useQuery({
    ...getProductQueryOptions(client, startTime?.productId ?? ""),
    enabled: Boolean(startTime?.productId),
  })
  const slotsQuery = useQuery(getAvailabilityStartTimeSlotsQueryOptions(client, id))

  if (isPending) {
    return <AvailabilityStartTimeDetailSkeleton />
  }

  if (!startTime) {
    return (
      <DetailEmptyState
        message={detailMessages.startTime.notFound}
        backLabel={detailMessages.backToAvailability}
        onBack={onBack}
      />
    )
  }

  async function deleteStartTime(currentStartTime: AvailabilityStartTimeRow) {
    if (!confirmAction(detailMessages.startTime.deleteConfirm)) return
    await startTimeMutation.remove.mutateAsync(currentStartTime.id)
    if (onDeleted) onDeleted()
    else onBack?.()
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          {onBack ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label={detailMessages.backToAvailability}
            >
              <ArrowLeft data-icon aria-hidden="true" />
            </Button>
          ) : null}
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {startTime.label ?? detailMessages.startTime.fallbackTitle}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{startTime.startTimeLocal}</Badge>
              <Badge variant={startTime.active ? "default" : "secondary"}>
                {startTime.active ? messages.statusActive : messages.statusInactive}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenProduct ? (
            <Button variant="outline" onClick={() => onOpenProduct(startTime.productId)}>
              <Package data-icon="inline-start" aria-hidden="true" />
              {detailMessages.openProduct}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={() => void deleteStartTime(startTime)}
            disabled={startTimeMutation.remove.isPending}
          >
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            {detailMessages.delete}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{detailMessages.startTime.detailsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <DetailLine label={messages.productLabel}>
              {productQuery.data?.data.name ?? startTime.productId}
            </DetailLine>
            <DetailLine label={messages.labelLabel}>{startTime.label ?? noValue}</DetailLine>
            <DetailLine label={messages.durationLabel}>
              {startTime.durationMinutes == null ? noValue : `${startTime.durationMinutes} min`}
            </DetailLine>
            <DetailLine label={detailMessages.startTime.sortOrderLabel}>
              {startTime.sortOrder}
            </DetailLine>
            <DetailLine label={detailMessages.createdLabel}>
              {formatOptionalDateTime(startTime.createdAt, noValue, i18n.formatDateTime)}
            </DetailLine>
            <DetailLine label={detailMessages.updatedLabel}>
              {formatOptionalDateTime(startTime.updatedAt, noValue, i18n.formatDateTime)}
            </DetailLine>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Clock3 className="size-4" aria-hidden="true" />
            <CardTitle>{detailMessages.startTime.generatedSlotsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {(slotsQuery.data?.data.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">
                {detailMessages.startTime.generatedSlotsEmpty}
              </p>
            ) : (
              slotsQuery.data?.data.map((slot) => (
                <SlotButton key={slot.id} slot={slot} onOpenSlot={onOpenSlot} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SlotButton({
  slot,
  onOpenSlot,
}: {
  slot: AvailabilitySlotRow
  onOpenSlot?: (slotId: string) => void
}) {
  const messages = useAvailabilityUiI18nOrDefault().messages
  const noValue = messages.details.noValue

  return (
    <button
      type="button"
      className="block w-full rounded-md border p-3 text-left hover:bg-muted/40"
      onClick={() => onOpenSlot?.(slot.id)}
    >
      <div className="font-medium">{formatSlotLocalDateTime(slotLocalStart(slot))}</div>
      <div className="text-muted-foreground">
        {messages.statusLabel}: {getSlotStatusLabel(slot.status, messages)} ·{" "}
        {messages.remainingPaxLabel}: {slot.remainingPax ?? noValue}
      </div>
    </button>
  )
}

function formatSlotLocalDateTime(value: { date: string; time: string }) {
  return `${value.date} ${value.time}`
}

function formatOptionalDateTime(
  value: string | undefined,
  fallback: string,
  formatter: (value: string | number | Date) => string,
) {
  return value ? formatter(value) : fallback
}

function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> <span>{children}</span>
    </div>
  )
}

function DetailEmptyState({
  message,
  backLabel,
  onBack,
}: {
  message: string
  backLabel: string
  onBack?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <p className="text-muted-foreground">{message}</p>
      {onBack ? (
        <Button variant="outline" onClick={onBack}>
          {backLabel}
        </Button>
      ) : null}
    </div>
  )
}
