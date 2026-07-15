import { describe, expect, it } from "vitest"

import {
  cloudTeamInvitationDto,
  cloudTeamMemberDto,
} from "../../src/team-management-cloud-adapter.js"
import {
  localProviderIdForStatus,
  localRoleForRedeemedInvitation,
} from "../../src/team-management-local-adapter.js"

describe("team-management adapters", () => {
  it("normalizes Cloud members without exposing provider identifiers", () => {
    const member = cloudTeamMemberDto({
      membershipId: "provider_membership_1",
      externalUserId: "provider_user_1",
      email: "member@example.com",
      name: "Team Member",
      roleSlug: "editor",
      roleName: "Editor",
      status: "active",
      hasFullPlatformAccess: false,
      hasDeploymentAccess: true,
      isExplicitGrant: true,
      permissions: null,
    })

    expect(member).toEqual({
      id: "provider_membership_1",
      email: "member@example.com",
      name: "Team Member",
      roleId: "editor",
      roleName: "Editor",
      status: "active",
      joinedAt: null,
      lastActivityAt: null,
    })
    expect(member).not.toHaveProperty("externalUserId")
    expect(member).not.toHaveProperty("membershipId")
  })

  it("persists local invitation roles as Better Auth profile grants", () => {
    expect(localRoleForRedeemedInvitation({ roleId: "owner" })).toMatchObject({
      isSuperAdmin: true,
      permissions: ["*"],
    })
    expect(localRoleForRedeemedInvitation({ roleId: "viewer" })).toMatchObject({
      isSuperAdmin: false,
    })
    expect(localRoleForRedeemedInvitation(null)).toEqual(
      localRoleForRedeemedInvitation({ roleId: "editor" }),
    )
  })

  it("reversibly disables local auth providers", () => {
    const disabled = localProviderIdForStatus("credential", "deactivated")

    expect(disabled).not.toBe("credential")
    expect(localProviderIdForStatus(disabled, "active")).toBe("credential")
    expect(localProviderIdForStatus(disabled, "deactivated")).toBe(disabled)
  })

  it("does not expose Cloud invitation tokens through list DTOs", () => {
    const invitation = cloudTeamInvitationDto({
      id: "invite_1",
      email: "member@example.com",
      roleSlug: "editor",
      roleName: "Editor",
      state: "pending",
      acceptedAt: null,
      revokedAt: null,
      createdAt: "2026-07-15T00:00:00.000Z",
      expiresAt: "2026-07-18T00:00:00.000Z",
      inviterUserId: "user_1",
      acceptedUserId: null,
      acceptInvitationUrl: "https://operator.example/accept?token=secret",
      updatedAt: "2026-07-15T00:00:00.000Z",
    })

    expect(invitation).not.toHaveProperty("acceptUrl")
    expect(JSON.stringify(invitation)).not.toContain("secret")
  })
})
