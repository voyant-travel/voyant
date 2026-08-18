import { definePort } from "@voyant-travel/core/project"
import type { VoyantDb } from "@voyant-travel/hono"

export interface ActiveStaffIdentity {
  userId: string
  displayName: string
}

export interface StaffDirectoryLookupContext {
  db: VoyantDb
  bindings: Record<string, unknown>
  requesterUserId: string
}

/** Auth-owned stable user identities exposed without copying profiles into consumers. */
export interface StaffDirectoryRuntimeProvider {
  isActiveStaff(context: StaffDirectoryLookupContext, userId: string): Promise<boolean>
  listActiveStaff(
    context: StaffDirectoryLookupContext,
    input?: { userIds?: readonly string[] },
  ): Promise<readonly ActiveStaffIdentity[]>
}

export const staffDirectoryRuntimePort = definePort<StaffDirectoryRuntimeProvider>({
  id: "auth.staff-directory",
  test(provider) {
    if (
      !provider ||
      typeof provider !== "object" ||
      typeof provider.isActiveStaff !== "function" ||
      typeof provider.listActiveStaff !== "function"
    ) {
      throw new Error("auth.staff-directory provider must implement active staff lookups.")
    }
  },
})
