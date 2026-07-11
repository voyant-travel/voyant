/**
 * Catalog content routes for the operator starter.
 *
 * Mounts the per-vertical sourced-content endpoints that templates
 * adopt as part of the catalog-sourced-content migration:
 *
 *   GET /v1/{admin,public}/products/:id/content
 *   GET /v1/{admin,public}/cruises/:id/content
 *   GET /v1/{admin,public}/accommodations/:id/content
 *
 * Each endpoint dispatches through the vertical's `getXxxContent`
 * service (cache-first, SWR refresh, synthesizer fallback). The
 * catalog `SourceAdapterRegistry` is resolved via the existing
 * `getBookingEngineRegistryFromContext` helper — same singleton the
 * booking-engine routes use.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.3.
 */

import type { AccommodationContentHonoExtensionOptions } from "@voyant-travel/accommodations/routes-content"
import type { CruiseContentHonoExtensionOptions } from "@voyant-travel/cruises/routes-content"
import type { ProductContentHonoExtensionOptions } from "@voyant-travel/inventory/routes-content"

import { getBookingEngineRegistryFromContext } from "../lib/booking-engine-runtime"

export function createOperatorInventoryContentRuntime(): ProductContentHonoExtensionOptions {
  return {
    admin: {
      resolveRegistry: getBookingEngineRegistryFromContext,
      defaultAcceptMachineTranslated: false,
    },
    public: {
      resolveRegistry: getBookingEngineRegistryFromContext,
      defaultAcceptMachineTranslated: true,
    },
  }
}

export function createOperatorCruisesContentRuntime(): CruiseContentHonoExtensionOptions {
  return {
    admin: {
      resolveRegistry: getBookingEngineRegistryFromContext,
      defaultAcceptMachineTranslated: false,
      allowOwnedKeys: true,
    },
    public: {
      resolveRegistry: getBookingEngineRegistryFromContext,
      defaultAcceptMachineTranslated: true,
      allowOwnedKeys: true,
    },
  }
}

export function createOperatorAccommodationsContentRuntime(): AccommodationContentHonoExtensionOptions {
  return {
    admin: {
      resolveRegistry: getBookingEngineRegistryFromContext,
      defaultAcceptMachineTranslated: false,
    },
    public: {
      resolveRegistry: getBookingEngineRegistryFromContext,
      defaultAcceptMachineTranslated: true,
    },
  }
}
