"use client"

import { confirmDialog } from "@voyant-travel/ui/components"
import { Button } from "@voyant-travel/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyant-travel/ui/components/select"
import { Edit, Loader2, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { useProductsUiMessagesOrDefault } from "../i18n/provider.js"
import {
  type ProductDayRecord,
  type ProductDayServiceRecord,
  type ProductItineraryRecord,
  useProductDayMutation,
  useProductDayServiceMutation,
  useProductItineraries,
  useProductItineraryDays,
  useProductItineraryMutation,
} from "../index.js"
import { ProductDayDialog } from "./product-day-dialog.js"
import { ProductDayServiceDialog } from "./product-day-service-dialog.js"
import type { ProductDayServiceFormProps } from "./product-day-service-form.js"
import {
  ProductItineraryDayRow,
  type ProductItineraryDayRowRenderContext,
} from "./product-itinerary-day-row.js"
import { ProductItineraryDialog } from "./product-itinerary-dialog.js"

export interface ProductItinerarySectionProps {
  productId: string
  title?: string
  description?: string
  renderDayDetails?: (context: ProductItineraryDayRowRenderContext) => React.ReactNode
  renderServiceActions?: (service: ProductDayServiceRecord) => React.ReactNode
  renderSupplierServiceField?: ProductDayServiceFormProps["renderSupplierServiceField"]
  onSupplierServiceSelected?: ProductDayServiceFormProps["onSupplierServiceSelected"]
  className?: string
}

export function ProductItinerarySection({
  productId,
  title,
  description,
  renderDayDetails,
  renderServiceActions,
  renderSupplierServiceField,
  onSupplierServiceSelected,
  className,
}: ProductItinerarySectionProps) {
  const messages = useProductsUiMessagesOrDefault()
  const pageMessages = messages.productDetailPage
  const itinerariesQuery = useProductItineraries(productId)
  const itineraries = React.useMemo(
    () => (itinerariesQuery.data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [itinerariesQuery.data?.data],
  )
  const [selectedItineraryId, setSelectedItineraryId] = React.useState<string | null>(null)
  const selectedItinerary =
    itineraries.find((itinerary) => itinerary.id === selectedItineraryId) ?? null
  const daysQuery = useProductItineraryDays(productId, selectedItineraryId, {
    enabled: Boolean(selectedItineraryId),
  })
  const days = React.useMemo(
    () => (daysQuery.data?.data ?? []).slice().sort((a, b) => a.dayNumber - b.dayNumber),
    [daysQuery.data?.data],
  )
  const itineraryMutation = useProductItineraryMutation()
  const dayMutation = useProductDayMutation()
  const serviceMutation = useProductDayServiceMutation()
  const [itineraryDialogOpen, setItineraryDialogOpen] = React.useState(false)
  const [editingItinerary, setEditingItinerary] = React.useState<ProductItineraryRecord | null>(
    null,
  )
  const [dayDialogOpen, setDayDialogOpen] = React.useState(false)
  const [editingDay, setEditingDay] = React.useState<ProductDayRecord | null>(null)
  const [serviceDialogOpen, setServiceDialogOpen] = React.useState(false)
  const [serviceDayId, setServiceDayId] = React.useState<string | null>(null)
  const [editingService, setEditingService] = React.useState<ProductDayServiceRecord | null>(null)
  const [expandedDayId, setExpandedDayId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (itineraries.length === 0) {
      setSelectedItineraryId(null)
      return
    }

    setSelectedItineraryId((current) => {
      if (current && itineraries.some((itinerary) => itinerary.id === current)) return current
      return itineraries.find((itinerary) => itinerary.isDefault)?.id ?? itineraries[0]?.id ?? null
    })
  }, [itineraries])

  const nextDayNumber = days.length > 0 ? Math.max(...days.map((day) => day.dayNumber)) + 1 : 1

  return (
    <Card data-slot="product-itinerary-section" className={className}>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <CardTitle>{title ?? pageMessages.sections.itinerary.title}</CardTitle>
          <CardDescription>
            {description ?? pageMessages.sections.itinerary.description}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {itineraries.length > 0 ? (
            <Select
              value={selectedItineraryId ?? undefined}
              onValueChange={(value) => setSelectedItineraryId(value)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itineraries.map((itinerary) => (
                  <SelectItem key={itinerary.id} value={itinerary.id}>
                    {itinerary.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditingItinerary(null)
              setItineraryDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {pageMessages.actions.addItinerary}
          </Button>
          {selectedItinerary ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingItinerary(selectedItinerary)
                  setItineraryDialogOpen(true)
                }}
              >
                <Edit className="mr-2 size-4" aria-hidden="true" />
                {pageMessages.actions.editItinerary}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (
                    !(await confirmDialog({
                      description: pageMessages.states.deleteItineraryConfirm.replace(
                        "{name}",
                        selectedItinerary.name,
                      ),
                      destructive: true,
                    }))
                  ) {
                    return
                  }
                  void itineraryMutation.remove.mutateAsync({
                    productId,
                    itineraryId: selectedItinerary.id,
                  })
                }}
              >
                <Trash2 className="mr-2 size-4" aria-hidden="true" />
                {pageMessages.actions.deleteItinerary}
              </Button>
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {itinerariesQuery.isPending ? (
          <div className="flex min-h-24 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : itinerariesQuery.isError ? (
          <p className="text-sm text-destructive">{pageMessages.states.loadFailed}</p>
        ) : itineraries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{pageMessages.states.noItineraries}</p>
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  setEditingDay(null)
                  setDayDialogOpen(true)
                }}
                disabled={!selectedItineraryId}
              >
                <Plus className="mr-2 size-4" aria-hidden="true" />
                {pageMessages.actions.addDay}
              </Button>
            </div>
            {daysQuery.isPending ? (
              <div className="flex min-h-24 items-center justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            ) : daysQuery.isError ? (
              <p className="text-sm text-destructive">{pageMessages.states.loadFailed}</p>
            ) : days.length === 0 ? (
              <p className="text-sm text-muted-foreground">{pageMessages.states.noDays}</p>
            ) : (
              days.map((day) => (
                <ProductItineraryDayRow
                  key={day.id}
                  productId={productId}
                  day={day}
                  expanded={expandedDayId === day.id}
                  onToggle={() =>
                    setExpandedDayId((current) => (current === day.id ? null : day.id))
                  }
                  onEdit={() => {
                    setEditingDay(day)
                    setDayDialogOpen(true)
                  }}
                  onDelete={async () => {
                    if (
                      !(await confirmDialog({
                        description: pageMessages.states.deleteDayConfirm.replace(
                          "{dayNumber}",
                          String(day.dayNumber),
                        ),
                        destructive: true,
                      }))
                    ) {
                      return
                    }
                    void dayMutation.remove.mutateAsync({
                      productId,
                      dayId: day.id,
                      itineraryId: day.itineraryId,
                    })
                  }}
                  onAddService={() => {
                    setServiceDayId(day.id)
                    setEditingService(null)
                    setExpandedDayId(day.id)
                    setServiceDialogOpen(true)
                  }}
                  onEditService={(service) => {
                    setServiceDayId(day.id)
                    setEditingService(service)
                    setExpandedDayId(day.id)
                    setServiceDialogOpen(true)
                  }}
                  onDeleteService={async (service) => {
                    if (
                      !(await confirmDialog({
                        description: pageMessages.states.deleteServiceConfirm.replace(
                          "{name}",
                          service.name,
                        ),
                        destructive: true,
                      }))
                    ) {
                      return
                    }
                    void serviceMutation.remove.mutateAsync({
                      productId,
                      dayId: day.id,
                      serviceId: service.id,
                    })
                  }}
                  renderDayDetails={renderDayDetails}
                  renderServiceActions={renderServiceActions}
                />
              ))
            )}
          </>
        )}
      </CardContent>

      <ProductItineraryDialog
        open={itineraryDialogOpen}
        onOpenChange={setItineraryDialogOpen}
        productId={productId}
        itinerary={editingItinerary ?? undefined}
        itineraryCount={itineraries.length}
        onSuccess={(itineraryId) => setSelectedItineraryId(itineraryId)}
      />
      {selectedItineraryId ? (
        <ProductDayDialog
          open={dayDialogOpen}
          onOpenChange={setDayDialogOpen}
          productId={productId}
          itineraryId={selectedItineraryId}
          day={editingDay ?? undefined}
          nextDayNumber={nextDayNumber}
          onSuccess={(day) => {
            setExpandedDayId(day.id)
            setEditingDay(null)
          }}
        />
      ) : null}
      {serviceDayId ? (
        <ProductDayServiceDialog
          open={serviceDialogOpen}
          onOpenChange={(open) => {
            setServiceDialogOpen(open)
            if (!open) {
              setEditingService(null)
            }
          }}
          productId={productId}
          dayId={serviceDayId}
          service={editingService ?? undefined}
          renderSupplierServiceField={renderSupplierServiceField}
          onSupplierServiceSelected={onSupplierServiceSelected}
          onSuccess={() => setEditingService(null)}
        />
      ) : null}
    </Card>
  )
}
