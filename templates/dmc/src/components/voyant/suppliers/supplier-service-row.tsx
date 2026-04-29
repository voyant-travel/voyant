import { useQuery } from "@tanstack/react-query"
import { formatMessage } from "@voyantjs/admin"
import { Badge, Button } from "@voyantjs/ui/components"
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import {
  formatAmount,
  getSupplierServiceRatesQueryOptions,
  type SupplierRate,
  type SupplierService,
} from "./shared"

export function SupplierServiceRow({
  service,
  supplierId,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddRate,
  onEditRate,
  onDeleteRate,
}: {
  service: SupplierService
  supplierId: string
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddRate: () => void
  onEditRate: (rate: SupplierRate) => void
  onDeleteRate: (rateId: string) => void
}) {
  const messages = useAdminMessages().suppliersModule
  const { data: ratesData } = useQuery({
    ...getSupplierServiceRatesQueryOptions(supplierId, service.id),
    enabled: expanded,
  })
  const serviceTypeLabels: Record<SupplierService["serviceType"], string> = {
    accommodation: messages.serviceTypeAccommodation,
    transfer: messages.serviceTypeTransfer,
    experience: messages.serviceTypeExperience,
    guide: messages.serviceTypeGuide,
    meal: messages.serviceTypeMeal,
    other: messages.serviceTypeOther,
  }
  const rateUnitLabels: Record<SupplierRate["unit"], string> = {
    per_person: messages.rateUnitPerPerson,
    per_group: messages.rateUnitPerGroup,
    per_night: messages.rateUnitPerNight,
    per_vehicle: messages.rateUnitPerVehicle,
    flat: messages.rateUnitFlat,
  }

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
          <span className="text-sm font-medium">{service.name}</span>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge variant="outline" className="text-xs capitalize">
              {serviceTypeLabels[service.serviceType] ?? service.serviceType}
            </Badge>
            {service.duration && (
              <span className="text-xs text-muted-foreground">{service.duration}</span>
            )}
            {service.capacity && (
              <span className="text-xs text-muted-foreground">
                {formatMessage(messages.maxPaxSummary, { count: String(service.capacity) })}
              </span>
            )}
            {!service.active && (
              <Badge variant="secondary" className="text-xs">
                {messages.inactiveBadge}
              </Badge>
            )}
          </div>
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
              {messages.ratesTitle}
            </p>
            <Button variant="outline" size="sm" onClick={onAddRate}>
              <Plus className="mr-1 h-3 w-3" />
              {messages.addRateAction}
            </Button>
          </div>

          {(!ratesData?.data || ratesData.data.length === 0) && (
            <p className="py-2 text-center text-xs text-muted-foreground">{messages.noRates}</p>
          )}

          {ratesData?.data && ratesData.data.length > 0 && (
            <div className="rounded border bg-background">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">{messages.rateColumnName}</th>
                    <th className="p-2 text-left font-medium">{messages.rateColumnAmount}</th>
                    <th className="p-2 text-left font-medium">{messages.rateColumnUnit}</th>
                    <th className="p-2 text-left font-medium">{messages.rateColumnValid}</th>
                    <th className="p-2 text-left font-medium">{messages.rateColumnPax}</th>
                    <th className="w-16 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {ratesData.data.map((rate) => (
                    <tr key={rate.id} className="border-b last:border-b-0">
                      <td className="p-2">{rate.name}</td>
                      <td className="p-2 font-mono">
                        {formatAmount(rate.amountCents, rate.currency)}
                      </td>
                      <td className="p-2 capitalize">{rateUnitLabels[rate.unit] ?? rate.unit}</td>
                      <td className="p-2">
                        {rate.validFrom || rate.validTo
                          ? `${rate.validFrom ?? "..."} — ${rate.validTo ?? "..."}`
                          : messages.noValue}
                      </td>
                      <td className="p-2">
                        {rate.minPax || rate.maxPax
                          ? `${rate.minPax ?? messages.unknownRange}-${rate.maxPax ?? messages.unknownRange}`
                          : messages.noValue}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditRate(rate)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRate(rate.id)}
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

export { SupplierServiceRow as ServiceRow }
