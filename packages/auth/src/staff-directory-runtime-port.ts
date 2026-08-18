import { authUser } from "@voyant-travel/db/schema/iam"
import type {
  ActiveStaffIdentity,
  StaffDirectoryLookupContext,
  StaffDirectoryRuntimeProvider,
} from "./staff-directory-port.js"
import type { TeamManagementRuntimeProvider } from "./team-management-runtime-port.js"

export * from "./staff-directory-port.js"

export function createTeamBackedStaffDirectory(
  team: TeamManagementRuntimeProvider,
): StaffDirectoryRuntimeProvider {
  async function listActiveStaff(
    context: StaffDirectoryLookupContext,
    input: { userIds?: readonly string[] } = {},
  ): Promise<readonly ActiveStaffIdentity[]> {
    const [members, users] = await Promise.all([
      team.listMembers({
        db: context.db,
        bindings: context.bindings,
        userId: context.requesterUserId,
      }),
      context.db
        .select({ id: authUser.id, email: authUser.email, name: authUser.name })
        .from(authUser),
    ])
    const requested = input.userIds ? new Set(input.userIds) : null
    const usersById = new Map(users.map((user) => [user.id, user]))
    const usersByEmail = new Map(
      users.flatMap((user) =>
        user.email ? [[user.email.trim().toLowerCase(), user] as const] : [],
      ),
    )
    return members.flatMap((member) => {
      if (member.status !== "active") return []
      const user =
        usersById.get(member.id) ??
        (member.email ? usersByEmail.get(member.email.trim().toLowerCase()) : undefined)
      if (!user || (requested && !requested.has(user.id))) return []
      return [
        {
          userId: user.id,
          displayName: member.name?.trim() || user.name?.trim() || member.email || user.id,
        },
      ]
    })
  }

  return {
    async isActiveStaff(context, userId) {
      return (await listActiveStaff(context, { userIds: [userId] })).length === 1
    },
    listActiveStaff,
  }
}
