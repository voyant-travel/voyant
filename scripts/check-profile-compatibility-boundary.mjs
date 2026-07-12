import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const violations = []

const graphNativeFiles = [
  "packages/framework/src/index.ts",
  "packages/framework/src/deployment-artifacts.ts",
  "packages/framework/src/deployment-graph.ts",
  "packages/framework/src/deployment-requirements.ts",
  "packages/framework/src/deployment-types.ts",
  "packages/framework/src/scheduled-jobs.ts",
  "packages/operator-runtime/src/index.ts",
  "packages/admin-host/src/index.ts",
  "packages/admin-host/src/serve.ts",
  "packages/admin-host/src/ssr.ts",
  "scripts/emit-deployment-graph.ts",
  "starters/operator/src/deployment-graph-artifacts.ts",
  "starters/operator/src/server.ts",
  "starters/operator/src/ssr-handler.ts",
]

const retiredTokens = [
  "ManagedProfile",
  "managed-profile",
  "managed profile",
  "profileSnapshot",
  "PROFILE_SNAPSHOT",
  "ProfileSnapshot",
]

for (const file of graphNativeFiles) {
  const source = readFileSync(resolve(root, file), "utf8")
  for (const token of retiredTokens) {
    if (source.includes(token)) violations.push(`${file}: contains retired token ${token}`)
  }
}

const deploymentArtifacts = read("packages/framework/src/deployment-artifacts.ts")
requireText(deploymentArtifacts, 'VoyantDeploymentRuntimeEntryKind = "node"', "node entry kind")
requireAbsent(deploymentArtifacts, "profileSnapshot", "deployment artifact snapshot field")

const emitter = read("scripts/emit-deployment-graph.ts")
requireAbsent(emitter, "profileOutput", "default profile output")
requireAbsent(emitter, "compatibilityManagedProfile", "default profile conversion")

const compatibilityFiles = [
  "packages/framework/src/profile.ts",
  "packages/framework/src/profile-types.ts",
  "packages/framework/src/managed-jobs.ts",
  "packages/framework/src/managed-profile-compatibility.ts",
  "packages/framework/src/managed-runtime.ts",
  "packages/admin-host/src/managed-profile-compatibility.ts",
]
for (const file of compatibilityFiles) {
  requireText(read(file), "deprecated", `${file} deprecation marker`)
}

if (violations.length > 0) {
  console.error("Profile compatibility boundary check failed:")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log("check-profile-compatibility-boundary: OK")

function read(file) {
  return readFileSync(resolve(root, file), "utf8")
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) violations.push(`missing ${label}: ${expected}`)
}

function requireAbsent(source, forbidden, label) {
  if (source.includes(forbidden)) violations.push(`found retired ${label}: ${forbidden}`)
}
