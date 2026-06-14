import {
  bookingTravelerBedPreferenceSchema,
  travelerAllocationMapSchema,
} from "@voyant-travel/bookings-contracts/traveler-schemas"
import { type KmsEnvelope, kmsEnvelopeSchema } from "@voyant-travel/db/schema/iam"
import { sql } from "drizzle-orm"
import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { z } from "zod"

import { bookingTravelers } from "../schema.js"

/**
 * Plaintext shape stored inside `identityEncrypted`. Snapshotted at
 * booking-traveler creation from the canonical `crm.people` +
 * `crm.person_documents` records — see `documentPersonDocumentId`
 * for provenance back to the source document row.
 */
export const bookingTravelerIdentityDocumentTypeSchema = z.enum([
  "passport",
  "id_card",
  "driver_license",
  "visa",
  "other",
])

const legacyBookingTravelerIdentitySchema = z.object({
  nationality: z.string().optional().nullable(),
  documentType: bookingTravelerIdentityDocumentTypeSchema.optional().nullable(),
  documentNumber: z.string().optional().nullable(),
  documentExpiry: z.string().optional().nullable(),
  documentIssuingCountry: z.string().optional().nullable(),
  documentIssuingAuthority: z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  passportExpiry: z.string().optional().nullable(),
  passportIssuingCountry: z.string().optional().nullable(),
  passportIssuingAuthority: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
})

export const bookingTravelerIdentitySchema = legacyBookingTravelerIdentitySchema.transform(
  (value) => {
    const legacyHasPassport =
      value.passportNumber != null ||
      value.passportExpiry != null ||
      value.passportIssuingCountry != null ||
      value.passportIssuingAuthority != null

    return {
      nationality: value.nationality ?? null,
      documentType: value.documentType ?? (legacyHasPassport ? "passport" : null),
      documentNumber: value.documentNumber ?? value.passportNumber ?? null,
      documentExpiry: value.documentExpiry ?? value.passportExpiry ?? null,
      documentIssuingCountry: value.documentIssuingCountry ?? value.passportIssuingCountry ?? null,
      documentIssuingAuthority:
        value.documentIssuingAuthority ?? value.passportIssuingAuthority ?? null,
      dateOfBirth: value.dateOfBirth ?? null,
    }
  },
)

export const bookingTravelerDietarySchema = z.object({
  dietaryRequirements: z.string().optional().nullable(),
})

export const bookingTravelerAccessibilitySchema = z.object({
  accessibilityNeeds: z.string().optional().nullable(),
})

// Defined in @voyant-travel/bookings-contracts (pure); re-exported so existing
// @voyant-travel/bookings/schema/travel-details import paths keep working.
export { bookingTravelerBedPreferenceSchema, travelerAllocationMapSchema }

