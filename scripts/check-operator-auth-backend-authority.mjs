import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const starterPath = "starters/operator/src/api/auth/handler.ts"
const retiredCookiePolicyPath = "starters/operator/src/api/auth/cookie-domain.ts"
const runtimePath = "packages/auth/src/node-runtime.ts"
const starter = existsSync(join(root, starterPath))
  ? readFileSync(join(root, starterPath), "utf8")
  : ""
const failures = []
const starterLines = starter.split("\n").length

if (starter && starterLines > 65) {
  failures.push(`${starterPath} grew to ${starterLines} lines; ratchet is 65`)
}

if (existsSync(join(root, retiredCookiePolicyPath))) {
  failures.push(`${retiredCookiePolicyPath} must stay deleted; cookie policy belongs to auth`)
}

for (const token of [
  "createBetterAuth(",
  "createCloudAdminAuthStart(",
  "revalidateVoyantCloudAdminAuthSession(",
  'auth.all("/auth/',
  'auth.get("/auth/',
  "CLOUD_BETTER_AUTH_ALLOWLIST",
]) {
  if (starter.includes(token)) {
    failures.push(`${starterPath} must not own package auth runtime token ${token}`)
  }
}

if (!existsSync(join(root, runtimePath))) {
  failures.push(`${runtimePath} is required`)
} else {
  const runtime = readFileSync(join(root, runtimePath), "utf8")
  for (const token of [
    "createOperatorAuthNodeRuntime",
    "buildBetterAuthCookieAdvancedOptions",
    "createBetterAuth(",
    "createCloudAdminAuthStart(",
    "revalidateVoyantCloudAdminAuthSession(",
    'auth.all("/auth/*"',
  ]) {
    if (!runtime.includes(token)) failures.push(`${runtimePath} must contain ${token}`)
  }
  for (const forbidden of ["starters/operator", 'from "@/']) {
    if (runtime.includes(forbidden)) {
      failures.push(`${runtimePath} must not depend on ${forbidden}`)
    }
  }
}

if (failures.length > 0) {
  console.error(`Operator auth backend authority check failed:\n- ${failures.join("\n- ")}`)
  process.exit(1)
}

console.log(`Operator auth backend authority: OK (${starterLines}/65 starter lines)`)
