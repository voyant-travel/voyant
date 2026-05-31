/**
 * Bookings admin operations (first slice: list, get, confirm, cancel).
 *
 * Output schemas are the curated client-facing projection of the booking
 * entity — not a 1:1 dump of `@voyantjs/bookings`' Drizzle row. When a
 * `@voyantjs/bookings-contracts` package exists, these should re-export from
 * it (see ADR-0002 / ADR-0003).
 */

import { z } from "zod"

import { defineOperation } from "./core/operation.js"
import { pageQuerySchema, paginated } from "./core/pagination.js"

export const bookingSummarySchema = z.object({
  id: z.string(),
  bookingNumber: z.string(),
  status: z.string(),
  personId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  sellCurrency: z.string().nullable().optional(),
  sellAmountCents: z.number().int().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  pax: z.number().int().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type BookingSummary = z.infer<typeof bookingSummarySchema>

export const bookingListInputSchema = pageQuerySchema.extend({
  status: z.string().optional(),
  search: z.string().optional(),
  productId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export const confirmBookingInputSchema = z.object({
  note: z.string().optional(),
  suppressNotifications: z.boolean().optional(),
})

export const cancelBookingInputSchema = z.object({
  note: z.string().optional(),
})

const list = defineOperation({
  id: "bookings.list",
  method: "GET",
  path: () => "/v1/admin/bookings",
  pathTemplate: "/v1/admin/bookings",
  input: bookingListInputSchema,
  output: paginated(bookingSummarySchema),
  classification: "read",
  scopes: ["bookings:read"],
  envelope: "raw",
  summary: "List bookings with filters and offset pagination.",
})

const get = defineOperation({
  id: "bookings.get",
  method: "GET",
  path: (p: { id: string }) => `/v1/admin/bookings/${p.id}`,
  pathTemplate: "/v1/admin/bookings/:id",
  input: z.object({}),
  output: bookingSummarySchema,
  classification: "read",
  scopes: ["bookings:read"],
  summary: "Get a single booking by id.",
})

const confirm = defineOperation({
  id: "bookings.confirm",
  method: "POST",
  path: (p: { id: string }) => `/v1/admin/bookings/${p.id}/confirm`,
  pathTemplate: "/v1/admin/bookings/:id/confirm",
  input: confirmBookingInputSchema,
  output: bookingSummarySchema,
  classification: "requires_confirmation",
  scopes: ["bookings:write"],
  capabilityKey: "booking.status.confirm",
  idempotent: true,
  summary: "Confirm an on-hold booking. May require approval (HTTP 202).",
})

const cancel = defineOperation({
  id: "bookings.cancel",
  method: "POST",
  path: (p: { id: string }) => `/v1/admin/bookings/${p.id}/cancel`,
  pathTemplate: "/v1/admin/bookings/:id/cancel",
  input: cancelBookingInputSchema,
  output: bookingSummarySchema,
  classification: "requires_confirmation",
  scopes: ["bookings:write"],
  capabilityKey: "booking.status.cancel",
  idempotent: true,
  summary: "Cancel a booking. May require approval (HTTP 202).",
})

export const bookingsOperations = { list, get, confirm, cancel } as const