const decryptedBookingTravelerTravelDetailRecordSchema = z.object({
  travelerId: z.string(),
  nationality: z.string().nullable(),
  documentType: bookingTravelerIdentityDocumentTypeSchema.nullable(),
  documentNumber: z.string().nullable(),
  documentExpiry: z.string().nullable(),
  documentIssuingCountry: z.string().nullable(),
  documentIssuingAuthority: z.string().nullable(),
  documentPersonDocumentId: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  dietaryRequirements: z.string().nullable(),
  accessibilityNeeds: z.string().nullable(),
  isLeadTraveler: z.boolean(),
  sharingGroupId: z.string().nullable(),
  roomTypeId: z.string().nullable(),
  bedPreference: bookingTravelerBedPreferenceSchema.nullable(),
  allocations: travelerAllocationMapSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const decryptedBookingTravelerTravelDetailSchema =
  decryptedBookingTravelerTravelDetailRecordSchema

export const bookingTravelerTravelDetails = pgTable(
  "booking_traveler_travel_details",
  {
    travelerId: text("traveler_id")
      .primaryKey()
      .references(() => bookingTravelers.id, { onDelete: "cascade" }),
    identityEncrypted: jsonb("identity_encrypted").$type<KmsEnvelope>(),
    dietaryEncrypted: jsonb("dietary_encrypted").$type<KmsEnvelope>(),
    accessibilityEncrypted: jsonb("accessibility_encrypted").$type<KmsEnvelope>(),
    /**
     * Provenance pointer to the `crm.person_documents` row that
     * seeded the identity snapshot. Plaintext (non-toxic) and
     * intentionally has no FK — the snapshot is owned by the booking
     * even if the source document is later edited or deleted.
     */
    documentPersonDocumentId: text("document_person_document_id"),
    isLeadTraveler: boolean("is_lead_traveler").notNull().default(false),
    /**
     * Groups travelers across different bookings who share one resource
     * while paying independently. Travelers on the same booking are grouped
     * implicitly by `bookingId`.
     */
    sharingGroupId: text("sharing_group_id"),
    /**
     * Plain cross-package reference to a room type/catalog unit. No FK:
     * accommodations/product catalogs are optional packages.
     */
    roomTypeId: text("room_type_id"),
    bedPreference:
      text("bed_preference").$type<z.infer<typeof bookingTravelerBedPreferenceSchema>>(),
    /**
     * Generic per-resource-kind allocation map, e.g.
     * `{ room: "resource-id", vehicle_seat: "resource-id" }`.
     */
    allocations: jsonb("allocations")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bptd_lead_traveler").on(t.isLeadTraveler),
    index("idx_bptd_sharing_group").on(t.sharingGroupId),
    index("idx_bptd_room_type").on(t.roomTypeId),
  ],
)

const bookingTravelerTravelDetailRecordCoreSchema = z.object({
  travelerId: z.string().min(1),
  // `z.lazy(() => …)` defers schema dereferencing until first use so the
  // cross-package binding (`kmsEnvelopeSchema` from `@voyant-travel/db`) is
  // resolved at parse time, not at this module's top-level evaluation.
  // Without `z.lazy`, bundlers that split this file into a separate chunk
  // from its `@voyant-travel/db` producer can hit the producer's TDZ here.
  // See #501.
  identityEncrypted: z
    .lazy(() => kmsEnvelopeSchema)
    .optional()
    .nullable(),
  dietaryEncrypted: z
    .lazy(() => kmsEnvelopeSchema)
    .optional()
    .nullable(),
  accessibilityEncrypted: z
    .lazy(() => kmsEnvelopeSchema)
    .optional()
    .nullable(),
  documentPersonDocumentId: z.string().nullable().optional(),
  isLeadTraveler: z.boolean().default(false),
  sharingGroupId: z.string().nullable().optional(),
  roomTypeId: z.string().nullable().optional(),
  bedPreference: bookingTravelerBedPreferenceSchema.nullable().optional(),
  allocations: travelerAllocationMapSchema.default({}),
})

export const bookingTravelerTravelDetailInsertSchema = bookingTravelerTravelDetailRecordCoreSchema
  .omit({ travelerId: true })
  .extend({
    travelerId: z.string().min(1),
  })

export const bookingTravelerTravelDetailUpdateSchema = bookingTravelerTravelDetailRecordCoreSchema
  .partial()
  .omit({ travelerId: true })

export const bookingTravelerTravelDetailSelectSchema =
  bookingTravelerTravelDetailRecordCoreSchema.extend({
    createdAt: z.date(),
    updatedAt: z.date(),
  })

export type BookingTravelerIdentity = z.infer<typeof bookingTravelerIdentitySchema>
export type BookingTravelerDietary = z.infer<typeof bookingTravelerDietarySchema>
export type BookingTravelerAccessibility = z.infer<typeof bookingTravelerAccessibilitySchema>
export type BookingTravelerBedPreference = z.infer<typeof bookingTravelerBedPreferenceSchema>
export type TravelerAllocationMap = z.infer<typeof travelerAllocationMapSchema>
export type BookingTravelerTravelDetail = z.infer<typeof bookingTravelerTravelDetailSelectSchema>
export type NewBookingTravelerTravelDetail = z.infer<typeof bookingTravelerTravelDetailInsertSchema>
export type DecryptedBookingTravelerTravelDetail = z.infer<
  typeof decryptedBookingTravelerTravelDetailSchema
>
