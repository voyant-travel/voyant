import { pgEnum } from "drizzle-orm/pg-core"

export const cruiseTypeEnum = pgEnum("cruise_type", ["ocean", "river", "expedition", "coastal"])

export const cruiseStatusEnum = pgEnum("cruise_status", [
  "draft",
  "awaiting_review",
  "live",
  "archived",
])

export const cruiseSourceEnum = pgEnum("cruise_source", ["local", "external"])

export const cruiseVoyageGroupKindEnum = pgEnum("cruise_voyage_group_kind", [
  "combination",
  "grand_voyage",
  "world_cruise",
  "cruise_tour",
])

export const cruiseVoyageSegmentKindEnum = pgEnum("cruise_voyage_segment_kind", [
  "cruise",
  "land",
  "hotel",
  "transfer",
  "rail",
  "air",
  "other",
])

export const cruiseVoyageSegmentRoleEnum = pgEnum("cruise_voyage_segment_role", [
  "core",
  "pre_extension",
  "post_extension",
])

export const shipTypeEnum = pgEnum("cruise_ship_type", [
  "ocean",
  "river",
  "expedition",
  "yacht",
  "sailing",
  "coastal",
])

export const cabinRoomTypeEnum = pgEnum("cruise_cabin_room_type", [
  "inside",
  "oceanview",
  "balcony",
  "suite",
  "penthouse",
  "single",
])

export const sailingSalesStatusEnum = pgEnum("cruise_sailing_sales_status", [
  "open",
  "on_request",
  "wait_list",
  "sold_out",
  "closed",
])

export const priceAvailabilityEnum = pgEnum("cruise_price_availability", [
  "available",
  "limited",
  "on_request",
  "wait_list",
  "sold_out",
])

export const priceFareVariantEnum = pgEnum("cruise_price_fare_variant", [
  "cruise_only",
  "air_inclusive",
])

export const priceComponentKindEnum = pgEnum("cruise_price_component_kind", [
  "gratuity",
  "onboard_credit",
  "port_charge",
  "tax",
  "ncf",
  "airfare",
  "transfer",
  "insurance",
])

export const priceComponentDirectionEnum = pgEnum("cruise_price_component_direction", [
  "addition",
  "inclusion",
  "credit",
])

export const cruiseMediaTypeEnum = pgEnum("cruise_media_type", ["image", "video", "document"])

export const cruiseInclusionKindEnum = pgEnum("cruise_inclusion_kind", [
  "meals",
  "drinks",
  "gratuities",
  "transfers",
  "excursions",
  "wifi",
  "other",
])

export const enrichmentProgramKindEnum = pgEnum("cruise_enrichment_program_kind", [
  "naturalist",
  "historian",
  "photographer",
  "lecturer",
  "expert",
  "other",
])

/**
 * Sailing direction. River cruises use upstream/downstream; ocean cruises
 * typically use round_trip (return to embark port) — though many lines
 * leave it null, which is valid.
 */
export const cruiseSailingDirectionEnum = pgEnum("cruise_sailing_direction", [
  "upstream",
  "downstream",
  "round_trip",
  "one_way",
])
