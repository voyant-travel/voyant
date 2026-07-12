import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const rootIndex = process.argv.indexOf("--root")
const root = path.resolve(rootIndex === -1 ? "." : process.argv[rootIndex + 1])
const violations = []
const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath)
  if (!existsSync(absolutePath)) {
    violations.push(`missing ${relativePath}`)
    return ""
  }
  return readFileSync(absolutePath, "utf8")
}

for (const retiredPath of [
  "starters/operator/src/api/runtime/contract-document-runtime.ts",
  "starters/operator/src/api/runtime/contract-document-variables.ts",
  "packages/legal/src/runtime-contributor.ts",
]) {
  if (existsSync(path.join(root, retiredPath))) violations.push(`${retiredPath} must stay deleted`)
}

const deploymentResources = read("starters/operator/src/api/runtime/deployment-resources.ts")
const operatorAdapter = read("starters/operator/src/api/runtime/operator-runtime-adapter.ts")
const legalManifest = JSON.parse(read("packages/legal/package.json") || "{}")
const adapterManifest = JSON.parse(read("packages/legal-node/package.json") || "{}")
const contributor = read("packages/legal-node/src/runtime-contributor.ts")
const standardRuntime = read("packages/legal-node/src/standard-node-runtime.ts")
const frameworkManifest = JSON.parse(read("packages/framework/package.json") || "{}")
const runtimeBom = JSON.parse(read("release.runtime-packages.generated.json") || "{}")

for (const token of [
  "loadLegalRuntime",
  "createOperatorLegalRuntime",
  "AUTO_GENERATE_CONTRACT_OPTIONS",
]) {
  if (deploymentResources.includes(token)) {
    violations.push(`deployment host retains Legal composition token ${token}`)
  }
}
if (deploymentResources.includes("@voyant-travel/legal-node")) {
  violations.push("deployment host must not name the Legal Node adapter")
}
if (!operatorAdapter.includes('import("@voyant-travel/legal-node/standard-node-runtime")')) {
  violations.push("Commerce bridge must forward to the package-owned Legal Node runtime")
}
if (legalManifest.voyant?.runtime || legalManifest.exports?.["./runtime-contributor"]) {
  violations.push("Legal domain package must not retain target runtime contributor metadata")
}
if (
  adapterManifest.voyant?.runtime?.export !== "createLegalNodeRuntimePortContribution" ||
  adapterManifest.voyant?.kind !== "library"
) {
  violations.push("Legal Node adapter must declare its target runtime contributor")
}
for (const dependency of [
  "@voyant-travel/bookings",
  "@voyant-travel/legal",
  "@voyant-travel/operator-settings",
]) {
  if (!adapterManifest.dependencies?.[dependency]) {
    violations.push(`Legal Node adapter must declare ${dependency}`)
  }
}
for (const token of [
  "createLegalStandardNodeRuntime",
  "legalRuntimePort.id",
  "legalContractDocumentRuntimePort.id",
  "legalBookingContractSubscriberRuntimePort.id",
]) {
  if (!contributor.includes(token)) violations.push(`Legal Node contributor is missing ${token}`)
}
for (const token of [
  "buildContractVariableBindings",
  "createContractDocumentService",
  "resolveContractDocumentGenerator",
  "resolveBookingPiiService",
  "createBookingContractSubscriberHost",
]) {
  if (!standardRuntime.includes(token)) violations.push(`Legal Node runtime is missing ${token}`)
}
if (!frameworkManifest.dependencies?.["@voyant-travel/legal-node"]) {
  violations.push("framework BOM must supply @voyant-travel/legal-node")
}
if (!runtimeBom.runtimePackages?.includes("@voyant-travel/legal-node")) {
  violations.push("standard Node runtime BOM must select @voyant-travel/legal-node")
}

if (violations.length > 0) {
  console.error("Legal document runtime authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log("check-legal-document-runtime-authority: OK (package-owned Legal Node runtime)")
