import {
  insertAddressSchema,
  insertContactPointSchema,
  insertNamedContactSchema,
} from "@voyant-travel/identity"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

export const paginatedEnvelope = listResponseSchema

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const successEnvelope = z.object({ success: z.boolean() })

export const contactPointRecordSchema = insertContactPointSchema.extend({
  id: z.string(),
  label: z.string().nullable(),
  normalizedValue: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ContactPointRecord = z.infer<typeof contactPointRecordSchema>

export const addressRecordSchema = insertAddressSchema.extend({
  id: z.string(),
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
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type AddressRecord = z.infer<typeof addressRecordSchema>

export const namedContactRecordSchema = insertNamedContactSchema.extend({
  id: z.string(),
  title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type NamedContactRecord = z.infer<typeof namedContactRecordSchema>

export const contactPointListResponse = paginatedEnvelope(contactPointRecordSchema)
export const contactPointSingleResponse = singleEnvelope(contactPointRecordSchema)
export const addressListResponse = paginatedEnvelope(addressRecordSchema)
export const addressSingleResponse = singleEnvelope(addressRecordSchema)
export const namedContactListResponse = paginatedEnvelope(namedContactRecordSchema)
export const namedContactSingleResponse = singleEnvelope(namedContactRecordSchema)
