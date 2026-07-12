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
  "packages/legal-node",
]) {
  if (existsSync(path.join(root, retiredPath))) violations.push(`${retiredPath} must stay deleted`)
}

const deploymentResources = read("starters/operator/src/api/runtime/deployment-resources.ts")
const operatorAdapter = read("starters/operator/src/api/runtime/operator-runtime-adapter.ts")
const legalManifest = JSON.parse(read("packages/legal/package.json") || "{}")
const contributor = read("packages/legal/src/runtime-contributor.ts")
const runtime = read("packages/legal/src/runtime.ts")
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
if (deploymentResources.includes("@voyant-travel/legal/runtime")) {
  violations.push("deployment host must not load the Legal runtime")
}
if (!operatorAdapter.includes('import("@voyant-travel/legal/runtime")')) {
  violations.push("Commerce bridge must forward to the package-owned Legal runtime")
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
if (!frameworkManifest.dependencies?.["@voyant-travel/legal"]) {
  violations.push("framework BOM must supply @voyant-travel/legal")
}
if (!runtimeBom.runtimePackages?.includes("@voyant-travel/legal")) {
  violations.push("standard Node runtime BOM must select @voyant-travel/legal")
}

if (violations.length > 0) {
  console.error("Legal document runtime authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log("check-legal-document-runtime-authority: OK (Legal-owned standard Node runtime)")
