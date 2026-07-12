import { createLocalAuthRouteContribution } from "@voyant-travel/auth-react/local-auth-routes"
import type { RedeemInvitationStatus } from "@voyant-travel/auth-react/ui"
import { useAdminMessages } from "./admin-i18n"
import { api } from "./api-client"
import { authClient } from "./auth"
import { cloudAuthStartHref, getBootstrapStatus, getCurrentUser } from "./current-user"
import { getApiUrl } from "./env"

export const localAuthRouteContribution = createLocalAuthRouteContribution({
  getCurrentUser,
  getBootstrapStatus,
  cloudAuthStartHref,
  useMessages: () => useAdminMessages().auth,
  getInvitation: (token) =>
    api.get<RedeemInvitationStatus>(`/v1/public/invitations/${encodeURIComponent(token)}`),
  redeemInvitation: (token, input) =>
    api.post(`/v1/public/invitations/${encodeURIComponent(token)}/redeem`, input),
  signInWithEmail: (input) => authClient.signIn.email(input),
  signInWithSocial: (provider, callbackURL) => authClient.signIn.social({ provider, callbackURL }),
  sendVerificationOtp: (email) =>
    authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" }),
  refreshAuthStatus: () => fetch(`${getApiUrl()}/auth/status`, { credentials: "include" }),
})
