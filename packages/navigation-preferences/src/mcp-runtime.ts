import { defineToolContextContribution, ToolError } from "@voyant-travel/tools"
import { hasApiKeyPermission, permissionStringsToPermissions } from "@voyant-travel/types/api-keys"

import {
  getNavigationPreferences,
  setMemberNavigationPreferences,
  setOrganizationNavigationPreferences,
} from "./service.js"
import type { NavigationPreferencesToolServices } from "./tools.js"

export * from "./tools.js"

export function createNavigationPreferencesToolServices(
  db: Parameters<typeof getNavigationPreferences>[0],
  memberId: string,
  scopes: readonly string[] = [],
): NavigationPreferencesToolServices {
  return {
    async get() {
      return {
        ...(await getNavigationPreferences(db, memberId)),
        canManageOrganization: hasApiKeyPermission(
          permissionStringsToPermissions([...scopes]),
          "admin-navigation",
          "write",
        ),
      }
    },
    setOrganization: (visibility) => setOrganizationNavigationPreferences(db, visibility),
    setMember: (visibility) => setMemberNavigationPreferences(db, memberId, visibility),
  }
}

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["navigationPreferences"],
  contribute: ({ context, request }) => {
    const variables = (request as { var?: { userId?: unknown; scopes?: unknown } }).var
    const memberId = variables?.userId
    if (typeof memberId !== "string" || memberId.length === 0) {
      throw new ToolError(
        "Navigation preference Tools require an authenticated member.",
        "AUTHORIZATION_DENIED",
      )
    }
    const scopes = Array.isArray(variables?.scopes)
      ? variables.scopes.filter((scope): scope is string => typeof scope === "string")
      : []
    return {
      navigationPreferences: createNavigationPreferencesToolServices(
        context.db as Parameters<typeof getNavigationPreferences>[0],
        memberId,
        scopes,
      ),
    }
  },
})
