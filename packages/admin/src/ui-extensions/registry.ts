/**
 * The closed v1 set of named insertion slots UI extensions may target.
 *
 * These ids already exist as widget slots on the operator admin surfaces, so a
 * UI extension is contributed through the same {@link AdminWidgetSlot}
 * mechanism as any first-party widget. Adding a slot is a MINOR change (a new
 * capability extensions can opt into); renaming or removing one is MAJOR.
 */
import type { AdminWidgetSlot } from "../extensions.js"

export const ADMIN_UI_EXTENSION_SLOTS = [
  "dashboard.header",
  "dashboard.after-kpis",
  "dashboard.footer",
  "booking.details.header",
  "booking.details.after-summary",
  "invoice.details.header",
  "invoice.details.after-summary",
  "workspace.header.actions",
] as const satisfies readonly AdminWidgetSlot[]

/** A slot id from the public UI-extension registry. */
export type AdminUiExtensionSlot = (typeof ADMIN_UI_EXTENSION_SLOTS)[number]

/** Whether `slot` is one of the public UI-extension slots. */
export function isAdminUiExtensionSlot(slot: string): slot is AdminUiExtensionSlot {
  return (ADMIN_UI_EXTENSION_SLOTS as readonly string[]).includes(slot)
}
