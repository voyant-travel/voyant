import { booleanQueryParam } from "@voyantjs/db/helpers"
import { typeIdSchema } from "@voyantjs/db/lib/typeid"
import { z } from "zod"

export { booleanQueryParam, typeIdSchema, z }

export const charterStatusSchema = z.enum(["draft", "awaiting_review", "live", "archived"])
export const charterSourceSchema = z.enum(["local", "external"])
export const yachtClassSchema = z.enum([
  "luxury_motor",
  "luxury_sailing",
  "expedition",
  "small_cruise",
])
export const voyageSalesStatusSchema = z.enum([
  "open",
  "on_request",
  "wait_list",
  "sold_out",
  "closed",
])
export const suiteCategorySchema = z.enum([
  "standard",
  "deluxe",
  "suite",
  "penthouse",
  "owners",
  "signature",
])
export const suiteAvailabilitySchema = z.enum([
  "available",
  "limited",
  "on_request",
  "wait_list",
  "sold_out",
])
export const charterBookingModeSchema = z.enum(["per_suite", "whole_yacht"])

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

export const percentStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "Expected decimal percent string (e.g. '27.50')")

export const externalRefsSchema = z.record(z.string(), z.string()).default({})

/**
 * Per-currency amount map: `{ "USD": "1500.00", "EUR": "1380.00" }`. Empty
 * map / missing key means the entity is not priced in that currency.
 * Charter pricing stores per-currency amounts as data (this map) rather
 * than encoding currencies as schema columns, so adding a new currency
 * is a content change, not a migration. See #355.
 */
export const pricesByCurrencySchema = z.record(currencyCodeSchema, moneyStringSchema)
