export type LocalAuthRoute =
  | "accept-invitation"
  | "forgot-password"
  | "reset-password"
  | "sign-in"
  | "sign-up"
  | "verify-email"

export type LocalAuthRedirect =
  | { href: string }
  | { to: "/" | "/sign-in" | "/sign-up"; search?: { next: string } }

export interface ResolveLocalAuthRouteOptions<TUser> {
  route: LocalAuthRoute
  currentHref: string
  getCurrentUser: () => Promise<TUser | null>
  getBootstrapStatus: () => Promise<{ hasUsers: boolean; authMode?: "local" | "voyant-cloud" }>
  getCloudAuthStartHref: (next: string) => string
}

export async function resolveLocalAuthRedirect<TUser>({
  route,
  currentHref,
  getCurrentUser,
  getBootstrapStatus,
  getCloudAuthStartHref,
}: ResolveLocalAuthRouteOptions<TUser>): Promise<LocalAuthRedirect | null> {
  const [user, bootstrap] = await Promise.all([getCurrentUser(), getBootstrapStatus()])

  if (bootstrap.authMode === "voyant-cloud") {
    return { href: getCloudAuthStartHref(currentHref) }
  }

  if (route === "accept-invitation") {
    return user ? null : { to: "/sign-in", search: { next: currentHref } }
  }

  if (user) {
    return { to: "/" }
  }

  if (route === "sign-in" && !bootstrap.hasUsers) {
    return { to: "/sign-up" }
  }

  if (route === "sign-up" && bootstrap.hasUsers) {
    return { to: "/sign-in" }
  }

  return null
}
