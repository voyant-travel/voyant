import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { z } from "zod"

import { typeId, typeIdSchema } from "../../lib/index.js"

/**
 * Domains
 *
 * Unified domain management for all purposes: email, customer portal, and booking engine.
 * Supports multiple providers for custom hostname/SSL management.
 */

/**
 * Domain Providers
 *
 * Infrastructure providers that can manage custom hostnames and SSL certificates.
 */
export const domainProviders = pgEnum("domain_provider", [
  "cloudflare", // Cloudflare for SaaS
  // Future providers:
  // "vercel",
  // "aws",
])

export const domainProvidersSchema = z.enum(domainProviders.enumValues)
export type DomainProvider = z.infer<typeof domainProvidersSchema>

// Domain statuses enum
export const domainStatuses = pgEnum("domain_status", ["pending", "verified", "active", "disabled"])

export const domainStatusesSchema = z.enum(domainStatuses.enumValues)
export type DomainStatus = z.infer<typeof domainStatusesSchema>

export const emailProviders = pgEnum("email_provider", ["resend", "ses"])

export const emailProvidersSchema = z.enum(emailProviders.enumValues)
export type EmailProvider = z.infer<typeof emailProvidersSchema>

export const resendRegions = pgEnum("resend_region", [
  "us-east-1",
  "eu-west-1",
  "sa-east-1",
  "ap-northeast-1",
])

export const resendRegionsSchema = z.enum(resendRegions.enumValues)
export type ResendRegion = z.infer<typeof resendRegionsSchema>

export const tlsModes = pgEnum("tls_mode", ["opportunistic", "enforced"])

export const tlsModesSchema = z.enum(tlsModes.enumValues)
export type TlsMode = z.infer<typeof tlsModesSchema>

export type DomainEmailSettings = {
  provider: EmailProvider | null
  region: ResendRegion | null
  providerDomainId: string | null
  returnPathDomain: string | null
  trackingDomain: string | null
  dmarcPolicy: string | null
  clickTracking: boolean
  openTracking: boolean
  tlsMode: TlsMode | null
  configEncrypted: string | null
  notes: string | null
}

export const domainsTable = pgTable(
  "domains",
  {
    id: typeId("domains"),
    domain: text("domain").notNull(),
    status: domainStatuses("status").notNull().default("pending"),

    // Provider for custom hostname/SSL management
    provider: domainProviders("provider").default("cloudflare"),

    // Provider-agnostic hostname metadata
    providerHostnameId: text("provider_hostname_id"), // Custom hostname ID from provider
    providerZoneId: text("provider_zone_id"), // Zone/Project ID where hostname is created
    certificateStatus: text("certificate_status"), // "pending_validation", "pending_issuance", "active", "failed"
    hostnameStatus: text("hostname_status"), // "pending", "active", "moved", "deleted"
    verificationRecords:
      jsonb("verification_records").$type<Array<{ type: string; name: string; value: string }>>(), // DNS records customer needs to add for validation

    // Routing metadata (for dispatch worker)
    customMetadata: jsonb("custom_metadata").$type<Record<string, unknown>>(), // { "environmentId": "...", "organizationId": "..." }

    // Email configuration
    emailProvider: emailProviders("email_provider"),
    emailRegion: resendRegions("email_region"),
    emailProviderDomainId: text("email_provider_domain_id"),
    emailReturnPathDomain: text("email_return_path_domain"),
    emailTrackingDomain: text("email_tracking_domain"),
    emailDmarcPolicy: text("email_dmarc_policy"),
    emailClickTracking: boolean("email_click_tracking").notNull().default(false),
    emailOpenTracking: boolean("email_open_tracking").notNull().default(false),
    emailTlsMode: tlsModes("email_tls_mode").default("opportunistic"),
    emailConfigEncrypted: text("email_config_encrypted"),
    emailNotes: text("email_notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // agent-quality: raw-sql reviewed -- owner: db; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    uniqueIndex("uq_infra_domains_domain").on(sql`lower(${table.domain})`),
    index("idx_infra_domains_status").on(table.status),
    index("idx_infra_domains_provider").on(table.provider),
  ],
).enableRLS()

export type InsertDomains = typeof domainsTable.$inferInsert
export type SelectDomains = typeof domainsTable.$inferSelect

// Zod schemas
const domainCoreSchema = z.object({
  domain: z.string().min(1),
  status: domainStatusesSchema.default("pending"),
  provider: domainProvidersSchema.default("cloudflare"),
  providerHostnameId: z.string().optional().nullable(),
  providerZoneId: z.string().optional().nullable(),
  certificateStatus: z.string().optional().nullable(),
  hostnameStatus: z.string().optional().nullable(),
  verificationRecords: z
    .array(
      z.object({
        type: z.string(),
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional()
    .nullable(),
  customMetadata: z.record(z.string(), z.unknown()).optional().nullable(),
  emailProvider: emailProvidersSchema.nullish(),
  emailRegion: resendRegionsSchema.optional().nullable(),
  emailProviderDomainId: z.string().optional().nullable(),
  emailReturnPathDomain: z.string().optional().nullable(),
  emailTrackingDomain: z.string().optional().nullable(),
  emailDmarcPolicy: z.string().optional().nullable(),
  emailClickTracking: z.boolean().default(false),
  emailOpenTracking: z.boolean().default(false),
  emailTlsMode: tlsModesSchema.optional().nullable(),
  emailConfigEncrypted: z.string().optional().nullable(),
  emailNotes: z.string().optional().nullable(),
})

export const domainInsertSchema = domainCoreSchema
export const domainUpdateSchema = domainInsertSchema.partial()
export const domainSelectSchema = domainCoreSchema.extend({
  id: typeIdSchema("domains"),
  createdAt: z.date().optional().nullable(),
  updatedAt: z.date().optional().nullable(),
})

export type Domain = z.infer<typeof domainSelectSchema>
export type NewDomain = z.infer<typeof domainInsertSchema>
export type UpdateDomain = z.infer<typeof domainUpdateSchema>
