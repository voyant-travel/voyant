import { useQuery } from "@tanstack/react-query"
import { formatMessage } from "@voyantjs/admin"
import { Badge, Button } from "@voyantjs/ui/components"
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import {
  type DayService,
  getProductDayServicesQueryOptions,
  type ProductDay,
} from "./product-detail-shared"

export function DayRow({
  day,
  productId,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddService,
  onEditService,
  onDeleteService,
}: {
  day: ProductDay
  productId: string
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddService: () => void
  onEditService: (service: DayService) => void
  onDeleteService: (serviceId: string) => void
}) {
  const messages = useAdminMessages().products
  const serviceTypeLabels: Record<DayService["serviceType"], string> = {
    accommodation: messages.serviceTypeAccommodation,
    transfer: messages.serviceTypeTransfer,
    experience: messages.serviceTypeExperience,
    guide: messages.serviceTypeGuide,
    meal: messages.serviceTypeMeal,
    other: messages.serviceTypeOther,
  }
  const { data: servicesData } = useQuery({
    ...getProductDayServicesQueryOptions(productId, day.id),
    enabled: expanded,
  })

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1">
          <span className="text-sm font-medium">
            {formatMessage(messages.dayRowTitle, { dayNumber: String(day.dayNumber) })}
            {day.title ? `: ${day.title}` : ""}
          </span>
          {day.location && (
            <span className="ml-2 text-xs text-muted-foreground">{day.location}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {messages.servicesTitle}
            </p>
            <Button variant="outline" size="sm" onClick={onAddService}>
              <Plus className="mr-1 h-3 w-3" />
              {messages.addServiceAction}
            </Button>
          </div>

          {(!servicesData?.data || servicesData.data.length === 0) && (
            <p className="py-2 text-center text-xs text-muted-foreground">{messages.noServices}</p>
          )}

          {servicesData?.data && servicesData.data.length > 0 && (
            <div className="rounded border bg-background">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">{messages.serviceColumnName}</th>
                    <th className="p-2 text-left font-medium">{messages.serviceColumnType}</th>
                    <th className="p-2 text-left font-medium">{messages.serviceColumnCost}</th>
                    <th className="p-2 text-left font-medium">{messages.serviceColumnQuantity}</th>
                    <th className="w-16 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {servicesData.data.map((service) => (
                    <tr key={service.id} className="border-b last:border-b-0">
                      <td className="p-2">{service.name}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {serviceTypeLabels[service.serviceType] ?? service.serviceType}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono">
                        {(service.costAmountCents / 100).toFixed(2)} {service.costCurrency}
                      </td>
                      <td className="p-2">{service.quantity}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditService(service)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteService(service.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
