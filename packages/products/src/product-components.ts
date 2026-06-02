import type { ComponentChoiceGroup } from "@voyantjs/catalog/booking-engine"
import { type TravelComponent, travelComponentSchema } from "@voyantjs/travel-components-contracts"

import type { ProductComponentRow } from "./schema.js"

export function productComponentRowToTravelComponent(row: ProductComponentRow): TravelComponent {
  return travelComponentSchema.parse({
    id: row.id,
    component_kind: row.componentKind,
    title: row.title,
    summary: row.summary,
    description: row.description,
    selection: row.selection,
    commitment_boundary: row.commitmentBoundary,
    price_disposition: row.priceDisposition,
    required: row.required,
    quantity: row.quantity,
    sort_order: row.sortOrder,
    binding: row.binding,
    choices: row.choices,
    media: row.media,
    tags: row.tags,
    metadata: row.metadata ?? undefined,
  })
}

export function productComponentRowToBookingChoiceGroup(
  row: ProductComponentRow,
): ComponentChoiceGroup | null {
  const component = productComponentRowToTravelComponent(row)
  if (component.choices.length === 0) return null
  return {
    componentId: component.id,
    componentKind: component.component_kind,
    title: component.title,
    description: component.description ?? null,
    selection: component.selection,
    commitmentBoundary: component.commitment_boundary,
    priceDisposition: component.price_disposition,
    required: component.required,
    quantity: component.quantity,
    sortOrder: component.sort_order,
    choices: component.choices.map((choice) => ({
      id: choice.id,
      title: choice.title,
      description: choice.description ?? null,
      isDefault: choice.is_default,
      sortOrder: choice.sort_order,
      pricingRef: choice.pricing_ref
        ? {
            optionId: choice.pricing_ref.option_id ?? undefined,
            optionUnitId: choice.pricing_ref.option_unit_id ?? undefined,
            pricingCategoryId: choice.pricing_ref.pricing_category_id ?? undefined,
            priceCatalogId: choice.pricing_ref.price_catalog_id ?? undefined,
            priceScheduleId: choice.pricing_ref.price_schedule_id ?? undefined,
          }
        : undefined,
    })),
  }
}
