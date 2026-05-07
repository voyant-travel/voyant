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
