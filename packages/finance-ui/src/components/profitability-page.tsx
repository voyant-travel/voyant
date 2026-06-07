"use client"

import {
  type DepartureProfitabilityRow,
  type ProductProfitabilityRow,
  useDepartureProfitability,
  useProductProfitability,
} from "@voyantjs/finance-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@voyantjs/ui/components/chart"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { cn } from "@voyantjs/ui/lib/utils"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { formatInvoiceAmount } from "./invoice-table-parts.js"

const CHART_DEPARTURE_LIMIT = 12
const PIE_COLORS = [
  "hsl(221 83% 53%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(0 72% 51%)",
  "hsl(199 89% 48%)",
  "hsl(280 65% 60%)",
  "hsl(160 60% 45%)",
  "hsl(28 80% 52%)",
]

export interface ProfitabilityPageProps {
  className?: string
}

function marginText(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(1)}%`
}

export function ProfitabilityPage({ className }: ProfitabilityPageProps = {}) {
  const t = useFinanceUiMessagesOrDefault().profitability

  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")
  const [currency, setCurrency] = useState<string>("")

  const filters = { from: from || undefined, to: to || undefined }
  const departures = useDepartureProfitability(filters)
  const products = useProductProfitability(filters)

  const departureReport = departures.data?.data
  const productReport = products.data?.data
  const isError = departures.isError || products.isError

  // Currencies present across departure rows; default to the first.
  const currencies = useMemo(() => {
    const set = new Set<string>()
    for (const row of departureReport?.rows ?? []) set.add(row.currency)
    for (const row of productReport?.rows ?? []) set.add(row.currency)
    return [...set].sort()
  }, [departureReport, productReport])

  const activeCurrency =
    currency && currencies.includes(currency) ? currency : (currencies[0] ?? "")

  const departureRows = useMemo(
    () => (departureReport?.rows ?? []).filter((r) => r.currency === activeCurrency),
    [departureReport, activeCurrency],
  )
  const productRows = useMemo(
    () => (productReport?.rows ?? []).filter((r) => r.currency === activeCurrency),
    [productReport, activeCurrency],
  )

  const totals = useMemo(() => {
    let revenue = 0
    let actual = 0
    let planned = 0
    for (const r of departureRows) {
      revenue += r.revenueCents
      actual += r.actualCostCents
      planned += r.plannedCostCents
    }
    const profit = revenue - actual
    return {
      revenue,
      actual,
      planned,
      profit,
      variance: planned - actual,
      margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null,
    }
  }, [departureRows])

  const unattributed = useMemo(
    () =>
      (departureReport?.unattributed ?? []).find((u) => u.currency === activeCurrency)
        ?.amountCents ?? 0,
    [departureReport, activeCurrency],
  )

  const chartData = useMemo(
    () =>
      [...departureRows]
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, CHART_DEPARTURE_LIMIT)
        .map((r) => ({
          name: r.departureLabel ?? r.departureId,
          revenue: r.revenueCents / 100,
          actualCost: r.actualCostCents / 100,
          profit: r.profitCents / 100,
        })),
    [departureRows],
  )

  const serviceTypeData = useMemo(
    () =>
      (departureReport?.costByServiceType ?? [])
        .filter((c) => c.currency === activeCurrency)
        .map((c, index) => ({
          serviceType: c.serviceType,
          label:
            t.serviceTypeLabels[c.serviceType as keyof typeof t.serviceTypeLabels] ?? c.serviceType,
          amount: c.amountCents / 100,
          fill: PIE_COLORS[index % PIE_COLORS.length],
        })),
    [departureReport, activeCurrency, t.serviceTypeLabels],
  )

  const barConfig: ChartConfig = {
    revenue: { label: t.charts.revenue, color: "hsl(221 83% 53%)" },
    actualCost: { label: t.charts.actualCost, color: "hsl(0 72% 51%)" },
    profit: { label: t.charts.profit, color: "hsl(142 71% 45%)" },
  }
  const pieConfig: ChartConfig = Object.fromEntries(
    serviceTypeData.map((d) => [d.serviceType, { label: d.label, color: d.fill }]),
  )

  const money = (cents: number) => formatInvoiceAmount(cents, activeCurrency)

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label>{t.filters.from}</Label>
            <DatePicker value={from || null} onChange={(v) => setFrom(v ?? "")} className="w-40" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t.filters.to}</Label>
            <DatePicker value={to || null} onChange={(v) => setTo(v ?? "")} className="w-40" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t.filters.currency}</Label>
            <Select
              value={activeCurrency}
              onValueChange={(v) => setCurrency(v ?? "")}
              disabled={!currencies.length}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isError ? (
        <Card>
          <CardContent className="py-10 text-center text-destructive">{t.loadFailed}</CardContent>
        </Card>
      ) : !currencies.length ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t.empty}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label={t.kpis.revenue} value={money(totals.revenue)} />
            <KpiCard label={t.kpis.actualCost} value={money(totals.actual)} />
            <KpiCard
              label={t.kpis.profit}
              value={money(totals.profit)}
              accent={totals.profit >= 0 ? "positive" : "negative"}
            />
            <KpiCard label={t.kpis.margin} value={marginText(totals.margin)} />
            <KpiCard label={t.kpis.plannedCost} value={money(totals.planned)} />
            <KpiCard
              label={t.kpis.variance}
              value={money(totals.variance)}
              accent={totals.variance >= 0 ? "positive" : "negative"}
            />
            <KpiCard label={t.kpis.unattributed} value={money(unattributed)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.charts.departurePnl}</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length ? (
                  <ChartContainer config={barConfig} className="h-[300px] w-full">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value: string) =>
                          value.length > 14 ? `${value.slice(0, 13)}…` : value
                        }
                      />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} width={56} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={2} />
                      <Bar dataKey="actualCost" fill="var(--color-actualCost)" radius={2} />
                      <Bar dataKey="profit" fill="var(--color-profit)" radius={2} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {t.departures.none}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.charts.costByServiceType}</CardTitle>
              </CardHeader>
              <CardContent>
                {serviceTypeData.length ? (
                  <ChartContainer config={pieConfig} className="mx-auto h-[300px] w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
                      <Pie
                        data={serviceTypeData}
                        dataKey="amount"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {serviceTypeData.map((entry) => (
                          <Cell key={entry.serviceType} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="label" />} />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">{t.empty}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.departures.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <DepartureTable rows={departureRows} currency={activeCurrency} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.products.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductTable rows={productRows} currency={activeCurrency} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: "positive" | "negative"
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-2xl tabular-nums",
            accent === "positive" && "text-emerald-600 dark:text-emerald-500",
            accent === "negative" && "text-destructive",
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function DepartureTable({
  rows,
  currency,
}: {
  rows: DepartureProfitabilityRow[]
  currency: string
}) {
  const t = useFinanceUiMessagesOrDefault().profitability
  const money = (cents: number) => formatInvoiceAmount(cents, currency)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.departures.columns.departure}</TableHead>
          <TableHead>{t.departures.columns.date}</TableHead>
          <TableHead>{t.departures.columns.product}</TableHead>
          <TableHead className="text-right">{t.departures.columns.revenue}</TableHead>
          <TableHead className="text-right">{t.departures.columns.actualCost}</TableHead>
          <TableHead className="text-right">{t.departures.columns.plannedCost}</TableHead>
          <TableHead className="text-right">{t.departures.columns.profit}</TableHead>
          <TableHead className="text-right">{t.departures.columns.margin}</TableHead>
          <TableHead className="text-right">{t.departures.columns.variance}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center text-muted-foreground">
              {t.departures.none}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={`${row.departureId}:${row.currency}`}>
              <TableCell className="font-medium">{row.departureLabel ?? row.departureId}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.departureDate ?? t.noDate}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.productName ?? t.noProduct}
              </TableCell>
              <TableCell className="text-right tabular-nums">{money(row.revenueCents)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {money(row.actualCostCents)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {money(row.plannedCostCents)}
              </TableCell>
              <TableCell
                className={cn("text-right tabular-nums", row.profitCents < 0 && "text-destructive")}
              >
                {money(row.profitCents)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {marginText(row.marginPercent)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  row.varianceCents < 0 && "text-destructive",
                )}
              >
                {money(row.varianceCents)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

function ProductTable({ rows, currency }: { rows: ProductProfitabilityRow[]; currency: string }) {
  const t = useFinanceUiMessagesOrDefault().profitability
  const money = (cents: number) => formatInvoiceAmount(cents, currency)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.products.columns.product}</TableHead>
          <TableHead className="text-right">{t.products.columns.departures}</TableHead>
          <TableHead className="text-right">{t.products.columns.revenue}</TableHead>
          <TableHead className="text-right">{t.products.columns.actualCost}</TableHead>
          <TableHead className="text-right">{t.products.columns.plannedCost}</TableHead>
          <TableHead className="text-right">{t.products.columns.profit}</TableHead>
          <TableHead className="text-right">{t.products.columns.margin}</TableHead>
          <TableHead className="text-right">{t.products.columns.variance}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              {t.products.none}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={`${row.productId}:${row.currency}`}>
              <TableCell className="font-medium">{row.productName ?? row.productId}</TableCell>
              <TableCell className="text-right tabular-nums">{row.departureCount}</TableCell>
              <TableCell className="text-right tabular-nums">{money(row.revenueCents)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {money(row.actualCostCents)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {money(row.plannedCostCents)}
              </TableCell>
              <TableCell
                className={cn("text-right tabular-nums", row.profitCents < 0 && "text-destructive")}
              >
                {money(row.profitCents)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {marginText(row.marginPercent)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  row.varianceCents < 0 && "text-destructive",
                )}
              >
                {money(row.varianceCents)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
