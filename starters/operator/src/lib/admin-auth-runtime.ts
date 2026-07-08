import type { ManagedProfileAdminAuthRuntime } from "@voyant-travel/admin/app"

import { authClient } from "./auth"
import { cloudAuthStartHref, getBootstrapStatus, getCurrentUser } from "./current-user"
import type { CurrentUser } from "./current-user-model"

/**
 * The operator's Better-Auth-backed implementation of the admin auth capability
 * port ({@link ManagedProfileAdminAuthRuntime}). The packaged admin shell/guard
 * (and, in a later slice, the packaged auth pages) consume this port instead of
 * importing a concrete auth client — a managed Voyant Cloud profile supplies a
 * Cloud-broker implementation of the same port.
 */
export const adminAuthRuntime: ManagedProfileAdminAuthRuntime<CurrentUser> = {
  getCurrentUser,
  getBootstrapStatus,
  cloudAuthStartHref,
  signOut: async () => {
    await authClient.signOut()
  },
}
