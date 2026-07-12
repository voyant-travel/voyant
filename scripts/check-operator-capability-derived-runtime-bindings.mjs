import { readFile } from "node:fs/promises"
import path from "node:path"

function argument(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const root = argument("--root", ".")
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8")
const [deploymentResources, auth, mice, quotes, relationships] = await Promise.all([
  read("starters/operator/src/api/runtime/deployment-resources.ts"),
  read("packages/auth/src/runtime-contributor.ts"),
  read("packages/mice/src/runtime-contributor.ts"),
  read("packages/quotes/src/runtime-contributor.ts"),
  read("packages/relationships/src/runtime-contributor.ts"),
])

const violations = []
const explicitBindings = ["identityAccess", "mice", "quotes", "relationshipsRoutes"]

for (const binding of explicitBindings) {
  if (new RegExp(`\\b${binding}\\s*:`).test(deploymentResources)) {
    violations.push(`deployment-resources.ts must not assemble the ${binding} binding`)
  }
}

if (!/createGeneratedGraphRuntimePorts\(\{\s*capabilities,/s.test(deploymentResources)) {
  violations.push("deployment-resources.ts must expose generic capabilities to contributors")
}
if (deploymentResources.includes("createOperatorIdentityAccessRuntime")) {
  violations.push("deployment-resources.ts must not retain the Auth runtime factory")
}

const contributorRequirements = [
  ["auth", auth, ["host.capabilities", "cloudAdminMembersConfigFromRevalidate", "auth.invitation"]],
  ["mice", mice, ["host.capabilities.relationshipsService", "resolveDelegatePersonById"]],
  ["quotes", quotes, ["createQuotesRuntime(host)"]],
  ["relationships", relationships, ["host.capabilities.customFields"]],
]

for (const [packageName, source, requirements] of contributorRequirements) {
  for (const requirement of requirements) {
    if (!source.includes(requirement)) {
      violations.push(`${packageName} runtime contributor must own ${requirement}`)
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    `check-operator-capability-derived-runtime-bindings:\n- ${violations.join("\n- ")}`,
  )
}

console.log(
  "check-operator-capability-derived-runtime-bindings: OK (4 package bindings derived from generic host capabilities)",
)
