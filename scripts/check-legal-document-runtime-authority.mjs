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
  "starters/operator/src/api/runtime/operator-runtime-adapter.ts",
  "packages/legal-node",
]) {
  if (existsSync(path.join(root, retiredPath))) violations.push(`${retiredPath} must stay deleted`)
}

const deploymentResources = read("packages/operator-runtime/src/deployment-resources.ts")
const legalManifest = JSON.parse(read("packages/legal/package.json") || "{}")
const contributor = read("packages/legal/src/runtime-contributor.ts")
const runtime = read("packages/legal/src/runtime.ts")
const productDistribution = JSON.parse(read("packages/operator-standard/package.json") || "{}")
const standardDistribution = read("packages/operator-standard/src/index.ts")

for (const token of [
  "loadLegalRuntime",
  "createOperatorLegalRuntime",
  "AUTO_GENERATE_CONTRACT_OPTIONS",
]) {
  if (deploymentResources.includes(token)) {
    violations.push(`deployment host retains Legal composition token ${token}`)
  }
}
if (deploymentResources.includes("@voyant-travel/legal/runtime")) {
  violations.push("deployment host must not load the Legal runtime")
}
if (
  legalManifest.voyant?.runtime?.export !== "createLegalRuntimePortContribution" ||
  legalManifest.voyant?.kind !== "module" ||
  !legalManifest.exports?.["./runtime-contributor"] ||
  legalManifest.exports?.["./standard-node"]
) {
  violations.push("Legal package must declare its standard Node runtime contributor")
}
for (const dependency of ["@voyant-travel/bookings", "@voyant-travel/operator-settings"]) {
  if (!legalManifest.dependencies?.[dependency]) {
    violations.push(`Legal package must declare ${dependency}`)
  }
}
for (const token of [
  "createLegalRuntime",
  "legalRuntimePort.id",
  "legalContractDocumentRuntimePort.id",
  "legalBookingContractSubscriberRuntimePort.id",
]) {
  if (!contributor.includes(token)) violations.push(`Legal contributor is missing ${token}`)
}
for (const token of [
  "buildContractVariableBindings",
  "createContractDocumentService",
  "resolveContractDocumentGenerator",
  "resolveBookingPiiService",
  "createBookingContractSubscriberHost",
]) {
  if (!runtime.includes(token)) violations.push(`Legal runtime is missing ${token}`)
}
if (!productDistribution.dependencies?.["@voyant-travel/legal"]) {
  violations.push("product distribution must supply @voyant-travel/legal")
}
if (!standardDistribution.includes('resolve: "@voyant-travel/legal"')) {
  violations.push("authored standard product BOM must select @voyant-travel/legal")
}

if (violations.length > 0) {
  console.error("Legal document runtime authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log("check-legal-document-runtime-authority: OK (Legal-owned standard Node runtime)")
