/**
 * Admin booking tax-preview route.
 *
 * Surface the operator's resolved sell-side tax rate against an
 * in-progress booking draft so the booking-create dialog can render a
 * real subtotal / tax / total breakdown while the operator is still
 * configuring the booking (product, option, travelers, room).
 *
 * Input is intentionally minimal — the dialog already knows the
 * subtotal it would charge. The route just wraps
 * {@link resolveOperatorSellTaxRate} + {@link computeBookingItemTaxLine}
 * so the numbers shown in the preview match what the booking-create
 * flow would actually persist into `booking_item_tax_lines`.
 */

import { parseJsonBody } from "@voyantjs/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"
import { z } from "zod"

import { computeBookingItemTaxLine, resolveOperatorSellTaxRate } from "./lib/operator-tax-policy"

const taxPreviewBodySchema = z.object({
  productId: z.string().min(1),
  subtotalCents: z.number().int().min(0),
  currency: z.string().min(3).max(8),
})

async function handleTaxPreview(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase

  let body: z.infer<typeof taxPreviewBodySchema>
  try {
    body = await parseJsonBody(c, taxPreviewBodySchema)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Invalid request body" }, 400)
  }

  const taxRate = await resolveOperatorSellTaxRate(db, { productId: body.productId })
  const taxLine = computeBookingItemTaxLine(taxRate, body.subtotalCents, body.currency)

  if (!taxRate || !taxLine) {
    return c.json({
      data: {
        subtotalCents: body.subtotalCents,
        taxCents: 0,
        totalCents: body.subtotalCents,
        currency: body.currency,
        taxRate: null,
      },
    })
  }

  const inclusive = taxLine.includedInPrice
  // Inclusive: the operator-entered subtotal already contains the tax.
  // The displayed "subtotal" should show pre-tax for clarity, and the
  // tax line is the implied tax component.
  // Exclusive: tax stacks on top of the subtotal.
  const displaySubtotal = inclusive
    ? Math.max(0, body.subtotalCents - taxLine.amountCents)
    : body.subtotalCents
  const total = inclusive ? body.subtotalCents : body.subtotalCents + taxLine.amountCents

  return c.json({
    data: {
      subtotalCents: displaySubtotal,
      taxCents: taxLine.amountCents,
      totalCents: total,
      currency: body.currency,
      taxRate: {
        code: taxRate.code,
        label: taxRate.label,
        // `rate` is a fraction (0..1). Surface basis points so the
        // client can render `21.00%` without re-parsing.
        rateBasisPoints: Math.round(taxRate.rate * 10_000),
        priceMode: taxRate.priceMode,
      },
    },
  })
}

export function mountBookingTaxPreviewRoutes(hono: Hono): void {
  hono.post("/v1/admin/bookings/tax-preview", handleTaxPreview)
}
