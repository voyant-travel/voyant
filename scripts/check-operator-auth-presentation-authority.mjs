import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  AUTH_ROUTE_HOSTS,
  checkOperatorAuthPresentationAuthority,
} from "./lib/operator-auth-presentation-authority.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const routeDirectory = join(root, "starters/operator/src/routes/(auth)")
const routeHosts = Object.fromEntries(
  Object.keys(AUTH_ROUTE_HOSTS).map((file) => [
    file,
    readFileSync(join(routeDirectory, file), "utf8"),
  ]),
)
const result = checkOperatorAuthPresentationAuthority({
  routeHosts,
  adapter: readFileSync(join(root, "starters/operator/src/lib/local-auth-bootstrap.ts"), "utf8"),
  packageRoutes: readFileSync(join(root, "packages/auth-react/src/local-auth-routes.tsx"), "utf8"),
})

if (result.failures.length > 0) {
  console.error(
    `Operator auth presentation authority check failed:\n- ${result.failures.join("\n- ")}`,
  )
  process.exit(1)
}

console.log(`Operator auth presentation authority: OK (${result.hostLines}/70 host lines)`)
