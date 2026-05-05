"use client"

import {
  type ProductDayRecord,
  type ProductDayServiceRecord,
  useProductDayServices,
} from "@voyantjs/products-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import type * as React from "react"

import { useProductsUiMessagesOrDefault } from "../i18n/provider"

export interface ProductItineraryDayRowRenderContext {
  productId: string
  day: ProductDayRecord
  expanded: boolean
}

export interface ProductItineraryDayRowProps {
  productId: string
  day: ProductDayRecord
  expanded: boolean
  onToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
  onAddService?: () => void
  onEditService?: (service: ProductDayServiceRecord) => void
  onDeleteService?: (service: ProductDayServiceRecord) => void
  renderDayDetails?: (context: ProductItineraryDayRowRenderContext) => React.ReactNode
  renderServiceActions?: (service: ProductDayServiceRecord) => React.ReactNode
}

function formatServiceType(
  serviceType: ProductDayServiceRecord["serviceType"],
  messages: ReturnType<typeof useProductsUiMessagesOrDefault>["productDayServiceForm"],
) {
  return messages.serviceTypes[serviceType]
}

export function ProductItineraryDayRow({
  productId,
  day,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddService,
  onEditService,
  onDeleteService,
  renderDayDetails,
  renderServiceActions,
}: ProductItineraryDayRowProps) {
  const messages = useProductsUiMessagesOrDefault()
  const rowMessages = messages.productItineraryDayRow
  const servicesQuery = useProductDayServices(productId, day.id, { enabled: expanded })
  const services = servicesQuery.data?.data ?? []

  return (
    <div data-slot="product-itinerary-day-row" className="rounded-md border bg-background">
      <div className="flex items-center gap-3 px-4 py-3">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onToggle}>
          {expanded ? (
            <ChevronDown className="size-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4" aria-hidden="true" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {rowMessages.dayLabel.replace("{dayNumber}", String(day.dayNumber))}
            {day.title ? `: ${day.title}` : ""}
          </div>
          {day.location ? (
            <div className="truncate text-xs text-muted-foreground">{day.location}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {onAddService ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onAddService}>
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          {onEdit ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete}>
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="border-t">
          {renderDayDetails ? (
            <div className="border-b p-4">{renderDayDetails({ productId, day, expanded })}</div>
          ) : null}

          {servicesQuery.isPending ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {messages.common.loading}
            </p>
          ) : servicesQuery.isError ? (
            <p className="p-4 text-center text-sm text-destructive">
              {rowMessages.servicesLoadingError}
            </p>
          ) : services.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {rowMessages.emptyServices}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">{rowMessages.columns.name}</th>
                    <th className="px-3 py-2 text-left font-medium">{rowMessages.columns.type}</th>
                    <th className="px-3 py-2 text-left font-medium">{rowMessages.columns.cost}</th>
                    <th className="px-3 py-2 text-left font-medium">
                      {rowMessages.columns.quantity}
                    </th>
                    <th className="w-24 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{service.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">
                          {formatServiceType(service.serviceType, messages.productDayServiceForm)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {(service.costAmountCents / 100).toFixed(2)} {service.costCurrency}
                      </td>
                      <td className="px-3 py-2">{service.quantity}</td>
                      <td className="px-3 py-2">
                        {renderServiceActions ? (
                          renderServiceActions(service)
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {onEditService ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => onEditService(service)}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </Button>
                            ) : null}
                            {onDeleteService ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => onDeleteService(service)}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
