export const AUTH_ROUTE_HOSTS = {
  "accept-invitation.tsx": "acceptInvitation",
  "accept-invite.tsx": "acceptInvite",
  "forgot-password.tsx": "forgotPassword",
  "onboarding.tsx": "onboarding",
  "reset-password.tsx": "resetPassword",
  "route.tsx": "layout",
  "sign-in.tsx": "signIn",
  "sign-up.tsx": "signUp",
  "verify-email.tsx": "verifyEmail",
}

export function checkOperatorAuthPresentationAuthority({ routeHosts, adapter, packageRoutes }) {
  const failures = []
  let hostLines = 0

  for (const [file, routeKey] of Object.entries(AUTH_ROUTE_HOSTS)) {
    const source = routeHosts[file]
    if (source === undefined) {
      failures.push(`${file} is required as a generated route host`)
      continue
    }
    hostLines += source.split("\n").length
    for (const token of ["localAuthRouteContribution", `routes.${routeKey}`, "createFileRoute"]) {
      if (!source.includes(token)) failures.push(`${file} must contain ${token}`)
    }
    for (const token of [
      "function ",
      "useNavigate",
      "useQuery",
      "redirect(",
      'from "zod"',
      "authClient",
      "useAdminMessages",
    ]) {
      if (source.includes(token)) failures.push(`${file} must not own ${token.trim()}`)
    }
  }

  if (hostLines > 70) {
    failures.push(`operator auth route hosts grew to ${hostLines} lines; ratchet is 70`)
  }

  for (const token of [
    "createLocalAuthRouteContribution",
    "getCurrentUser",
    "getBootstrapStatus",
    "cloudAuthStartHref",
    "getInvitation",
    "redeemInvitation",
    "signInWithEmail",
    "signInWithSocial",
    "sendVerificationOtp",
  ]) {
    if (!adapter.includes(token)) failures.push(`local auth adapter must contain ${token}`)
  }
  if (adapter.includes("resolveLocalAuthRedirect")) {
    failures.push("local auth adapter must not own bootstrap redirect policy")
  }

  for (const token of [
    'id: "@voyant-travel/auth-react#local-auth-routes"',
    "resolveLocalAuthRedirect",
    "AcceptInvitationPage",
    "RedeemInvitationPage",
    "ForgotPasswordPage",
    "ResetPasswordPage",
    "SignInPage",
    "SignUpPage",
    "VerifyEmailPage",
    "signInAfterRedeemFailed",
  ]) {
    if (!packageRoutes.includes(token)) failures.push(`package auth routes must contain ${token}`)
  }
  if (packageRoutes.includes('from "@/')) {
    failures.push("package auth routes must not import Operator starter aliases")
  }

  return { failures, hostLines }
}
