import { useQueries } from "@tanstack/react-query"
import {
  getRatePlanQueryOptions,
  getRoomTypeQueryOptions,
  type RoomTypeRateRecord,
  useRoomTypeRateMutation,
  useRoomTypeRates,
  useVoyantHospitalityContext,
} from "@voyantjs/hospitality-react"
import { PaginationFooter } from "@voyantjs/hospitality-ui/components/pagination-footer"
import { RatePlanCombobox } from "@voyantjs/hospitality-ui/components/rate-plan-combobox"
import { RoomTypeCombobox } from "@voyantjs/hospitality-ui/components/room-type-combobox"
import { getPriceScheduleQueryOptions, useVoyantPricingContext } from "@voyantjs/pricing-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { type RoomTypeRateData, RoomTypeRateDialog } from "./room-type-rate-dialog"

type Props = { propertyId: string }
const PAGE_SIZE = 25

function formatAmount(cents: number | null, currency: string): string {
  if (cents == null) return "-"
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function RoomTypeRatesTab({ propertyId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RoomTypeRateData | undefined>()
  const [filterRatePlanId, setFilterRatePlanId] = useState("")
  const [filterRoomTypeId, setFilterRoomTypeId] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending } = useRoomTypeRates({
    ratePlanId: filterRatePlanId || undefined,
    roomTypeId: filterRoomTypeId || undefined,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useRoomTypeRateMutation()
  const { baseUrl: hospitalityBaseUrl, fetcher: hospitalityFetcher } = useVoyantHospitalityContext()
  const { baseUrl: pricingBaseUrl, fetcher: pricingFetcher } = useVoyantPricingContext()

  const rows = (data?.data ?? []) as RoomTypeRateRecord[]
  const ratePlanIds = Array.from(
    new Set([
      ...rows.map((row) => row.ratePlanId),
      ...(filterRatePlanId ? [filterRatePlanId] : []),
    ]),
  )
  const roomTypeIds = Array.from(
    new Set([
      ...rows.map((row) => row.roomTypeId),
      ...(filterRoomTypeId ? [filterRoomTypeId] : []),
    ]),
  )
  const scheduleIds = Array.from(new Set(rows.map((row) => row.priceScheduleId).filter(Boolean)))
  const ratePlanQueries = useQueries({
    queries: ratePlanIds.map((id) =>
      getRatePlanQueryOptions({ baseUrl: hospitalityBaseUrl, fetcher: hospitalityFetcher }, id),
    ),
  })
  const roomTypeQueries = useQueries({
    queries: roomTypeIds.map((id) =>
      getRoomTypeQueryOptions({ baseUrl: hospitalityBaseUrl, fetcher: hospitalityFetcher }, id),
    ),
  })
  const scheduleQueries = useQueries({
    queries: scheduleIds.map((id) =>
      getPriceScheduleQueryOptions({ baseUrl: pricingBaseUrl, fetcher: pricingFetcher }, id!),
    ),
  })
  const ratePlanMap = new Map(
    ratePlanQueries.flatMap((query) => (query.data ? [[query.data.id, query.data]] : [])),
  )
  const roomTypeMap = new Map(
    roomTypeQueries.flatMap((query) => (query.data ? [[query.data.id, query.data.name]] : [])),
  )
  const scheduleMap = new Map(
    scheduleQueries.flatMap((query) => (query.data ? [[query.data.id, query.data.name]] : [])),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Base rate pricing per rate plan, room type, and season.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Rate
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="w-56">
          <RatePlanCombobox
            propertyId={propertyId}
            value={filterRatePlanId}
            onChange={(value) => {
              setFilterRatePlanId(value ?? "")
              setPageIndex(0)
            }}
            placeholder="All rate plans"
          />
        </div>
        <div className="w-56">
          <RoomTypeCombobox
            propertyId={propertyId}
            value={filterRoomTypeId}
            onChange={(value) => {
              setFilterRoomTypeId(value ?? "")
              setPageIndex(0)
            }}
            placeholder="All room types"
          />
        </div>
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isPending && rows.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No room type rates yet.</p>
        </div>
      )}

      {!isPending && rows.length > 0 && (
        <div className="rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3 text-left font-medium">Rate Plan</th>
                <th className="p-3 text-left font-medium">Room Type</th>
                <th className="p-3 text-left font-medium">Season</th>
                <th className="p-3 text-left font-medium">Currency</th>
                <th className="p-3 text-right font-medium">Base Rate</th>
                <th className="p-3 text-right font-medium">Extra Adult</th>
                <th className="p-3 text-right font-medium">Extra Child</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rpName = ratePlanMap.get(row.ratePlanId)?.name ?? row.ratePlanId
                const rtName = roomTypeMap.get(row.roomTypeId) ?? row.roomTypeId
                const seasonName = row.priceScheduleId
                  ? (scheduleMap.get(row.priceScheduleId) ?? "Unknown")
                  : "Base"
                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="p-3 font-medium">{rpName}</td>
                    <td className="p-3">{rtName}</td>
                    <td className="p-3 text-muted-foreground">{seasonName}</td>
                    <td className="p-3 font-mono text-xs">{row.currencyCode}</td>
                    <td className="p-3 text-right font-mono text-xs">
                      {formatAmount(row.baseAmountCents, row.currencyCode)}
                    </td>
                    <td className="p-3 text-right font-mono text-xs">
                      {formatAmount(row.extraAdultAmountCents, row.currencyCode)}
                    </td>
                    <td className="p-3 text-right font-mono text-xs">
                      {formatAmount(row.extraChildAmountCents, row.currencyCode)}
                    </td>
                    <td className="p-3">
                      <Badge variant={row.active ? "default" : "outline"}>
                        {row.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(row)
                            setDialogOpen(true)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Delete this rate?")) {
                              remove.mutate(row.id)
                            }
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationFooter
        pageIndex={pageIndex}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageIndexChange={setPageIndex}
      />

      <RoomTypeRateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        roomTypeRate={editing}
        onSuccess={() => {
          setDialogOpen(false)
          setEditing(undefined)
        }}
      />
    </div>
  )
}
