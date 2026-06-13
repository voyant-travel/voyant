import type { AnyDrizzleDb } from "@voyantjs/db"
import { eq } from "drizzle-orm"

import type { NewTripComponentEvent, TripComponent } from "./schema.js"
import { tripComponentEvents, tripComponents } from "./schema.js"
import type { TripComponentStatus } from "./validation.js"

export async function createComponentEvent(
  db: AnyDrizzleDb,
  data: Omit<NewTripComponentEvent, "id" | "occurredAt">,
) {
  await db.insert(tripComponentEvents).values(data)
}

export function statusToEventType(to: TripComponentStatus): NewTripComponentEvent["eventType"] {
  switch (to) {
    case "priced":
    case "unavailable":
      return "priced"
    case "held":
      return "hold_placed"
    case "booked":
      return "booked"
    case "checkout_started":
      return "checkout_started"
    case "failed":
      return "failed"
    case "cancelled":
      return "cancelled"
    case "removed":
      return "removed"
    case "draft":
      return "updated"
  }
}

export function appendWarningCodes(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])]
}

export async function markComponentForStaffRemediation(
  db: AnyDrizzleDb,
  component: TripComponent,
  reason: string,
): Promise<TripComponent> {
  const [updated] = (await db
    .update(tripComponents)
    .set({
      warningCodes: appendWarningCodes(component.warningCodes, [
        "staff_remediation_required",
        reason,
      ]),
      updatedAt: new Date(),
    })
    .where(eq(tripComponents.id, component.id))
    .returning()) as TripComponent[]

  if (!updated) {
    throw new Error(`markComponentForStaffRemediation: update returned no row for ${component.id}`)
  }

  await createComponentEvent(db, {
    envelopeId: updated.envelopeId,
    componentId: updated.id,
    eventType: "staff_remediation_required",
    fromStatus: component.status,
    toStatus: updated.status,
    payload: { reason },
  })

  return updated
}

export function commonString(values: Array<string | undefined>): string | undefined {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))]
  return unique.length === 1 ? unique[0] : undefined
}

export function minComponentPriceExpiry(components: TripComponent[]): Date | null {
  const expiries = components
    .map((component) => component.priceExpiresAt)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())
  return expiries[0] ?? null
}

export function minComponentHoldExpiry(components: TripComponent[]): Date | null {
  const expiries = components
    .map((component) => component.holdExpiresAt)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())
  return expiries[0] ?? null
}
