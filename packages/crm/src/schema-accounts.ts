import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import type { KmsEnvelope } from "@voyantjs/db/schema/iam/kms"
import { sql } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import {
  communicationChannelEnum,
  communicationDirectionEnum,
  recordStatusEnum,
  relationTypeEnum,
} from "./schema-shared.js"

/**
 * Identity-document types stored on `person_documents`. Open-ended via
 * "other" so we don't force a schema migration for every regional
 * variant; the structured fields cover the international shape.
 */
export const personDocumentTypeEnum = pgEnum("person_document_type", [
  "passport",
  "id_card",
  "driver_license",
  "visa",
  "other",
])

export const organizations = pgTable(
  "organizations",
  {
    id: typeId("organizations"),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    website: text("website"),
    /** Tax / VAT identification number — used for billing + e-invoicing. */
    vatNumber: text("vat_number"),
    industry: text("industry"),
    relation: relationTypeEnum("relation"),
    ownerId: text("owner_id"),
    defaultCurrency: text("default_currency"),
    preferredLanguage: text("preferred_language"),
    paymentTerms: integer("payment_terms"),
    status: recordStatusEnum("status").notNull().default("active"),
    source: text("source"),
    sourceRef: text("source_ref"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_organizations_name").on(table.name),
    index("idx_organizations_owner").on(table.ownerId),
    index("idx_organizations_status").on(table.status),
    index("idx_organizations_owner_updated").on(table.ownerId, table.updatedAt),
    index("idx_organizations_relation_updated").on(table.relation, table.updatedAt),
    index("idx_organizations_status_updated").on(table.status, table.updatedAt),
  ],
)

export const people = pgTable(
  "people",
  {
    id: typeId("people"),
    organizationId: typeIdRef("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    firstName: text("first_name").notNull(),
    middleName: text("middle_name"),
    lastName: text("last_name").notNull(),
    /** ISO-style "M" / "F" / "X" — used by airline + travel-doc workflows. */
    gender: text("gender"),
    jobTitle: text("job_title"),
    relation: relationTypeEnum("relation"),
    preferredLanguage: text("preferred_language"),
    preferredCurrency: text("preferred_currency"),
    ownerId: text("owner_id"),
    status: recordStatusEnum("status").notNull().default("active"),
    source: text("source"),
    sourceRef: text("source_ref"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    birthday: date("birthday"),
    notes: text("notes"),
    /**
     * Encrypted PII slots — canonical store for person-level travel
     * preferences. Documents live in their own structured table
     * (`person_documents`); these four are kept as KMS envelopes
     * because their internal shape is small and rarely queried.
     *
     * Booking-traveler rows snapshot dietary/accessibility at create
     * time; the person record remains the source of truth for
     * pre-fill on subsequent bookings.
     */
    accessibilityEncrypted: jsonb("accessibility_encrypted").$type<KmsEnvelope>(),
    dietaryEncrypted: jsonb("dietary_encrypted").$type<KmsEnvelope>(),
    loyaltyEncrypted: jsonb("loyalty_encrypted").$type<KmsEnvelope>(),
    insuranceEncrypted: jsonb("insurance_encrypted").$type<KmsEnvelope>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_people_org").on(table.organizationId),
    index("idx_people_owner").on(table.ownerId),
    index("idx_people_status").on(table.status),
    index("idx_people_name").on(table.firstName, table.lastName),
    index("idx_people_org_updated").on(table.organizationId, table.updatedAt),
    index("idx_people_owner_updated").on(table.ownerId, table.updatedAt),
    index("idx_people_relation_updated").on(table.relation, table.updatedAt),
    index("idx_people_status_updated").on(table.status, table.updatedAt),
  ],
)

export const personDirectoryProjections = pgTable(
  "person_directory_projections",
  {
    personId: typeIdRef("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_person_directory_projections_person").on(table.personId)],
)

export const personNotes = pgTable(
  "person_notes",
  {
    id: typeId("person_notes"),
    personId: typeIdRef("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_person_notes_person").on(table.personId),
    index("idx_person_notes_person_created").on(table.personId, table.createdAt),
  ],
)

export type PersonNote = typeof personNotes.$inferSelect
export type NewPersonNote = typeof personNotes.$inferInsert

/**
 * Structured identity documents owned by a person. Replaces the
 * single `documentsEncrypted` blob shape with a row per document so
 * we can track type / expiry / issuing authority / attachment + run
 * "expiring soon" sweeps without parsing JSON.
 *
 * `numberEncrypted` is the only field encrypted at rest — the rest
 * is non-toxic identity metadata. `attachmentId` is a free-form key
 * (typically an object-storage path) until a general media table
 * exists; FK is intentionally deferred.
 *
 * Booking-traveler rows snapshot the primary passport at create time;
 * this table remains the source of truth for next-trip pre-fill.
 */
export const personDocuments = pgTable(
  "person_documents",
  {
    id: typeId("person_documents"),
    personId: typeIdRef("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    type: personDocumentTypeEnum("type").notNull(),
    numberEncrypted: jsonb("number_encrypted").$type<KmsEnvelope>(),
    issuingAuthority: text("issuing_authority"),
    issuingCountry: text("issuing_country"),
    issueDate: date("issue_date"),
    expiryDate: date("expiry_date"),
    attachmentId: text("attachment_id"),
    isPrimary: boolean("is_primary").notNull().default(false),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_person_documents_person").on(table.personId),
    index("idx_person_documents_person_type").on(table.personId, table.type),
    index("idx_person_documents_expiry").on(table.expiryDate),
    uniqueIndex("uidx_person_documents_primary_per_type")
      .on(table.personId, table.type)
      .where(sql`${table.isPrimary} = true`),
  ],
)

export type PersonDocument = typeof personDocuments.$inferSelect
export type NewPersonDocument = typeof personDocuments.$inferInsert

/**
 * Saved payment methods on file for a person. Stores processor-issued
 * tokens (never raw card numbers) so the booking flow can charge the
 * customer without re-entering card details. Cards have last4 + expiry +
 * brand; bank-transfer "methods" carry a brand of "bank_transfer" with
 * last4 / expiry omitted.
 */
export const personPaymentMethods = pgTable(
  "person_payment_methods",
  {
    id: typeId("person_payment_methods"),
    personId: typeIdRef("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** "visa" | "mastercard" | "amex" | "revolut" | "bank_transfer" — kept as text to stay open. */
    brand: text("brand").notNull(),
    /** Last four digits — null for non-card methods. */
    last4: text("last4"),
    holderName: text("holder_name"),
    /** 1-12; null for non-card methods. */
    expMonth: integer("exp_month"),
    expYear: integer("exp_year"),
    /** Opaque processor token — used to charge the customer. */
    processorToken: text("processor_token").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_person_payment_methods_person").on(table.personId),
    index("idx_person_payment_methods_person_default").on(table.personId, table.isDefault),
  ],
)

export type PersonPaymentMethod = typeof personPaymentMethods.$inferSelect
export type NewPersonPaymentMethod = typeof personPaymentMethods.$inferInsert

export const organizationNotes = pgTable(
  "organization_notes",
  {
    id: typeId("organization_notes"),
    organizationId: typeIdRef("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_organization_notes_org").on(table.organizationId),
    index("idx_organization_notes_org_created").on(table.organizationId, table.createdAt),
  ],
)

export type OrganizationNote = typeof organizationNotes.$inferSelect
export type NewOrganizationNote = typeof organizationNotes.$inferInsert

export const communicationLog = pgTable(
  "communication_log",
  {
    id: typeId("communication_log"),
    personId: typeIdRef("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    organizationId: typeIdRef("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    channel: communicationChannelEnum("channel").notNull(),
    direction: communicationDirectionEnum("direction").notNull(),
    subject: text("subject"),
    content: text("content"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_communication_log_person").on(table.personId),
    index("idx_communication_log_person_created").on(table.personId, table.createdAt),
    index("idx_communication_log_person_channel_created").on(
      table.personId,
      table.channel,
      table.createdAt,
    ),
    index("idx_communication_log_person_direction_created").on(
      table.personId,
      table.direction,
      table.createdAt,
    ),
    index("idx_communication_log_org").on(table.organizationId),
    index("idx_communication_log_channel").on(table.channel),
  ],
)

export type CommunicationLogEntry = typeof communicationLog.$inferSelect
export type NewCommunicationLogEntry = typeof communicationLog.$inferInsert

export const segments = pgTable(
  "segments",
  {
    id: typeId("segments"),
    name: text("name").notNull(),
    description: text("description"),
    conditions: jsonb("conditions").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_segments_created").on(table.createdAt)],
)

export type Segment = typeof segments.$inferSelect
export type NewSegment = typeof segments.$inferInsert

export const segmentMembers = pgTable(
  "segment_members",
  {
    id: typeId("segment_members"),
    segmentId: typeIdRef("segment_id")
      .notNull()
      .references(() => segments.id, { onDelete: "cascade" }),
    personId: typeIdRef("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_segment_members_segment").on(table.segmentId),
    index("idx_segment_members_person").on(table.personId),
  ],
)

export type SegmentMember = typeof segmentMembers.$inferSelect
export type NewSegmentMember = typeof segmentMembers.$inferInsert

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type Person = typeof people.$inferSelect
export type NewPerson = typeof people.$inferInsert
export type PersonDirectoryProjection = typeof personDirectoryProjections.$inferSelect
export type NewPersonDirectoryProjection = typeof personDirectoryProjections.$inferInsert
