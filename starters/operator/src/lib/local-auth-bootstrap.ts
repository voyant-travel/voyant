import { type LocalAuthRoute, resolveLocalAuthRedirect } from "@voyant-travel/auth-react/ui"
import { cloudAuthStartHref, getBootstrapStatus, getCurrentUser } from "./current-user"

export function getLocalAuthRedirect(route: LocalAuthRoute, currentHref: string) {
  return resolveLocalAuthRedirect({
    route,
    currentHref,
    getCurrentUser,
    getBootstrapStatus,
    getCloudAuthStartHref: cloudAuthStartHref,
  })
}
