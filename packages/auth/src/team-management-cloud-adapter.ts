import { cloudAuthUserLinks } from "@voyant-travel/db/schema/iam"
import { eq } from "drizzle-orm"

import {
  inviteCloudAdminMember,
  listCloudAdminInvitations,
  listCloudAdminMemberRoles,
  listCloudAdminMembers,
  revokeCloudAdminInvitation,
  setCloudAdminMemberAccess,
  setCloudAdminMemberRole,
  type CloudAdminInvitation,
  type CloudAdminMember,
  type CloudAdminMembersRequest,
} from "./cloud-broker.js"
import type { IdentityAccessRuntimeProvider } from "./identity-access-runtime-port.js"
import type {
  TeamInvitationDto,
  TeamManagementCapabilitiesDto,
  TeamManagementRequestContext,
  TeamMemberDto,
} from "./team-management-runtime-port.js"
import { TeamManagementError, type TeamManagementAdapter } from "./team-management-policy.js"

function roleLevel(roleId: string): number {
  switch (roleId.trim().toLowerCase()) {
    case "owner":
      return 40
    case "admin":
      return 30
    case "editor":
    case "member":
      return 20
    case "viewer":
    case "guest":
      return 10
    default:
      return 0
  }
}

export function cloudTeamMemberDto(member: CloudAdminMember): TeamMemberDto {
  const roleId = member.roleSlug ?? "member"
  return {
    id: member.membershipId,
    email: member.email,
    name: member.name ?? null,
    roleId,
    roleName: member.roleName ?? roleId,
    status:
      member.hasDeploymentAccess && member.status.toLowerCase() === "active"
        ? "active"
        : "deactivated",
    joinedAt: member.createdAt ?? null,
    lastActivityAt: member.lastActivityAt ?? null,
  }
}

function invitationDto(invitation: CloudAdminInvitation): TeamInvitationDto {
  const roleId = invitation.roleSlug ?? "member"
  return {
    id: invitation.id,
    email: invitation.email,
    roleId,
    roleName: invitation.roleName ?? roleId,
    status: invitation.state,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    acceptUrl: invitation.acceptInvitationUrl || null,
  }
}

async function resolveCloudRequest(
  identityAccess: IdentityAccessRuntimeProvider,
  context: TeamManagementRequestContext,
): Promise<CloudAdminMembersRequest & { actingExternalUserId: string }> {
  const deployment = identityAccess.resolveDeployment(context.bindings)
  if (!deployment.cloudAdminMembers) {
    throw new TeamManagementError(
      "not_configured",
      "Voyant Cloud team management is not configured.",
      501,
    )
  }
  const [link] = await context.db
    .select({ providerAccountId: cloudAuthUserLinks.providerAccountId })
    .from(cloudAuthUserLinks)
    .where(eq(cloudAuthUserLinks.userId, context.userId))
    .limit(1)
  if (!link?.providerAccountId) {
    throw new TeamManagementError("forbidden", "No Cloud identity is linked to this session.")
  }
  return {
    config: deployment.cloudAdminMembers,
    actingWorkosUserId: link.providerAccountId,
    actingExternalUserId: link.providerAccountId,
  }
}

export function createCloudTeamManagementAdapter(
  identityAccess: IdentityAccessRuntimeProvider,
): TeamManagementAdapter {
  return {
    async getActor(context) {
      const request = await resolveCloudRequest(identityAccess, context)
      const actor = (await listCloudAdminMembers(request)).find(
        (member) => member.externalUserId === request.actingExternalUserId,
      )
      if (!actor || !actor.hasDeploymentAccess) {
        throw new TeamManagementError("forbidden", "The current user cannot manage this team.")
      }
      return { memberId: actor.membershipId, roleId: actor.roleSlug ?? "member" }
    },
    async getCapabilities(_context, actor): Promise<TeamManagementCapabilitiesDto> {
      const canManage = actor.roleId === "owner" || actor.roleId === "admin"
      return {
        viewRoster: true,
        inviteMembers: canManage,
        manageRoles: canManage,
        deactivateMembers: canManage,
        revokeInvitations: canManage,
      }
    },
    async listMembers(context) {
      return (await listCloudAdminMembers(await resolveCloudRequest(identityAccess, context))).map(
        cloudTeamMemberDto,
      )
    },
    async listRoles(context) {
      return (
        await listCloudAdminMemberRoles(await resolveCloudRequest(identityAccess, context))
      ).map((role) => ({ id: role.slug, name: role.name, description: role.description }))
    },
    async listInvitations(context) {
      return (
        await listCloudAdminInvitations(await resolveCloudRequest(identityAccess, context))
      ).map(invitationDto)
    },
    async inviteMember(context, input) {
      return invitationDto(
        await inviteCloudAdminMember({
          ...(await resolveCloudRequest(identityAccess, context)),
          input: {
            email: input.email,
            roleSlug: input.roleId,
            expiresInDays: input.expiresInDays,
          },
        }),
      )
    },
    async revokeInvitation(context, invitationId) {
      await revokeCloudAdminInvitation({
        ...(await resolveCloudRequest(identityAccess, context)),
        invitationId,
      })
    },
    async updateMemberRole(context, memberId, roleId) {
      return cloudTeamMemberDto(
        await setCloudAdminMemberRole({
          ...(await resolveCloudRequest(identityAccess, context)),
          membershipId: memberId,
          roleSlug: roleId,
        }),
      )
    },
    async deactivateMember(context, memberId) {
      return cloudTeamMemberDto(
        await setCloudAdminMemberAccess({
          ...(await resolveCloudRequest(identityAccess, context)),
          membershipId: memberId,
          hasAccess: false,
        }),
      )
    },
    roleLevel,
    isOwnerRole(roleId) {
      return roleId === "owner"
    },
  }
}
