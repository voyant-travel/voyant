import { describe, expect, it } from "vitest"

import { cloudTeamMemberDto } from "../../src/team-management-cloud-adapter.js"
import { localRoleForRedeemedInvitation } from "../../src/team-management-local-adapter.js"

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
})
