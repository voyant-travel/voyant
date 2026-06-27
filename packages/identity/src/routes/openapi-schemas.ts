/**
 * Response/envelope schemas for the identity admin OpenAPI routes (voyant#2114 —
 * identity sub-batch). The row schemas are authored from the Drizzle
 * `$inferSelect` shapes in `schema.ts` (§17: `timestamp` columns serialize to
 * strings over the wire; `doublePrecision` lat/long stay numbers; jsonb
 * `metadata` bags are open records). Enum columns reuse the exported
 * `validation.ts` enum schemas so the documented values stay in lock-step with
 * request validation.
 *
 * These are shared between `routes.ts` and the contract test so the documented
 * envelopes, the runtime handlers, and the round-trip assertions all read from
 * one source.
 */

import { z } from "zod"

import {
  addressLabelSchema,
  contactPointKindSchema,
  namedContactRoleSchema,
} from "../validation.js"

// --- shared envelopes -------------------------------------------------------

export const errorResponseSchema = z.object({ error: z.string() })
export const successResponseSchema = z.object({ success: z.literal(true) })
const idSchema = z.string()
export const idParamSchema = z.object({ id: idSchema })
export const entityParamSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
})

// §17: `timestamp` columns are serialized to ISO strings over the wire.
const isoTimestamp = z.string()
const jsonRecord = z.record(z.string(), z.unknown())

// --- contact point ----------------------------------------------------------

export const contactPointSchema = z.object({
  id: idSchema,
  entityType: z.string(),
  entityId: z.string(),
  kind: contactPointKindSchema,
  label: z.string().nullable(),
  value: z.string(),
  normalizedValue: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// --- address ----------------------------------------------------------------

export const addressSchema = z.object({
  id: idSchema,
  entityType: z.string(),
  entityId: z.string(),
  label: addressLabelSchema,
  fullText: z.string().nullable(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// --- named contact ----------------------------------------------------------

export const namedContactSchema = z.object({
  id: idSchema,
  entityType: z.string(),
  entityId: z.string(),
  role: namedContactRoleSchema,
  name: z.string(),
  title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: jsonRecord.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})
