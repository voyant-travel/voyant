"use client"

import {
  type ProductDayRecord,
  type ProductDayServiceRecord,
  useProductDayMutation,
  useProductDayServiceMutation,
  useProductDayServices,
  useProductItineraries,
  useProductItineraryDays,
} from "@voyantjs/products-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { DayDialog } from "./product-day-dialog"
import { ServiceDialog } from "./product-service-dialog"

const serviceTypeLabels = {
  accommodation: "Accommodation",
  transfer: "Transfer",
  experience: "Experience",
  guide: "Guide",
  meal: "Meal",
  other: "Other",
} as const

export function ProductItinerarySection({ productId }: { productId: string }) {
  const [expandedDayId, setExpandedDayId] = React.useState<string | null>(null)
  const [dayDialogOpen, setDayDialogOpen] = React.useState(false)
  const [editingDayId, setEditingDayId] = React.useState<string | null>(null)
  const [serviceDialogOpen, setServiceDialogOpen] = React.useState(false)
  const [serviceDayId, setServiceDayId] = React.useState("")
  const [editingService, setEditingService] = React.useState<ProductDayServiceRecord | undefined>()

  const { data: itineraryData } = useProductItineraries(productId)
  const itineraries = itineraryData?.data ?? []
  const selectedItineraryId =
    itineraries.find((itinerary) => itinerary.isDefault)?.id ?? itineraries[0]?.id ?? ""
  const { data, isPending, isError } = useProductItineraryDays(productId, selectedItineraryId, {
    enabled: Boolean(selectedItineraryId),
  })
  const { remove } = useProductDayMutation()
  const days = React.useMemo(
    () => (data?.data ?? []).slice().sort((left, right) => left.dayNumber - right.dayNumber),
    [data?.data],
  )
  const nextDayNumber = days.length > 0 ? Math.max(...days.map((day) => day.dayNumber)) + 1 : 1
  const editingDay = React.useMemo(
    () => days.find((day) => day.id === editingDayId),
    [days, editingDayId],
  )

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Itinerary</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage day-by-day structure and attached services for this product.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingDayId(null)
            setDayDialogOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Add day
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isPending ? (
          <div className="flex min-h-24 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load itinerary days.</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-muted-foreground">No itinerary days configured yet.</p>
        ) : (
          days.map((day) => (
            <DayRow
              key={day.id}
              productId={productId}
              day={day}
              expanded={expandedDayId === day.id}
              onToggle={() => setExpandedDayId((current) => (current === day.id ? null : day.id))}
              onEdit={() => {
                setEditingDayId(day.id)
                setDayDialogOpen(true)
              }}
              onDelete={() => {
                if (confirm("Delete this day and all its services?")) {
                  remove.mutate({ productId, dayId: day.id })
                }
              }}
              onAddService={() => {
                setServiceDayId(day.id)
                setEditingService(undefined)
                setServiceDialogOpen(true)
              }}
              onEditService={(service) => {
                setServiceDayId(day.id)
                setEditingService(service)
                setServiceDialogOpen(true)
              }}
            />
          ))
        )}

        <DayDialog
          open={dayDialogOpen}
          onOpenChange={setDayDialogOpen}
          productId={productId}
          itineraryId={selectedItineraryId ?? ""}
          day={editingDay}
          nextDayNumber={nextDayNumber}
          onSuccess={() => {
            setEditingDayId(null)
            setDayDialogOpen(false)
          }}
        />
        <ServiceDialog
          open={serviceDialogOpen}
          onOpenChange={setServiceDialogOpen}
          productId={productId}
          dayId={serviceDayId}
          service={editingService}
          onSuccess={() => {
            setEditingService(undefined)
            setServiceDialogOpen(false)
          }}
        />
      </CardContent>
    </Card>
  )
}

function DayRow({
  productId,
  day,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddService,
  onEditService,
}: {
  productId: string
  day: ProductDayRecord
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddService: () => void
  onEditService: (service: ProductDayServiceRecord) => void
}) {
  const { data, isPending, isError } = useProductDayServices(productId, day.id, {
    enabled: expanded,
  })

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <div className="flex-1">
          <span className="text-sm font-medium">
            Day {day.dayNumber}
            {day.title ? `: ${day.title}` : ""}
          </span>
          {day.location ? (
            <span className="ml-2 text-xs text-muted-foreground">{day.location}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="flex flex-col gap-3 border-t bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Services
              </p>
              {day.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{day.description}</p>
              ) : null}
            </div>
            <Button variant="outline" size="sm" onClick={onAddService}>
              <Plus className="mr-2 size-3.5" aria-hidden="true" />
              Add service
            </Button>
          </div>

          {isPending ? (
            <div className="flex min-h-20 items-center justify-center rounded-md border bg-background">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">Failed to load day services.</p>
          ) : !data?.data.length ? (
            <p className="rounded-md border bg-background px-3 py-4 text-sm text-muted-foreground">
              No services configured for this day.
            </p>
          ) : (
            <ServicesTable
              productId={productId}
              dayId={day.id}
              services={data.data}
              onEditService={onEditService}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

function ServicesTable({
  productId,
  dayId,
  services,
  onEditService,
}: {
  productId: string
  dayId: string
  services: ProductDayServiceRecord[]
  onEditService: (service: ProductDayServiceRecord) => void
}) {
  const serviceMutation = useProductDayServiceMutation()
  const sorted = React.useMemo(
    () =>
      services
        .slice()
        .sort(
          (left, right) => (left.sortOrder ?? left.quantity) - (right.sortOrder ?? right.quantity),
        ),
    [services],
  )

  return (
    <div className="rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((service) => (
            <TableRow key={service.id}>
              <TableCell>{service.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{serviceTypeLabels[service.serviceType]}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {(service.costAmountCents / 100).toFixed(2)} {service.costCurrency}
              </TableCell>
              <TableCell>{service.quantity}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => onEditService(service)}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      if (confirm("Delete this service?")) {
                        serviceMutation.remove.mutate({
                          productId,
                          dayId,
                          serviceId: service.id,
                        })
                      }
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
