import { relations, sql } from "drizzle-orm"
import { index, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"
import { z } from "zod"

import { typeId, typeIdRef, typeIdSchema } from "../../lib/index.js"
import { domainsTable } from "./domains.js"

/**
 * Email Domain Records
 *
 * DNS records for email domain verification (DKIM, SPF, DMARC, MX, etc.).
 * Records are fetched from Resend API and stored for user reference.
 */

// Record type enum
export const emailRecordTypes = pgEnum("email_record_type", [
  "DKIM",
  "SPF",
  "DMARC",
  "MX",
  "TXT",
  "CNAME",
])

export const emailRecordTypesSchema = z.enum(emailRecordTypes.enumValues)
export type EmailRecordType = z.infer<typeof emailRecordTypesSchema>

// Record status enum
export const emailRecordStatuses = pgEnum("email_record_status", ["pending", "verified", "failed"])

export const emailRecordStatusesSchema = z.enum(emailRecordStatuses.enumValues)
export type EmailRecordStatus = z.infer<typeof emailRecordStatusesSchema>

export const emailDomainRecordsTable = pgTable(
  "email_domain_records",
  {
    id: typeId("email_domain_records"),
    domainId: typeIdRef("domain_id")
      .notNull()
      .references(() => domainsTable.id, { onDelete: "cascade" }),
    recordType: emailRecordTypes("record_type").notNull(),
    host: text("host").notNull(),
    expectedValue: text("expected_value").notNull(),
    status: emailRecordStatuses("status").notNull().default("pending"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("uq_infra_email_domain_records").on(table.domainId, table.host, table.recordType),
    index("idx_infra_email_records_domain").on(table.domainId),
    index("idx_infra_email_records_pending").on(table.status).where(sql`status = 'pending'`),
  ],
).enableRLS()

export type InsertEmailDomainRecords = typeof emailDomainRecordsTable.$inferInsert
export type SelectEmailDomainRecords = typeof emailDomainRecordsTable.$inferSelect

// Zod schemas
const emailDomainRecordCoreSchema = z.object({
  domainId: typeIdSchema("domains"),
  recordType: emailRecordTypesSchema,
  host: z.string(),
  expectedValue: z.string(),
  status: emailRecordStatusesSchema.default("pending"),
  lastCheckedAt: z.date().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
})

export const emailDomainRecordInsertSchema = emailDomainRecordCoreSchema
export const emailDomainRecordUpdateSchema = emailDomainRecordInsertSchema.partial()
export const emailDomainRecordSelectSchema = emailDomainRecordCoreSchema.extend({
  id: typeIdSchema("email_domain_records"),
  createdAt: z.date().optional().nullable(),
})

export type EmailDomainRecord = z.infer<typeof emailDomainRecordSelectSchema>
export type NewEmailDomainRecord = z.infer<typeof emailDomainRecordInsertSchema>
export type UpdateEmailDomainRecord = z.infer<typeof emailDomainRecordUpdateSchema>

// Relations
export const emailDomainRecordsRelations = relations(emailDomainRecordsTable, ({ one }) => ({
  domain: one(domainsTable, {
    fields: [emailDomainRecordsTable.domainId],
    references: [domainsTable.id],
  }),
}))
