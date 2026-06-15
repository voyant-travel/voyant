import type { Trip } from "../service.js"
import type { TripCheckoutAllocation, TripCheckoutDeps } from "./types.js"

export async function checkoutPricingForTrip(
  quoteFx: TripCheckoutDeps["quoteFx"],
  trip: Trip,
  request: Record<string, unknown>,
): Promise<{
  currency: string
  totalAmountCents: number
  allocations: TripCheckoutAllocation[]
}> {
  const active = trip.components.filter(
    (component) => component.status !== "removed" && component.status !== "cancelled",
  )
  const collectionCurrency =
    stringValue(request.collectionCurrency) ?? trip.envelope.aggregateCurrency ?? "EUR"
  const allocations: TripCheckoutAllocation[] = []

  for (const component of active) {
    const sourceCurrency = component.componentCurrency ?? collectionCurrency
    const sourceAmountCents = component.componentTotalAmountCents ?? 0
    if (sourceAmountCents <= 0) continue

    if (sourceCurrency === collectionCurrency) {
      allocations.push({
        componentId: component.id,
        kind: component.kind,
        bookingId: component.bookingId,
        orderId: component.orderId,
        sourceCurrency,
        sourceAmountCents,
        targetCurrency: collectionCurrency,
        targetAmountCents: sourceAmountCents,
      })
      continue
    }

    const fx = await quoteFx(sourceCurrency, collectionCurrency)
    allocations.push({
      componentId: component.id,
      kind: component.kind,
      bookingId: component.bookingId,
      orderId: component.orderId,
      sourceCurrency,
      sourceAmountCents,
      targetCurrency: collectionCurrency,
      targetAmountCents: convertCents(sourceAmountCents, fx.rate),
      fx: {
        rate: fx.rate,
        provider: "voyant_data_fx",
        quotedAt: fx.quotedAt,
        validUntil: fx.validUntil,
      },
    })
  }

  return {
    currency: collectionCurrency,
    totalAmountCents: allocations.reduce(
      (sum, allocation) => sum + allocation.targetAmountCents,
      0,
    ),
    allocations,
  }
}

export function buildTripPaymentSummary(
  trip: Trip,
  currency: string,
  allocations?: TripCheckoutAllocation[],
): string {
  const lines = ["Trip payment summary"]
  const byComponentId = new Map(
    allocations?.map((allocation) => [allocation.componentId, allocation]),
  )
  for (const component of trip.components.filter(
    (item) => item.status !== "removed" && item.status !== "cancelled",
  )) {
    const allocation = byComponentId.get(component.id)
    if (allocation?.fx) {
      lines.push(
        `${componentDisplayName(component)} — ${formatCents(
          allocation.sourceAmountCents,
          allocation.sourceCurrency,
        )} -> ${formatCents(allocation.targetAmountCents, allocation.targetCurrency)}`,
      )
    } else {
      lines.push(
        `${componentDisplayName(component)} — ${formatCents(
          allocation?.targetAmountCents ?? component.componentTotalAmountCents,
          allocation?.targetCurrency ?? component.componentCurrency ?? currency,
        )}`,
      )
    }
  }
  const total = allocations?.reduce((sum, allocation) => sum + allocation.targetAmountCents, 0)
  lines.push(
    `Total payable — ${formatCents(total ?? trip.envelope.aggregateTotalAmountCents, currency)}`,
  )
  const fxAllocations = allocations?.filter((allocation) => allocation.fx) ?? []
  if (fxAllocations.length > 0) {
    lines.push("")
    lines.push("FX rates")
    for (const allocation of fxAllocations) {
      lines.push(
        `${allocation.sourceCurrency}->${allocation.targetCurrency}: ${allocation.fx?.rate} quoted ${allocation.fx?.quotedAt}`,
      )
    }
  }
  return lines.join("\n")
}

function componentDisplayName(component: Trip["components"][number]): string {
  const metadata = asRecord(component.metadata)
  const catalogItem = asRecord(metadata?.catalogItem)
  const flightDraft = asRecord(metadata?.flightDraft)
  const origin = stringValue(flightDraft?.origin)
  const destination = stringValue(flightDraft?.destination)
  if (origin && destination) return `${origin} -> ${destination}`
  return (
    stringValue(catalogItem?.name) ||
    stringValue(component.title) ||
    stringValue(component.description) ||
    component.kind.replaceAll("_", " ")
  )
}

function formatCents(amountCents: number | null | undefined, currency: string): string {
  return ((amountCents ?? 0) / 100).toLocaleString("en-GB", {
    style: "currency",
    currency,
  })
}

function convertCents(amountCents: number, rate: number): number {
  return Math.round(amountCents * rate)
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}
