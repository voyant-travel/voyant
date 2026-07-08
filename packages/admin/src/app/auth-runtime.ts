/**
 * The admin auth capability **port** for the managed-profile admin host.
 *
 * Auth is deployment-owned: the admin surfaces (shell, guard, packaged pages)
 * never import a concrete auth client. Instead a deployment provides a
 * {@link ManagedProfileAdminAuthRuntime}, and the packaged admin depends only on
 * this port. There are two implementations:
 *
 * - **Managed profile** — a Voyant Cloud identity-broker impl. Unauthenticated
 *   visitors are redirected to the Cloud broker (`authMode: "voyant-cloud"`); no
 *   local password/login pages are shipped.
 * - **Self-host / starter** — a Better Auth impl (`authMode: "local"`) that also
 *   mounts the local `(auth)` page suite consuming this same port.
 *
 * The `getCurrentUser` / `getBootstrapStatus` members are typically TanStack
 * server functions (cookie-forwarding), so they are *provided*, not packaged.
 */

/** Identity-broker mode: local Better Auth, or the Voyant Cloud broker. */
export type AdminAuthMode = "local" | "voyant-cloud"

/** Whether any user exists yet, plus the identity-broker mode. */
export interface AdminBootstrapStatus {
  hasUsers: boolean
  authMode?: AdminAuthMode
}

/**
 * The auth capability a deployment supplies to the packaged admin. `TUser` is
 * the deployment's loaded-user shape (a structural superset of
 * {@link AdminWorkspaceShellUser}).
 */
export interface ManagedProfileAdminAuthRuntime<TUser> {
  /** Resolve the current user (server fn / cookie-forwarding fetch); `null` when signed out. */
  getCurrentUser: () => Promise<TUser | null | undefined>
  /** Whether any user exists yet + the identity-broker mode driving redirects. */
  getBootstrapStatus: () => Promise<AdminBootstrapStatus>
  /** Href that starts the Voyant Cloud identity-broker flow (used in `voyant-cloud` mode). */
  cloudAuthStartHref: (next?: string) => string
  /** Clear the current session. Navigation after sign-out is the caller's concern. */
  signOut: () => Promise<void>
}
