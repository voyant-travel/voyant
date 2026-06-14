import { z } from "zod"

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

export const operatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  contactEmail: z.string(),
  contactName: z.string().nullable(),
  status: z.enum(["active", "suspended", "deactivated"]),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Operator = z.infer<typeof operatorSchema>

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

export const connectionSchema = z.object({
  id: z.string(),
  operatorId: z.string(),
  supplierName: z.string(),
  supplierEndpoint: z.string(),
  environment: z.enum(["production", "sandbox", "staging"]),
  role: z.enum(["supplier", "reseller"]),
  status: z.enum(["active", "inactive", "error"]),
  credentialsEncrypted: z.string().nullable(),
  credentialsKeyVersion: z.string().nullable(),
  lastSyncAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Connection = z.infer<typeof connectionSchema>

// ---------------------------------------------------------------------------
// Operator Grants (Partners)
// ---------------------------------------------------------------------------

export const operatorGrantSchema = z.object({
  id: z.string(),
  operatorId: z.string(),
  grantorOrganizationId: z.string(),
  granteeOrganizationId: z.string().nullable(),
  scopes: z.array(z.string()),
  status: z.enum(["active", "suspended", "revoked"]),
  label: z.string().nullable(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type OperatorGrant = z.infer<typeof operatorGrantSchema>

// ---------------------------------------------------------------------------
// OAuth Clients
// ---------------------------------------------------------------------------

export const oauthClientSchema = z.object({
  id: z.string(),
  operatorId: z.string(),
  clientId: z.string(),
  scopes: z.array(z.string()),
  name: z.string(),
  grantId: z.string().nullable().optional(),
  active: z.boolean(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type OAuthClient = z.infer<typeof oauthClientSchema>

export const oauthClientWithSecretSchema = oauthClientSchema.omit({ updatedAt: true }).extend({
  clientSecret: z.string(),
})

export type OAuthClientWithSecret = z.infer<typeof oauthClientWithSecretSchema>

// ---------------------------------------------------------------------------
// Synced Products (from DB)
// ---------------------------------------------------------------------------

export const syncedProductOptionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  optionExternalId: z.string(),
  isDefault: z.boolean(),
  internalName: z.string(),
  reference: z.string().nullable(),
  cancellationCutoff: z.string(),
  cancellationCutoffAmount: z.number(),
  cancellationCutoffUnit: z.string(),
  restrictions: z.unknown().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  units: z
    .array(
      z.object({
        id: z.string(),
        optionId: z.string(),
        unitExternalId: z.string(),
        internalName: z.string(),
        reference: z.string().nullable(),
        unitType: z.string(),
        restrictions: z.unknown().nullable(),
        pricing: z.unknown().nullable(),
        pricingFrom: z.unknown().nullable(),
        createdAt: z.coerce.date(),
        updatedAt: z.coerce.date(),
      }),
    )
    .optional(),
})

export type SyncedProductOption = z.infer<typeof syncedProductOptionSchema>

export const syncedProductSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  productExternalId: z.string(),
  internalName: z.string(),
  reference: z.string().nullable(),
  locale: z.string(),
  timeZone: z.string().nullable(),
  availabilityType: z.string(),
  defaultCurrency: z.string().nullable(),
  shortDescription: z.string().nullable(),
  lastSyncAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  options: z.array(syncedProductOptionSchema).optional(),
})

export type SyncedProduct = z.infer<typeof syncedProductSchema>

// ---------------------------------------------------------------------------
// Synced Suppliers (from DB)
// ---------------------------------------------------------------------------

export const syncedSupplierSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  supplierExternalId: z.string(),
  name: z.string(),
  endpoint: z.string(),
  contactWebsite: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactTelephone: z.string().nullable(),
  contactAddress: z.string().nullable(),
  shortDescription: z.string().nullable(),
  lastSyncAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type SyncedSupplier = z.infer<typeof syncedSupplierSchema>

// ---------------------------------------------------------------------------
// Invite Tokens
// ---------------------------------------------------------------------------

export const inviteTokenSchema = z.object({
  id: z.string(),
  operatorId: z.string(),
  token: z.string(),
  label: z.string().nullable(),
  scopes: z.array(z.string()),
  grantId: z.string().nullable().optional(),
  redeemed: z.boolean(),
  redeemedByOrganizationId: z.string().nullable(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type InviteToken = z.infer<typeof inviteTokenSchema>

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export const usageSummarySchema = z.object({
  totalRequests: z.number(),
  avgDurationMs: z.number(),
  byStatus: z.record(z.string(), z.number()),
})

export type UsageSummary = z.infer<typeof usageSummarySchema>
