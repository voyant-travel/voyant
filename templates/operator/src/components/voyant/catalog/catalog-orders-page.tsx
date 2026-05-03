"use client"

import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { getApiUrl } from "@/lib/env"

interface Snapshot {
  id: string
  booking_id: string
  entity_module: string
  entity_id: string
  source_kind: string
  source_ref?: string | null
  pricing_base_amount?: string | null
  pricing_currency?: string | null
  captured_at: string
}

interface ListResponse {
  rows: Snapshot[]
}

export function CatalogOrdersPage() {
  const [rows, setRows] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the deliberate trigger for re-fetch after a successful cancel
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${getApiUrl()}/v1/admin/catalog/orders`, { credentials: "include" })
      .then((r) => r.json() as Promise<ListResponse>)
      .then((data) => {
        if (!cancelled) setRows(data.rows ?? [])
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          toast.error(`Failed to load orders: ${message}`)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const onCancel = async (snapshot: Snapshot) => {
    toast.loading("Cancelling…", { id: `cancel-${snapshot.id}` })
    try {
      const res = await fetch(`${getApiUrl()}/v1/admin/catalog/orders/${snapshot.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bookingId: snapshot.booking_id,
          entityModule: snapshot.entity_module,
          entityId: snapshot.entity_id,
          reason: "operator-cancelled",
        }),
      })
      const data = (await res.json()) as {
        status?: string
        refundAmount?: number
        refundCurrency?: string
        error?: string
      }
      if (!res.ok || data.error) {
        toast.error(`Cancel failed: ${data.error ?? res.statusText}`, {
          id: `cancel-${snapshot.id}`,
        })
        return
      }
      const refundLabel =
        data.refundAmount != null && data.refundCurrency
          ? ` — refund ${formatMoney(data.refundAmount, data.refundCurrency)}`
          : ""
      toast.success(`Cancelled (${data.status})${refundLabel}`, { id: `cancel-${snapshot.id}` })
      setReloadKey((k) => k + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(`Cancel request failed: ${message}`, { id: `cancel-${snapshot.id}` })
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-semibold text-2xl">Catalog orders</h1>
        <p className="text-muted-foreground text-sm">
          Cross-vertical bookings made through the catalog booking engine. Includes both owned and
          sourced inventory; cancel calls back to the originating adapter.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Snapshot</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead>Vertical</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Captured</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No catalog orders yet — book one from the Catalog page to populate this list.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.id.slice(0, 16)}…</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.booking_id.slice(0, 16)}…
                  </TableCell>
                  <TableCell>{row.entity_module}</TableCell>
                  <TableCell className="font-mono text-xs">{row.entity_id.slice(0, 16)}…</TableCell>
                  <TableCell>
                    <Badge variant={row.source_kind === "owned" ? "secondary" : "outline"}>
                      {row.source_kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {row.pricing_base_amount && row.pricing_currency
                      ? formatMoney(Number(row.pricing_base_amount), row.pricing_currency)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(row.captured_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onCancel(row)}>
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function formatMoney(cents: number, currency: string): string {
  // The booking engine stores the base amount as a numeric (not cents) — see
  // catalog_quotes / booking_catalog_snapshot pricing_basis. So divide by 1
  // when the value is already a decimal; the demo adapter writes cents so we
  // detect by magnitude — values >= 100 are treated as cents.
  const value = cents >= 100 ? cents / 100 : cents
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}
