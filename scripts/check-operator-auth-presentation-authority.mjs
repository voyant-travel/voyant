import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const failures = []
const routeDirectory = "starters/operator/src/routes/(auth)"
const starterFiles = [
  "accept-invitation.tsx",
  "accept-invite.tsx",
  "forgot-password.tsx",
  "onboarding.tsx",
  "reset-password.tsx",
  "route.tsx",
  "sign-in.tsx",
  "sign-up.tsx",
  "verify-email.tsx",
].map((file) => join(routeDirectory, file))
starterFiles.push("starters/operator/src/lib/local-auth-bootstrap.ts")

const starterLines = starterFiles.reduce((total, relativePath) => {
  const path = join(root, relativePath)
  if (!existsSync(path)) {
    failures.push(`${relativePath} is required`)
    return total
  }
  return total + readFileSync(path, "utf8").split("\n").length
}, 0)

const starterLineRatchet = 530
if (starterLines > starterLineRatchet) {
  failures.push(
    `operator auth presentation grew to ${starterLines} lines; ratchet is ${starterLineRatchet}`,
  )
}

const invitationRoute = readFileSync(join(root, routeDirectory, "accept-invite.tsx"), "utf8")
for (const forbidden of [
  "@voyant-travel/ui",
  "@voyant-travel/admin/lib/i18n",
  "lucide-react",
  "useState",
  "CardContent",
]) {
  if (invitationRoute.includes(forbidden)) {
    failures.push(`accept-invite.tsx must not own package presentation token ${forbidden}`)
  }
}

for (const [relativePath, requiredTokens] of new Map([
  [
    "packages/auth-react/src/components/redeem-invitation-page.tsx",
    ["RedeemInvitationPage", "RedeemInvitationStatus", "onRedeem"],
  ],
  [
    "packages/auth-react/src/local-auth-bootstrap.ts",
    ["resolveLocalAuthRedirect", 'route === "accept-invitation"', 'route === "sign-in"'],
  ],
  [
    "starters/operator/src/lib/local-auth-bootstrap.ts",
    ["resolveLocalAuthRedirect", "getCurrentUser", "getBootstrapStatus", "cloudAuthStartHref"],
  ],
])) {
  const path = join(root, relativePath)
  if (!existsSync(path)) {
    failures.push(`${relativePath} is required`)
    continue
  }
  const source = readFileSync(path, "utf8")
  for (const token of requiredTokens) {
    if (!source.includes(token)) failures.push(`${relativePath} must contain ${token}`)
  }
  if (relativePath.startsWith("packages/") && source.includes('from "@/')) {
    failures.push(`${relativePath} must not import Operator starter aliases`)
  }
}

for (const route of [
  "accept-invitation.tsx",
  "forgot-password.tsx",
  "reset-password.tsx",
  "sign-in.tsx",
  "sign-up.tsx",
  "verify-email.tsx",
]) {
  const source = readFileSync(join(root, routeDirectory, route), "utf8")
  if (!source.includes("getLocalAuthRedirect")) {
    failures.push(`${route} must delegate bootstrap policy to auth-react`)
  }
  if (source.includes("getBootstrapStatus") || source.includes("cloudAuthStartHref")) {
    failures.push(`${route} must not duplicate bootstrap policy`)
  }
}

if (failures.length > 0) {
  console.error(`Operator auth presentation authority check failed:\n- ${failures.join("\n- ")}`)
  process.exit(1)
}

console.log(
  `Operator auth presentation authority: OK (${starterLines}/${starterLineRatchet} starter lines)`,
)
