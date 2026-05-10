import { normalizeApiKeyPermissions, permissionsToStrings } from "@voyantjs/types/api-keys"
import { z } from "zod"

export const currentUserSchema = z.object({
  id: z.string(),
  // Either email or phoneNumber is set on phone-only signups; null when
  // the user authenticates via the other channel only.
  email: z.string().nullable(),
  phoneNumber: z.string().nullable().optional(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  isSuperAdmin: z.boolean(),
  isSupportUser: z.boolean(),
  createdAt: z.string(),
  profilePictureUrl: z.string().nullable().optional(),
})
export type CurrentUser = z.infer<typeof currentUserSchema>

export const authStatusSchema = z.object({
  userExists: z.boolean(),
  authenticated: z.boolean(),
  reason: z.string().optional(),
})
export type AuthStatus = z.infer<typeof authStatusSchema>

export const organizationRoleSchema = z.union([z.string(), z.array(z.string())])
export type OrganizationRole = z.infer<typeof organizationRoleSchema>

export const organizationSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>

export const currentWorkspaceSchema = z.object({
  activeOrganization: organizationSummarySchema.nullable(),
  organizations: z.array(organizationSummarySchema).default([]),
})
export type CurrentWorkspace = z.infer<typeof currentWorkspaceSchema>

const organizationMemberUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
})

export const organizationMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  role: organizationRoleSchema,
  createdAt: z.string(),
  user: organizationMemberUserSchema,
})
export type OrganizationMember = z.infer<typeof organizationMemberSchema>

export const organizationMembersResponseSchema = z.object({
  members: z.array(organizationMemberSchema),
})
export type OrganizationMembersResponse = z.infer<typeof organizationMembersResponseSchema>

export const organizationRemoveMemberSchema = z.object({
  member: organizationMemberSchema.nullable().optional(),
  success: z.boolean().optional(),
})
export type OrganizationRemoveMemberResult = z.infer<typeof organizationRemoveMemberSchema>

export const organizationInvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: organizationRoleSchema,
  status: z.string(),
  inviterId: z.string().nullable().optional(),
  expiresAt: z.string(),
  createdAt: z.string().nullable().optional(),
})
export type OrganizationInvitation = z.infer<typeof organizationInvitationSchema>

export const organizationInvitationsResponseSchema = z.array(organizationInvitationSchema)
export type OrganizationInvitationsResponse = z.infer<typeof organizationInvitationsResponseSchema>

const apiKeyPermissionsSchema = z.union([z.string(), z.record(z.string(), z.array(z.string()))])

const serviceApiKeyBaseSchema = z.object({
  id: z.string(),
  configId: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  start: z.string().nullable().optional(),
  prefix: z.string().nullable().optional(),
  referenceId: z.string().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  rateLimitEnabled: z.boolean().nullable().optional(),
  rateLimitTimeWindow: z.number().nullable().optional(),
  rateLimitMax: z.number().nullable().optional(),
  requestCount: z.number().nullable().optional(),
  remaining: z.number().nullable().optional(),
  lastRequest: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  permissions: apiKeyPermissionsSchema.nullable().optional(),
  metadata: z.unknown().nullable().optional(),
})

export const serviceApiKeySchema = serviceApiKeyBaseSchema.transform((key) => ({
  ...key,
  configId: key.configId ?? "default",
  name: key.name ?? null,
  enabled: key.enabled ?? true,
  permissions: normalizeApiKeyPermissions(key.permissions),
  permissionList: permissionsToStrings(key.permissions),
}))
export type ServiceApiKey = z.infer<typeof serviceApiKeySchema>
export const apiTokenSchema = serviceApiKeySchema
export type ApiToken = ServiceApiKey

export const serviceApiKeyWithSecretSchema = serviceApiKeyBaseSchema
  .extend({
    key: z.string(),
  })
  .transform((key) => ({
    ...key,
    configId: key.configId ?? "default",
    name: key.name ?? null,
    enabled: key.enabled ?? true,
    permissions: normalizeApiKeyPermissions(key.permissions),
    permissionList: permissionsToStrings(key.permissions),
  }))
export type ServiceApiKeyWithSecret = z.infer<typeof serviceApiKeyWithSecretSchema>
export const apiTokenWithSecretSchema = serviceApiKeyWithSecretSchema
export type ApiTokenWithSecret = ServiceApiKeyWithSecret

export const serviceApiKeysResponseSchema = z.object({
  apiKeys: z.array(serviceApiKeySchema),
  total: z.number(),
  limit: z.number().nullable().optional(),
  offset: z.number().nullable().optional(),
})
export type ServiceApiKeysResponse = z.infer<typeof serviceApiKeysResponseSchema>
export const apiTokensResponseSchema = serviceApiKeysResponseSchema
export type ApiTokensResponse = ServiceApiKeysResponse

export const deleteServiceApiKeyResponseSchema = z.object({
  success: z.boolean(),
})
export type DeleteServiceApiKeyResponse = z.infer<typeof deleteServiceApiKeyResponseSchema>
export const deleteApiTokenResponseSchema = deleteServiceApiKeyResponseSchema
export type DeleteApiTokenResponse = DeleteServiceApiKeyResponse
