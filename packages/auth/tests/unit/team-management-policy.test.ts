import { describe, expect, it, vi } from "vitest"

import {
  createGuardedTeamManagementProvider,
  type TeamManagementAdapter,
} from "../../src/team-management-policy.js"
import type {
  TeamManagementCapabilitiesDto,
  TeamMemberDto,
} from "../../src/team-management-runtime-port.js"

const context = { bindings: {}, db: {} as never, userId: "user_actor" }
const allCapabilities: TeamManagementCapabilitiesDto = {
  viewRoster: true,
  inviteMembers: true,
  manageRoles: true,
  deactivateMembers: true,
  revokeInvitations: true,
}

function member(id: string, roleId: string): TeamMemberDto {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    roleId,
    roleName: roleId,
    status: "active",
    joinedAt: null,
    lastActivityAt: null,
  }
}

function adapter(overrides: Partial<TeamManagementAdapter> = {}): TeamManagementAdapter {
  const members = [member("actor", "admin"), member("target", "editor")]
  return {
    getActor: vi.fn(async () => ({ memberId: "actor", roleId: "admin" })),
    getCapabilities: vi.fn(async () => allCapabilities),
    listMembers: vi.fn(async () => members),
    listRoles: vi.fn(async () => [
      { id: "owner", name: "Owner", description: null },
      { id: "admin", name: "Admin", description: null },
      { id: "editor", name: "Editor", description: null },
    ]),
    listInvitations: vi.fn(async () => []),
    inviteMember: vi.fn(async (_request, input) => ({
      id: "invite",
      email: input.email,
      roleId: input.roleId,
      roleName: input.roleId,
      status: "pending",
      createdAt: "2026-07-15T00:00:00.000Z",
      expiresAt: "2026-07-18T00:00:00.000Z",
      acceptUrl: null,
    })),
    revokeInvitation: vi.fn(async () => undefined),
    updateMemberRole: vi.fn(async (_request, id, roleId) => member(id, roleId)),
    deactivateMember: vi.fn(async (_request, id) => ({
      ...members.find((candidate) => candidate.id === id)!,
      status: "deactivated",
    })),
    roleLevel: (roleId) =>
      (({ owner: 40, admin: 30, editor: 20 }) as Record<string, number>)[roleId] ?? 0,
    isOwnerRole: (roleId) => roleId === "owner",
    ...overrides,
  }
}

describe("guarded team-management provider", () => {
  it("enforces discovered capabilities server-side", async () => {
    const source = adapter({
      getCapabilities: vi.fn(async () => ({ ...allCapabilities, inviteMembers: false })),
    })
    const runtime = createGuardedTeamManagementProvider(() => source)

    await expect(
      runtime.inviteMember(context, { email: "new@example.com", roleId: "editor" }),
    ).rejects.toMatchObject({ code: "forbidden", status: 403 })
    expect(source.inviteMember).not.toHaveBeenCalled()
  })

  it("blocks role privilege escalation", async () => {
    const source = adapter()
    const runtime = createGuardedTeamManagementProvider(() => source)

    await expect(runtime.updateMemberRole(context, "target", "owner")).rejects.toMatchObject({
      code: "privilege_escalation",
    })
    expect(source.updateMemberRole).not.toHaveBeenCalled()
  })

  it("blocks self-demotion and self-deactivation", async () => {
    const source = adapter()
    const runtime = createGuardedTeamManagementProvider(() => source)

    await expect(runtime.updateMemberRole(context, "actor", "editor")).rejects.toMatchObject({
      code: "self_change_forbidden",
    })
    await expect(runtime.deactivateMember(context, "actor")).rejects.toMatchObject({
      code: "self_change_forbidden",
    })
  })

  it("blocks demotion and deactivation of the last active owner", async () => {
    const owner = member("owner", "owner")
    const source = adapter({
      getActor: vi.fn(async () => ({ memberId: "admin", roleId: "owner" })),
      listMembers: vi.fn(async () => [member("admin", "admin"), owner]),
    })
    const runtime = createGuardedTeamManagementProvider(() => source)

    await expect(runtime.updateMemberRole(context, "owner", "editor")).rejects.toMatchObject({
      code: "last_owner",
    })
    await expect(runtime.deactivateMember(context, "owner")).rejects.toMatchObject({
      code: "last_owner",
    })
  })
})
