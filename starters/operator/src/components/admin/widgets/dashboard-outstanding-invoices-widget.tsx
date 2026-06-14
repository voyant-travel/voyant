"use client"

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@voyant-travel/ui/components"
import { AlertCircle } from "lucide-react"

type DashboardOutstandingInvoicesWidgetProps = {
  metrics?: {
    outstandingAmount?: number
    outstandingInvoiceCount?: number
    defaultCurrency?: string
  }
}

function formatCurrency(amountInMinor: number, currency: string | null | undefined): string {
  if (!currency) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountInMinor / 100)
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountInMinor / 100)
}

export function DashboardOutstandingInvoicesWidget({
  metrics,
}: DashboardOutstandingInvoicesWidgetProps) {
  const outstandingInvoiceCount = metrics?.outstandingInvoiceCount ?? 0
  const outstandingAmount = metrics?.outstandingAmount ?? 0
  const defaultCurrency = metrics?.defaultCurrency ?? null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Outstanding Invoices</CardTitle>
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold">
          {formatCurrency(outstandingAmount, defaultCurrency)}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={outstandingInvoiceCount > 0 ? "secondary" : "outline"}>
            {outstandingInvoiceCount}
          </Badge>
          <span>
            {outstandingInvoiceCount === 1 ? "invoice needs attention" : "invoices need attention"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
