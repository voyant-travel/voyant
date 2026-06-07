"use client"

import { useQuery } from "@tanstack/react-query"
import {
  type DepartureProfitabilityReport,
  defaultFetcher,
  getAccountantInvoicesQueryOptions,
  getAccountantSummaryQueryOptions,
} from "@voyantjs/finance-react"
import {
  Badge,
  Button,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { cn } from "@voyantjs/ui/lib/utils"
import { Download, Globe } from "lucide-react"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"

import {
  FinanceUiMessagesProvider,
  financeUiMessageDefinitions,
  useFinanceUiMessagesOrDefault,
} from "../i18n/index.js"
import { AsyncCombobox, localOptionSearch } from "./async-combobox.js"
import { formatInvoiceAmount } from "./invoice-table-parts.js"

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
const CHART_DEPARTURE_LIMIT = 12

const marginText = (value: number | null) => (value == null ? "—" : `${value.toFixed(1)}%`)

const LOCALES = Object.keys(financeUiMessageDefinitions)
const LOCALE_NAMES: Record<string, string> = { en: "English", ro: "Română" }

function initialLocale(defaultLocale?: string): string {
  const candidates = [defaultLocale, typeof navigator !== "undefined" ? navigator.language : null]
  for (const c of candidates) {
    const code = c?.toLowerCase().split("-")[0]
    if (code && LOCALES.includes(code)) return code
  }
  return "en"
}

export interface AccountantPortalProps {
  token: string
  /** Absolute API origin used for the public portal endpoints + download links. */
  apiBaseUrl: string
  className?: string
  /** Initial language (operator's configured locale); the accountant can switch. */
  defaultLocale?: string
}

export function AccountantPortal({ defaultLocale, ...props }: AccountantPortalProps) {
  const [locale, setLocale] = useState(() => initialLocale(defaultLocale))
  return (
    <FinanceUiMessagesProvider locale={locale}>
      <AccountantPortalBody {...props} locale={locale} onLocaleChange={setLocale} />
    </FinanceUiMessagesProvider>
  )
}

function AccountantPortalBody({
  token,
  apiBaseUrl,
  className,
  locale,
  onLocaleChange,
}: Omit<AccountantPortalProps, "defaultLocale"> & {
  locale: string
  onLocaleChange: (locale: string) => void
}) {
  const t = useFinanceUiMessagesOrDefault().profitability
  const client = useMemo(() => ({ baseUrl: apiBaseUrl, fetcher: defaultFetcher }), [apiBaseUrl])
  const [currency, setCurrency] = useState<string>("")
  const [productId, setProductId] = useState<string>("")
  const [departureId, setDepartureId] = useState<string>("")

  const summary = useQuery(getAccountantSummaryQueryOptions(client, token))
  const invoices = useQuery(getAccountantInvoicesQueryOptions(client, token))

  const data = summary.data?.data
  const departures = data?.departures
  const products = data?.products
  const baseMode = Boolean(departures?.base)

  const currencies = useMemo(() => {
    const set = new Set<string>()
    for (const row of departures?.rows ?? []) set.add(row.currency)
    for (const row of products?.rows ?? []) set.add(row.currency)
    return [...set].sort()
  }, [departures, products])

  const activeCurrency = baseMode
    ? (departures?.base?.currency ?? "")
    : currency && currencies.includes(currency)
      ? currency
      : (currencies[0] ?? "")

  const currencyDepartureRows = baseMode
    ? (departures?.base?.rows ?? [])
    : (departures?.rows ?? []).filter((r) => r.currency === activeCurrency)
  const currencyProductRows = baseMode
    ? (products?.base?.rows ?? [])
    : (products?.rows ?? []).filter((r) => r.currency === activeCurrency)

  // Product/departure filters (client-side over the loaded scope).
  const productOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of currencyDepartureRows) {
      if (r.productId) map.set(r.productId, r.productName ?? r.productId)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [currencyDepartureRows])
  const departureOptions = useMemo(
    () =>
      currencyDepartureRows
        .filter((r) => !productId || r.productId === productId)
        .map((r) => ({ id: r.departureId, label: r.departureLabel ?? r.departureId })),
    [currencyDepartureRows, productId],
  )

  const departureRows = currencyDepartureRows.filter(
    (r) =>
      (!productId || r.productId === productId) && (!departureId || r.departureId === departureId),
  )
  const productRows = currencyProductRows.filter((r) => !productId || r.productId === productId)

  const totals = useMemo(() => {
    let revenue = 0
    let actual = 0
    for (const r of departureRows) {
      revenue += r.revenueCents
      actual += r.actualCostCents
    }
    const profit = revenue - actual
    return { revenue, actual, profit, margin: revenue > 0 ? (profit / revenue) * 100 : null }
  }, [departureRows])

  const serviceTypeData = serviceTypeChart(
    departures,
    baseMode,
    activeCurrency,
    t.serviceTypeLabels,
  )
  const chartData = [...departureRows]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, CHART_DEPARTURE_LIMIT)
    .map((r) => ({
      name: r.departureLabel ?? r.departureId,
      revenue: r.revenueCents / 100,
      actualCost: r.actualCostCents / 100,
      profit: r.profitCents / 100,
    }))

  const barConfig: ChartConfig = {
    revenue: { label: t.charts.revenue, color: "hsl(221 83% 53%)" },
    actualCost: { label: t.charts.actualCost, color: "hsl(0 72% 51%)" },
    profit: { label: t.charts.profit, color: "hsl(142 71% 45%)" },
  }
  const pieConfig: ChartConfig = Object.fromEntries(
    serviceTypeData.map((d) => [d.serviceType, { label: d.label, color: d.fill }]),
  )

  const money = (cents: number) => formatInvoiceAmount(cents, activeCurrency)
  const periodLabel =
    data?.scope.from || data?.scope.to
      ? `${data?.scope.from ?? "…"} – ${data?.scope.to ?? "…"}`
      : t.portal.allTime
  const exportUrl = (report: "departures" | "products" | "invoices") =>
    `${apiBaseUrl}/v1/public/finance/accountant/${encodeURIComponent(token)}/export/${report}`
  const downloadUrl = (kind: "client" | "supplier", invoiceId: string, attachmentId: string) =>
    `${apiBaseUrl}/v1/public/finance/accountant/${encodeURIComponent(token)}/invoices/${invoiceId}/attachments/${attachmentId}/download?kind=${kind}`

  if (summary.isError) {
    return (
      <div className={cn("mx-auto max-w-2xl p-6", className)}>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t.portal.gone}
          </CardContent>
        </Card>
      </div>
    )
  }

  const invoiceRows = invoices.data?.data ?? []

  return (
    <div className={cn("mx-auto flex max-w-6xl flex-col gap-6 p-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.portal.title}</h1>
          <p className="text-sm text-muted-foreground">
            {periodLabel} · {t.portal.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-1.5">
              <Globe className="size-3.5" />
              {t.portal.language}
            </Label>
            <Select value={locale} onValueChange={(v) => onLocaleChange(v ?? "en")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LOCALE_NAMES[code] ?? code.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t.filters.product}</Label>
            <AsyncCombobox
              className="w-56"
              placeholder={t.filters.allProducts}
              value={productId || null}
              onChange={(v) => {
                setProductId(v ?? "")
                setDepartureId("")
              }}
              search={localOptionSearch(
                productOptions.map((p) => ({ value: p.id, label: p.name })),
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t.filters.departure}</Label>
            <AsyncCombobox
              className="w-56"
              placeholder={t.filters.allDepartures}
              value={departureId || null}
              onChange={(v) => setDepartureId(v ?? "")}
              search={localOptionSearch(
                departureOptions.map((d) => ({ value: d.id, label: d.label })),
              )}
            />
          </div>
          {!baseMode && currencies.length > 1 ? (
            <div className="flex flex-col gap-2">
              <Label>{t.filters.currency}</Label>
              <Select value={activeCurrency} onValueChange={(v) => setCurrency(v ?? "")}>
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
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t.kpis.revenue} value={money(totals.revenue)} />
        <Kpi label={t.kpis.actualCost} value={money(totals.actual)} />
        <Kpi
          label={t.kpis.profit}
          value={money(totals.profit)}
          accent={totals.profit >= 0 ? "positive" : "negative"}
        />
        <Kpi label={t.kpis.margin} value={marginText(totals.margin)} />
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
                    tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
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
              <p className="py-10 text-center text-sm text-muted-foreground">{t.departures.none}</p>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.departures.title}</CardTitle>
          <a href={exportUrl("departures")} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Download className="size-4" />
              {t.exportCsv}
            </Button>
          </a>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.departures.columns.departure}</TableHead>
                <TableHead>{t.departures.columns.date}</TableHead>
                <TableHead className="text-right">{t.departures.columns.revenue}</TableHead>
                <TableHead className="text-right">{t.departures.columns.actualCost}</TableHead>
                <TableHead className="text-right">{t.departures.columns.profit}</TableHead>
                <TableHead className="text-right">{t.departures.columns.margin}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departureRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t.departures.none}
                  </TableCell>
                </TableRow>
              ) : (
                departureRows.map((row) => (
                  <TableRow key={`${row.departureId}:${row.currency}`}>
                    <TableCell className="font-medium">
                      {row.departureLabel ?? row.departureId}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.departureDate ?? t.noDate}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(row.revenueCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(row.actualCostCents)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        row.profitCents < 0 && "text-destructive",
                      )}
                    >
                      {money(row.profitCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {marginText(row.marginPercent)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.products.title}</CardTitle>
          <a href={exportUrl("products")} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Download className="size-4" />
              {t.exportCsv}
            </Button>
          </a>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.products.columns.product}</TableHead>
                <TableHead className="text-right">{t.products.columns.departures}</TableHead>
                <TableHead className="text-right">{t.products.columns.revenue}</TableHead>
                <TableHead className="text-right">{t.products.columns.actualCost}</TableHead>
                <TableHead className="text-right">{t.products.columns.profit}</TableHead>
                <TableHead className="text-right">{t.products.columns.margin}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t.products.none}
                  </TableCell>
                </TableRow>
              ) : (
                productRows.map((row) => (
                  <TableRow key={`${row.productId}:${row.currency}`}>
                    <TableCell className="font-medium">
                      {row.productName ?? row.productId}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.departureCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(row.revenueCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(row.actualCostCents)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        row.profitCents < 0 && "text-destructive",
                      )}
                    >
                      {money(row.profitCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {marginText(row.marginPercent)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.portal.invoices}</CardTitle>
          <div className="flex items-center gap-2">
            <a
              href={`${apiBaseUrl}/v1/public/finance/accountant/${encodeURIComponent(token)}/invoices/download-all`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <Download className="size-4" />
                {t.portal.downloadAll}
              </Button>
            </a>
            <a href={exportUrl("invoices")} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <Download className="size-4" />
                {t.exportCsv}
              </Button>
            </a>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.portal.columns.type}</TableHead>
                <TableHead>{t.portal.columns.invoice}</TableHead>
                <TableHead>{t.portal.columns.status}</TableHead>
                <TableHead>{t.portal.columns.issueDate}</TableHead>
                <TableHead className="text-right">{t.portal.columns.total}</TableHead>
                <TableHead className="text-right">{t.portal.columns.balanceDue}</TableHead>
                <TableHead>{t.portal.columns.attachments}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t.portal.invoicesNone}
                  </TableCell>
                </TableRow>
              ) : (
                invoiceRows.map((inv) => (
                  <TableRow key={`${inv.kind}:${inv.id}`}>
                    <TableCell>
                      <Badge variant={inv.kind === "supplier" ? "secondary" : "outline"}>
                        {inv.kind === "supplier" ? t.portal.kindSupplier : t.portal.kindClient}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{inv.issueDate}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInvoiceAmount(inv.totalCents, inv.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInvoiceAmount(inv.balanceDueCents, inv.currency)}
                    </TableCell>
                    <TableCell>
                      {inv.attachments.length === 0 ? (
                        <span className="text-muted-foreground">{t.portal.noFile}</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {inv.attachments.map((att) =>
                            att.hasFile ? (
                              <a
                                key={att.id}
                                href={downloadUrl(inv.kind, inv.id, att.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
                              >
                                <Download className="size-3.5" />
                                {att.name}
                              </a>
                            ) : (
                              <span key={att.id} className="text-sm text-muted-foreground">
                                {att.name}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function serviceTypeChart(
  departures: DepartureProfitabilityReport | undefined,
  baseMode: boolean,
  activeCurrency: string,
  labels: Record<string, string>,
) {
  const source = baseMode
    ? (departures?.base?.costByServiceType ?? [])
    : (departures?.costByServiceType ?? []).filter((c) => c.currency === activeCurrency)
  return source.map((c, index) => ({
    serviceType: c.serviceType,
    label: labels[c.serviceType as keyof typeof labels] ?? c.serviceType,
    amount: c.amountCents / 100,
    fill: PIE_COLORS[index % PIE_COLORS.length],
  }))
}

function Kpi({
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
