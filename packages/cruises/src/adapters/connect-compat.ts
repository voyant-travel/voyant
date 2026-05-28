import type { ExternalCabinCategory, ExternalCruise, ExternalPriceComponent } from "./index.js"

export type ConnectCruiseType =
  | "ocean"
  | "river"
  | "expedition"
  | "coastal"
  | "yacht"
  | "rail"
  | "tour"

export type ConnectCabinRoomType =
  | "inside"
  | "oceanview"
  | "balcony"
  | "suite"
  | "penthouse"
  | "single"
  | "studio"
  | "villa"
  | "unknown"

export type ConnectInclusionKind =
  | "meals"
  | "drinks"
  | "gratuities"
  | "transfers"
  | "excursions"
  | "wifi"
  | "flight"
  | "insurance"
  | "other"

export type ConnectEnrichmentKind =
  | "naturalist"
  | "historian"
  | "photographer"
  | "lecturer"
  | "domain_expert"
  | "other"

export type ConnectPriceComponentKind =
  | "tax"
  | "port_charge"
  | "gratuity"
  | "non_commissionable_fare"
  | "onboard_credit"
  | "airfare"
  | "transfer"
  | "insurance"
  | "single_supplement"
  | "other"

export type CompatibilityMappingResult<T> =
  | { status: "mapped"; value: T }
  | { status: "reject"; reason: string; rerouteTo?: string }

export function mapConnectCruiseType(
  value: ConnectCruiseType,
): CompatibilityMappingResult<ExternalCruise["cruiseType"]> {
  if (value === "ocean" || value === "river" || value === "expedition" || value === "coastal") {
    return { status: "mapped", value }
  }
  if (value === "yacht") {
    return {
      status: "reject",
      reason: "Yacht-style per-suite products do not fit the cruises occupancy grid.",
      rerouteTo: "products",
    }
  }
  return {
    status: "reject",
    reason: `${value} is not a cruise vertical product type.`,
    rerouteTo: "products",
  }
}

export function mapConnectCabinRoomType(
  value: ConnectCabinRoomType,
): CompatibilityMappingResult<ExternalCabinCategory["roomType"]> {
  if (
    value === "inside" ||
    value === "oceanview" ||
    value === "balcony" ||
    value === "suite" ||
    value === "penthouse" ||
    value === "single"
  ) {
    return { status: "mapped", value }
  }
  if (value === "studio") return { status: "mapped", value: "single" }
  if (value === "villa") return { status: "mapped", value: "suite" }
  return { status: "mapped", value: "suite" }
}

export function mapConnectInclusionKind(
  value: ConnectInclusionKind,
): CompatibilityMappingResult<ExternalPriceComponent["kind"]> {
  if (value === "flight") return { status: "mapped", value: "airfare" }
  if (value === "gratuities") return { status: "mapped", value: "gratuity" }
  if (value === "transfers") return { status: "mapped", value: "transfer" }
  if (value === "insurance") return { status: "mapped", value: "insurance" }
  if (value === "other") return { status: "mapped", value: "other" }
  return { status: "mapped", value: "other" }
}

export function mapConnectEnrichmentKind(
  value: ConnectEnrichmentKind,
): CompatibilityMappingResult<
  "naturalist" | "historian" | "photographer" | "lecturer" | "expert" | "other"
> {
  if (
    value === "naturalist" ||
    value === "historian" ||
    value === "photographer" ||
    value === "lecturer" ||
    value === "other"
  ) {
    return { status: "mapped", value }
  }
  return { status: "mapped", value: "expert" }
}

export function mapConnectPriceComponentKind(
  value: ConnectPriceComponentKind,
): CompatibilityMappingResult<ExternalPriceComponent["kind"]> {
  if (value === "non_commissionable_fare") return { status: "mapped", value: "ncf" }
  if (
    value === "tax" ||
    value === "port_charge" ||
    value === "gratuity" ||
    value === "onboard_credit" ||
    value === "airfare" ||
    value === "transfer" ||
    value === "insurance" ||
    value === "single_supplement" ||
    value === "other"
  ) {
    return { status: "mapped", value }
  }
  return { status: "mapped", value: "other" }
}
