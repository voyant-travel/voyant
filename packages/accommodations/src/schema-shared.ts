import { pgEnum } from "drizzle-orm/pg-core"

export const accommodationInventoryModeEnum = pgEnum("accommodation_inventory_mode", [
  "pooled",
  "serialized",
  "virtual",
])

export const ratePlanChargeFrequencyEnum = pgEnum("rate_plan_charge_frequency", [
  "per_night",
  "per_stay",
  "per_person_per_night",
  "per_person_per_stay",
])

export const accommodationGuaranteeModeEnum = pgEnum("accommodation_guarantee_mode", [
  "none",
  "card_hold",
  "deposit",
  "full_prepay",
  "on_request",
])

export const stayBookingItemStatusEnum = pgEnum("stay_booking_item_status", [
  "reserved",
  "cancelled",
  "no_show",
])
