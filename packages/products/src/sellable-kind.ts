import type { z } from "zod"
import type { productSellableKindSchema } from "./validation-shared.js"

export type ProductSellableKind = z.infer<typeof productSellableKindSchema>

interface InferProductSellableKindInput {
  bookingMode?: string | null
  productTypeCode?: string | null
  productTypeName?: string | null
  tags?: ReadonlyArray<string> | null
  capabilities?: ReadonlyArray<string> | null
}

const PACKAGE_MARKERS = new Set([
  "package",
  "packages",
  "tour package",
  "tour-package",
  "tour_package",
  "travel package",
  "travel-package",
  "travel_package",
])

const TOUR_MARKERS = new Set(["tour", "tours"])
const ACTIVITY_MARKERS = new Set(["activity", "activities", "experience", "experiences"])

/**
 * Derive the lightweight sellable facet without introducing a products table
 * discriminator. A future explicit productKind column can replace this helper
 * while preserving the public `sellableKind` shape.
 */
export function inferProductSellableKind(
  input: InferProductSellableKindInput = {},
): ProductSellableKind {
  const markers = [input.productTypeCode, input.productTypeName, ...(input.tags ?? [])].flatMap(
    markerVariants,
  )
  const markerSet = new Set(markers)

  if ([...markerSet].some((marker) => PACKAGE_MARKERS.has(marker))) {
    return "package"
  }

  const capabilities = new Set(input.capabilities ?? [])
  if (
    capabilities.has("multi_day") &&
    capabilities.has("accommodation") &&
    capabilities.has("transport")
  ) {
    return "package"
  }

  if ([...markerSet].some((marker) => TOUR_MARKERS.has(marker))) {
    return "tour"
  }

  if ([...markerSet].some((marker) => ACTIVITY_MARKERS.has(marker))) {
    return "activity"
  }

  if (input.bookingMode === "transfer" || capabilities.has("transport")) {
    return "transfer"
  }

  if (input.bookingMode === "stay" || capabilities.has("accommodation")) {
    return "accommodation"
  }

  return "product"
}

function markerVariants(value: string | null | undefined): string[] {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return []
  return Array.from(
    new Set([
      normalized,
      normalized.replace(/[-_]+/g, " "),
      normalized.replace(/\s+/g, "-"),
      normalized.replace(/\s+/g, "_"),
    ]),
  )
}
