import type { z } from "zod"

import type {
  availabilityCloseoutListQuerySchema,
  availabilityOverviewQuerySchema,
  availabilityPickupPointListQuerySchema,
  availabilityRuleListQuerySchema,
  availabilitySlotListQuerySchema,
  availabilitySlotPickupListQuerySchema,
  availabilityStartTimeListQuerySchema,
  customPickupAreaListQuerySchema,
  insertAvailabilityCloseoutSchema,
  insertAvailabilityPickupPointSchema,
  insertAvailabilityRuleSchema,
  insertAvailabilitySlotPickupSchema,
  insertAvailabilitySlotSchema,
  insertAvailabilityStartTimeSchema,
  insertCustomPickupAreaSchema,
  insertLocationPickupTimeSchema,
  insertPickupGroupSchema,
  insertPickupLocationSchema,
  insertProductMeetingConfigSchema,
  locationPickupTimeListQuerySchema,
  pickupGroupListQuerySchema,
  pickupLocationListQuerySchema,
  productMeetingConfigListQuerySchema,
  updateAvailabilityCloseoutSchema,
  updateAvailabilityPickupPointSchema,
  updateAvailabilityRuleSchema,
  updateAvailabilitySlotPickupSchema,
  updateAvailabilitySlotSchema,
  updateAvailabilityStartTimeSchema,
  updateCustomPickupAreaSchema,
  updateLocationPickupTimeSchema,
  updatePickupGroupSchema,
  updatePickupLocationSchema,
  updateProductMeetingConfigSchema,
} from "./validation.js"

export type AvailabilityRuleListQuery = z.infer<typeof availabilityRuleListQuerySchema>
export type AvailabilityStartTimeListQuery = z.infer<typeof availabilityStartTimeListQuerySchema>
export type AvailabilitySlotListQuery = z.infer<typeof availabilitySlotListQuerySchema>
export type AvailabilityOverviewQuery = z.infer<typeof availabilityOverviewQuerySchema>
export type AvailabilityCloseoutListQuery = z.infer<typeof availabilityCloseoutListQuerySchema>
export type AvailabilityPickupPointListQuery = z.infer<
  typeof availabilityPickupPointListQuerySchema
>
export type AvailabilitySlotPickupListQuery = z.infer<typeof availabilitySlotPickupListQuerySchema>
export type ProductMeetingConfigListQuery = z.infer<typeof productMeetingConfigListQuerySchema>
export type PickupGroupListQuery = z.infer<typeof pickupGroupListQuerySchema>
export type PickupLocationListQuery = z.infer<typeof pickupLocationListQuerySchema>
export type LocationPickupTimeListQuery = z.infer<typeof locationPickupTimeListQuerySchema>
export type CustomPickupAreaListQuery = z.infer<typeof customPickupAreaListQuerySchema>
export type CreateAvailabilityRuleInput = z.infer<typeof insertAvailabilityRuleSchema>
export type UpdateAvailabilityRuleInput = z.infer<typeof updateAvailabilityRuleSchema>
export type CreateAvailabilityStartTimeInput = z.infer<typeof insertAvailabilityStartTimeSchema>
export type UpdateAvailabilityStartTimeInput = z.infer<typeof updateAvailabilityStartTimeSchema>
export type CreateAvailabilitySlotInput = z.infer<typeof insertAvailabilitySlotSchema>
export type UpdateAvailabilitySlotInput = z.infer<typeof updateAvailabilitySlotSchema>
export type CreateAvailabilityCloseoutInput = z.infer<typeof insertAvailabilityCloseoutSchema>
export type UpdateAvailabilityCloseoutInput = z.infer<typeof updateAvailabilityCloseoutSchema>
export type CreateAvailabilityPickupPointInput = z.infer<typeof insertAvailabilityPickupPointSchema>
export type UpdateAvailabilityPickupPointInput = z.infer<typeof updateAvailabilityPickupPointSchema>
export type CreateAvailabilitySlotPickupInput = z.infer<typeof insertAvailabilitySlotPickupSchema>
export type UpdateAvailabilitySlotPickupInput = z.infer<typeof updateAvailabilitySlotPickupSchema>
export type CreateProductMeetingConfigInput = z.infer<typeof insertProductMeetingConfigSchema>
export type UpdateProductMeetingConfigInput = z.infer<typeof updateProductMeetingConfigSchema>
export type CreatePickupGroupInput = z.infer<typeof insertPickupGroupSchema>
export type UpdatePickupGroupInput = z.infer<typeof updatePickupGroupSchema>
export type CreatePickupLocationInput = z.infer<typeof insertPickupLocationSchema>
export type UpdatePickupLocationInput = z.infer<typeof updatePickupLocationSchema>
export type CreateLocationPickupTimeInput = z.infer<typeof insertLocationPickupTimeSchema>
export type UpdateLocationPickupTimeInput = z.infer<typeof updateLocationPickupTimeSchema>
export type CreateCustomPickupAreaInput = z.infer<typeof insertCustomPickupAreaSchema>
export type UpdateCustomPickupAreaInput = z.infer<typeof updateCustomPickupAreaSchema>

export async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])

  return {
    data,
    total: countResult[0]?.count ?? 0,
    limit,
    offset,
  }
}

export function toDateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null
}
