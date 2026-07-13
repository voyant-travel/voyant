import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  AUTH_ROUTE_HOSTS,
  checkOperatorAuthPresentationAuthority,
} from "./lib/operator-auth-presentation-authority.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const routeRegistry = readFileSync(
  join(root, "packages/admin-host/src/standard-route-files.ts"),
  "utf8",
)
const routeHosts = Object.fromEntries(
  Object.keys(AUTH_ROUTE_HOSTS).map((file) => [
    file,
    routeRegistry.includes(`"(auth)/${file}"`)
      ? `createFileRoute operatorFrontend routes.localAuth.${AUTH_ROUTE_HOSTS[file]}`
      : undefined,
  ]),
)
const result = checkOperatorAuthPresentationAuthority({
  routeHosts,
  adapter: readFileSync(join(root, "packages/admin-host/src/standard-frontend.tsx"), "utf8"),
  packageRoutes: readFileSync(join(root, "packages/auth-react/src/local-auth-routes.tsx"), "utf8"),
})

if (result.failures.length > 0) {
  console.error(
    `Operator auth presentation authority check failed:\n- ${result.failures.join("\n- ")}`,
  )
  process.exit(1)
}

console.log(`Operator auth presentation authority: OK (${result.hostLines}/70 host lines)`)
