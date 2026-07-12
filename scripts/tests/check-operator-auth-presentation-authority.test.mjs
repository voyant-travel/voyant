import assert from "node:assert/strict"
import { test } from "node:test"
import {
  AUTH_ROUTE_HOSTS,
  checkOperatorAuthPresentationAuthority,
} from "../lib/operator-auth-presentation-authority.mjs"

const routeHosts = Object.fromEntries(
  Object.entries(AUTH_ROUTE_HOSTS).map(([file, routeKey]) => [
    file,
    `import { createFileRoute } from "@tanstack/react-router"\nimport { localAuthRouteContribution } from "@/lib/local-auth-bootstrap"\nexport const Route = createFileRoute("/fixture")(localAuthRouteContribution.routes.${routeKey})\n`,
  ]),
)
const adapter = [
  "createLocalAuthRouteContribution",
  "getCurrentUser",
  "getBootstrapStatus",
  "cloudAuthStartHref",
  "getInvitation",
  "redeemInvitation",
  "signInWithEmail",
  "signInWithSocial",
  "sendVerificationOtp",
].join("\n")
const packageRoutes = [
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
].join("\n")

test("accepts package authority with declarative generated route hosts", () => {
  assert.deepEqual(
    checkOperatorAuthPresentationAuthority({ routeHosts, adapter, packageRoutes }).failures,
    [],
  )
})

test("rejects presentation and bootstrap policy returning to the starter", () => {
  const result = checkOperatorAuthPresentationAuthority({
    routeHosts: {
      ...routeHosts,
      "sign-in.tsx": `${routeHosts["sign-in.tsx"]}\nfunction SignInPage() { useNavigate() }`,
    },
    adapter: `${adapter}\nresolveLocalAuthRedirect()`,
    packageRoutes,
  })

  assert(result.failures.some((failure) => failure.includes("sign-in.tsx must not own function")))
  assert(result.failures.includes("local auth adapter must not own bootstrap redirect policy"))
})
