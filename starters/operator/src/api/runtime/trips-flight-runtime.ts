/**
 * Operator (deployment) wiring for non-catalog (flight) trip components.
 *
 * The reusable flight-component orchestration (preflight price-change detection,
 * passenger-roster building, reserve) now lives in
 * `@voyant-travel/trips/flight-component`. This file supplies the
 * deployment-specific dependency the package can't import statically: the
 * concrete flight adapter (which provider, which base URL).
 *
 * Each exported function keeps the `(c, input)` signature the trips route wiring
 * (`trips-runtime.ts`) already imports.
 */
import type {
  CancelComponentInput,
  CancelComponentResult,
  ComponentCancellationPreview,
  ComponentCancellationPreviewInput,
  ReserveComponentInput,
  ReserveComponentPreflightResult,
  ReserveComponentResult,
} from "@voyant-travel/trips"
import {
  createFlightComponentAdapter,
  type FlightAdapterContext,
  previewFlightCancellation,
} from "@voyant-travel/trips/flight-component"
import type { Context } from "hono"

import { isDemoInstalled } from "../lib/demo-availability"

const FLIGHTS_DEMO_SPECIFIER = "@voyant-travel/plugin-flights-demo"

const createDemoFlightAdapter = isDemoInstalled(FLIGHTS_DEMO_SPECIFIER)
  ? (
      (await import(FLIGHTS_DEMO_SPECIFIER)) as {
        createDemoFlightAdapter: (options: { baseUrl: string }) => never
      }
    ).createDemoFlightAdapter
  : undefined

/** Build the trips flight-component adapter for a request, injecting the
 * deployment's concrete flight adapter + adapter context. */
function flightComponentAdapter(c: Context) {
  return createFlightComponentAdapter({
    adapter: getFlightAdapter(c),
    adapterContext: buildFlightAdapterContext(c),
  })
}

export function validateNonCatalogComponentBeforeReserve(
  c: Context,
  input: ReserveComponentInput,
): Promise<ReserveComponentPreflightResult | null> {
  return flightComponentAdapter(c).validateBeforeReserve(input)
}

export function reserveNonCatalogComponent(
  c: Context,
  input: ReserveComponentInput,
): Promise<ReserveComponentResult | null> {
  return flightComponentAdapter(c).reserve(input)
}

export function previewFlightComponentCancellation(
  input: ComponentCancellationPreviewInput,
): Promise<ComponentCancellationPreview> {
  return previewFlightCancellation(input)
}

export function cancelFlightComponent(
  c: Context,
  input: CancelComponentInput,
): Promise<CancelComponentResult> {
  return flightComponentAdapter(c).cancel(input)
}

function getFlightAdapter(c: Context) {
  if (!createDemoFlightAdapter) {
    throw new Error("@voyant-travel/plugin-flights-demo is not installed.")
  }
  const baseUrl = (c.env as { FLIGHTS_DEMO_API_URL?: string }).FLIGHTS_DEMO_API_URL
  if (!baseUrl) {
    throw new Error(
      "FLIGHTS_DEMO_API_URL is not set. Start the demo service with `pnpm --dir apps/flights-demo-api dev` and point this env at it.",
    )
  }
  return createDemoFlightAdapter({ baseUrl })
}

function buildFlightAdapterContext(c: Context): FlightAdapterContext {
  return {
    connectionId: "demo",
    correlationId: c.req.header("x-request-id") ?? undefined,
  }
}
