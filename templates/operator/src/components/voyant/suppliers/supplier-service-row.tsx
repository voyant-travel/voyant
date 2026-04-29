import { useQuery } from "@tanstack/react-query"
import { formatMessage } from "@voyantjs/admin"
import { Badge, Button } from "@voyantjs/ui/components"
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import {
  formatAmount,
  getRateUnitLabel,
  getServiceTypeLabel,
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
  const messages = useAdminMessages()
  const detailMessages = messages.suppliers.details
  const { data: ratesData } = useQuery({
    ...getSupplierServiceRatesQueryOptions(supplierId, service.id),
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
          <span className="text-sm font-medium">{service.name}</span>
          <div className="mt-0.5 flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {getServiceTypeLabel(service.serviceType, messages)}
            </Badge>
            {service.duration && (
              <span className="text-xs text-muted-foreground">{service.duration}</span>
            )}
            {service.capacity && (
              <span className="text-xs text-muted-foreground">
                {formatMessage(detailMessages.maxPaxLabel, { count: service.capacity })}
              </span>
            )}
            {!service.active && (
              <Badge variant="secondary" className="text-xs">
                {detailMessages.inactiveBadge}
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
              {detailMessages.ratesTitle}
            </p>
            <Button variant="outline" size="sm" onClick={onAddRate}>
              <Plus className="mr-1 h-3 w-3" />
              {detailMessages.addRate}
            </Button>
          </div>

          {(!ratesData?.data || ratesData.data.length === 0) && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              {detailMessages.noRates}
            </p>
          )}

          {ratesData?.data && ratesData.data.length > 0 && (
            <div className="rounded border bg-background">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left font-medium">{messages.suppliers.nameColumn}</th>
                    <th className="p-2 text-left font-medium">
                      {messages.suppliers.dialogs.rate.amountLabel}
                    </th>
                    <th className="p-2 text-left font-medium">
                      {messages.suppliers.dialogs.rate.unitLabel}
                    </th>
                    <th className="p-2 text-left font-medium">{detailMessages.validColumn}</th>
                    <th className="p-2 text-left font-medium">{detailMessages.paxColumn}</th>
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
                      <td className="p-2">{getRateUnitLabel(rate.unit, messages)}</td>
                      <td className="p-2">
                        {rate.validFrom || rate.validTo
                          ? `${rate.validFrom ?? "..."} — ${rate.validTo ?? "..."}`
                          : "-"}
                      </td>
                      <td className="p-2">
                        {rate.minPax || rate.maxPax
                          ? `${rate.minPax ?? "?"}-${rate.maxPax ?? "?"}`
                          : "-"}
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
