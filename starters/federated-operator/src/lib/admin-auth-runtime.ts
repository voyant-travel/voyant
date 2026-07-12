import type { AdminAuthRuntime } from "@voyant-travel/admin/app"

import { authClient } from "./auth"
import { getBootstrapStatus, getCurrentUser } from "./current-user"
import type { CurrentUser } from "./current-user-model"

/**
 * The federated operator's Better-Auth-backed implementation of the admin auth
 * capability port ({@link AdminAuthRuntime}). This deployment is
 * local-auth only (no Voyant Cloud broker), so `cloudAuthStartHref` is never
 * reached — the guard only follows it in `voyant-cloud` mode.
 */
export const adminAuthRuntime: AdminAuthRuntime<CurrentUser> = {
  getCurrentUser,
  getBootstrapStatus,
  cloudAuthStartHref: () => "/sign-in",
  signOut: async () => {
    await authClient.signOut()
  },
}
