import { booleanQueryParam } from "@voyant-travel/db/helpers"
import { typeIdSchema } from "@voyant-travel/db/lib/typeid"
import { z } from "zod"

export { booleanQueryParam, typeIdSchema, z }

export const cruiseTypeSchema = z.enum(["ocean", "river", "expedition", "coastal"])
export const cruiseStatusSchema = z.enum(["draft", "awaiting_review", "live", "archived"])
export const cruiseSourceSchema = z.enum(["local", "external"])
export const cruiseVoyageGroupKindSchema = z.enum([
  "combination",
  "grand_voyage",
  "world_cruise",
  "cruise_tour",
])
export const cruiseVoyageSegmentKindSchema = z.enum([
  "cruise",
  "land",
  "hotel",
  "transfer",
  "rail",
  "air",
  "other",
])
export const cruiseVoyageSegmentRoleSchema = z.enum(["core", "pre_extension", "post_extension"])

export const shipTypeSchema = z.enum([
  "ocean",
  "river",
  "expedition",
  "yacht",
  "sailing",
  "coastal",
])

export const cabinRoomTypeSchema = z.enum([
  "inside",
  "oceanview",
  "balcony",
  "suite",
  "penthouse",
  "single",
])

export const sailingSalesStatusSchema = z.enum([
  "open",
  "on_request",
  "wait_list",
  "sold_out",
  "closed",
])

export const priceAvailabilitySchema = z.enum([
  "available",
  "limited",
  "on_request",
  "wait_list",
  "sold_out",
])

export const priceFareVariantSchema = z.enum(["cruise_only", "air_inclusive"])

export const priceComponentKindSchema = z.enum([
  "gratuity",
  "onboard_credit",
  "port_charge",
  "tax",
  "ncf",
  "airfare",
  "transfer",
  "insurance",
])

export const priceComponentDirectionSchema = z.enum(["addition", "inclusion", "credit"])

export const cruiseMediaTypeSchema = z.enum(["image", "video", "document"])

export const cruiseInclusionKindSchema = z.enum([
  "meals",
  "drinks",
  "gratuities",
  "transfers",
  "excursions",
  "wifi",
  "other",
])

export const enrichmentProgramKindSchema = z.enum([
  "naturalist",
  "historian",
  "photographer",
  "lecturer",
  "expert",
  "other",
])

export const cruiseSailingDirectionSchema = z.enum([
  "upstream",
  "downstream",
  "round_trip",
  "one_way",
])

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date")
export const currencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "Expected ISO 4217 code")
export const slugSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Expected lowercase slug with hyphens")

export const moneyStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "Expected decimal money string")

export const externalRefsSchema = z.record(z.string(), z.string()).default({})
