"use client"

/**
 * Operator-facing promotions list page.
 *
 * Lists every promotional offer with its scope, discount, validity, and
 * status. Edit-on-click opens the create/edit dialog (PromotionDialog).
 *
 * v1 limitations: no separate detail page, no redemption-history view —
 * the list + form covers the operator-essential capability. Detail +
 * redemption views can ship as follow-up commits.
 */

import type { QueryClient } from "@tanstack/react-query"
import {
  createPromotionsClientOptions,
  getPromotionsListQueryOptions,
  type PromotionalOfferRecord,
  type PromotionalOfferScope,
  type PromotionsClientOptions,
  usePromotionsList,
} from "@voyantjs/promotions-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { PromotionDialog } from "./promotion-dialog.js"

export function loadPromotionsPage(
  queryClient: QueryClient,
  client?: Partial<PromotionsClientOptions>,
) {
  return queryClient.ensureQueryData(
    getPromotionsListQueryOptions({ limit: 50, offset: 0 }, createPromotionsClientOptions(client)),
  )
}

export function PromotionsPage() {
  const { data, isPending, error } = usePromotionsList({ limit: 50, offset: 0 })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingOffer, setEditingOffer] = useState<PromotionalOfferRecord | undefined>()

  const offers = data?.data ?? []

  const summary = useMemo(() => {
    const active = offers.filter((o) => o.active).length
    const codeGated = offers.filter((o) => o.code != null).length
    return { total: offers.length, active, codeGated }
  }, [offers])

  function openCreate() {
    setEditingOffer(undefined)
    setDialogOpen(true)
  }

  function openEdit(offer: PromotionalOfferRecord) {
    setEditingOffer(offer)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            Auto-applied catalog discounts and code-redeemed offers.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          New promotion
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Active" value={summary.active} />
        <SummaryCard label="Code-gated" value={summary.codeGated} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All offers</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">
              Failed to load: {error instanceof Error ? error.message : String(error)}
            </p>
          ) : isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No promotions yet. Create your first offer to get started.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Scope</th>
                  <th className="py-2 pr-4">Discount</th>
                  <th className="py-2 pr-4">Validity</th>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr
                    key={offer.id}
                    className="cursor-pointer border-t hover:bg-muted/40"
                    onClick={() => openEdit(offer)}
                  >
                    <td className="py-2 pr-4 font-medium">{offer.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {summarizeScope(offer.scope)}
                    </td>
                    <td className="py-2 pr-4">{summarizeDiscount(offer)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {summarizeValidity(offer.validFrom, offer.validUntil)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{offer.code ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={offer.active ? "default" : "outline"}>
                        {offer.active ? "active" : "archived"}
                      </Badge>
                      {offer.stackable ? (
                        <Badge variant="secondary" className="ml-2">
                          stackable
                        </Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <PromotionDialog open={dialogOpen} onOpenChange={setDialogOpen} offer={editingOffer} />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs uppercase text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  )
}

function summarizeScope(scope: PromotionalOfferScope): string {
  switch (scope.kind) {
    case "global":
      return "Global"
    case "products":
      return `${scope.productIds.length} product${scope.productIds.length === 1 ? "" : "s"}`
    case "categories":
      return `${scope.categoryIds.length} categor${scope.categoryIds.length === 1 ? "y" : "ies"}`
    case "destinations":
      return `${scope.destinationIds.length} destination${scope.destinationIds.length === 1 ? "" : "s"}`
    case "markets":
      return `Markets: ${scope.marketIds.join(", ")}`
    case "audiences":
      return `Audiences: ${scope.audiences.join(", ")}`
  }
}

function summarizeDiscount(offer: PromotionalOfferRecord): string {
  if (offer.discountType === "percentage") {
    return `${offer.discountPercent ?? "?"}%`
  }
  const cents = offer.discountAmountCents ?? 0
  const currency = offer.currency ?? ""
  return `${(cents / 100).toFixed(2)} ${currency}`.trim()
}

function summarizeValidity(from: string | null, until: string | null): string {
  if (from == null && until == null) return "Anytime"
  const fmt = (iso: string) => iso.slice(0, 10)
  if (from == null) return `Until ${fmt(until ?? "")}`
  if (until == null) return `From ${fmt(from)}`
  return `${fmt(from)} → ${fmt(until)}`
}
