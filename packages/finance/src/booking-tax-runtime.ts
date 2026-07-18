import type { ModuleContainer } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { ApiExtension } from "@voyant-travel/hono/module"
import type { Context } from "hono"
import {
  type BookingTaxRouteOptions,
  createBookingTaxPreviewApiExtension,
  createBookingTaxSettingsApiExtension,
} from "./booking-tax.js"
import { createFinanceBookingTaxRuntime } from "./runtime.js"
import { financeOperatorSettingsRuntimePort } from "./runtime-port.js"

// ─────────────────────────────────────────────────────────────────
// Runtime-container wiring (mirrors booking-schedule)
// ─────────────────────────────────────────────────────────────────
//
// On the managed runtime each graph unit's runtime exports are ALL invoked:
// a `defineGraphRuntimeFactory` export receives the factory context (`getPort`)
// and wires the operator-settings port into options; a PLAIN api-facet export
// is invoked with NO ARGS, so it sees empty options. The graph factory
// therefore registers the WIRED options into the shared app container under a
// runtime key, and the routes resolve those options from the container at
// request time — falling back to the closure options for standard callers that
// pass real options directly. This keeps the wired options winning without an
// empty-options route mount racing the factory's.

export const BOOKING_TAX_SETTINGS_RUNTIME_KEY = "finance.bookingTaxSettingsRuntime"
export const BOOKING_TAX_PREVIEW_RUNTIME_KEY = "finance.bookingTaxPreviewRuntime"

export interface BookingTaxRuntime {
  resolveRoutesOptions(): BookingTaxRouteOptions
}

/**
 * Resolve the container-registered booking-tax route options at request time,
 * preferring the wired runtime (registered by the graph factory's bootstrap)
 * over the closure options a plain api-facet call captured. Fail-open: any
 * missing/empty container falls back to the passed options.
 */
export function resolveBookingTaxRouteOptions(
  c: Context,
  runtimeKey: string,
  fallback: BookingTaxRouteOptions,
): BookingTaxRouteOptions {
  const container = c.get("container") as ModuleContainer | undefined
  if (!container?.has(runtimeKey)) return fallback
  try {
    return container.resolve<BookingTaxRuntime>(runtimeKey).resolveRoutesOptions()
  } catch {
    return fallback
  }
}

export const createBookingTaxSettingsVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) => {
    const options = createFinanceBookingTaxRuntime(
      await getPort(financeOperatorSettingsRuntimePort),
    )
    const configured = createBookingTaxSettingsApiExtension(options)
    const selected: ApiExtension = {
      ...configured,
      extension: {
        ...configured.extension,
        bootstrap: async ({ container }) => {
          container.register(BOOKING_TAX_SETTINGS_RUNTIME_KEY, {
            resolveRoutesOptions: () => options,
          } satisfies BookingTaxRuntime)
        },
      },
    }
    return selected
  },
)

export const createBookingTaxPreviewVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) => {
    const options = createFinanceBookingTaxRuntime(
      await getPort(financeOperatorSettingsRuntimePort),
    )
    const configured = createBookingTaxPreviewApiExtension(options)
    const selected: ApiExtension = {
      ...configured,
      extension: {
        ...configured.extension,
        bootstrap: async ({ container }) => {
          container.register(BOOKING_TAX_PREVIEW_RUNTIME_KEY, {
            resolveRoutesOptions: () => options,
          } satisfies BookingTaxRuntime)
        },
      },
    }
    return selected
  },
)
