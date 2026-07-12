import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const pathOption = (name, fallback) => {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value) throw new Error(`${name} requires a path`)
  return value
}
const operatorRoot = pathOption("--operator-root", join(ROOT, "starters/operator"))
const installedPackageRoot = pathOption(
  "--installed-package-root",
  join(operatorRoot, "node_modules/@voyant-travel/plugin-smartbill"),
)
const violations = []

function readRequired(path) {
  if (!existsSync(path)) throw new Error(`check-operator-smartbill-authority: missing ${path}`)
  return readFileSync(path, "utf8")
}

const operatorPackage = JSON.parse(readRequired(join(operatorRoot, "package.json")))
const installedPackage = JSON.parse(readRequired(join(installedPackageRoot, "package.json")))
const config = readRequired(join(operatorRoot, "voyant.config.ts"))
const app = readRequired(join(operatorRoot, "src/api/app.ts"))
const composition = readRequired(join(operatorRoot, "src/api/runtime/deployment-resources.ts"))
const nodeHost = readRequired(join(operatorRoot, "src/api/runtime/operator-runtime-adapter.ts"))

if (operatorPackage.dependencies?.["@voyant-travel/plugin-smartbill"] !== "^0.140.1") {
  violations.push("operator must depend on @voyant-travel/plugin-smartbill ^0.140.1")
}
if (installedPackage.version !== "0.140.1") {
  violations.push("installed SmartBill package must resolve to 0.140.1")
}
if (
  installedPackage.voyant?.kind !== "plugin" ||
  installedPackage.voyant?.manifest !== "./voyant" ||
  !installedPackage.exports?.["./voyant"] ||
  !installedPackage.exports?.["./graph-runtime"] ||
  !installedPackage.exports?.["./runtime-contributor"] ||
  installedPackage.voyant?.runtime?.entry !== "./runtime-contributor" ||
  !installedPackage.exports?.["./subscriber-runtime"]
) {
  violations.push(
    "SmartBill must advertise plugin metadata plus graph, contributor, and subscriber runtime exports",
  )
}
if (!/resolve:\s*["']@voyant-travel\/plugin-smartbill["']/.test(config)) {
  violations.push("voyant.config.ts must directly select @voyant-travel/plugin-smartbill")
}
if (
  composition.includes("createSmartbillRuntimePortContribution") ||
  composition.includes("smartbillRuntimeHostPort") ||
  !composition.includes("host: operatorSmartbillRuntimeHost") ||
  !composition.includes("createGeneratedGraphRuntimePorts")
) {
  violations.push(
    "generic Node composition must lower SmartBill through generated contributor metadata",
  )
}
if (
  !nodeHost.includes('from "@voyant-travel/plugin-smartbill/graph-runtime"') ||
  !nodeHost.includes("operatorSmartbillRuntimeHost: SmartbillRuntimeHost") ||
  !nodeHost.includes("createSmartbillSettlementPollers(resolveOperatorSmartbillConfig(bindings))")
) {
  violations.push("Node host must provide typed SmartBill dependencies and package-owned pollers")
}
if (/"@voyant-travel\/plugin-smartbill"\s*:/.test(composition)) {
  violations.push("Operator must not bind SmartBill behavior by package id")
}
if (/eventBus\.subscribe|descriptor\.register/.test(`${app}\n${composition}\n${nodeHost}`)) {
  violations.push("Operator code must not own or register SmartBill subscriber descriptors")
}
if (/smartbillOperatorBundle|subscribers\/smartbill/.test(app)) {
  violations.push("operator app must not mount or import a SmartBill compatibility bundle")
}
for (const relativePath of [
  "src/api/runtime/smartbill-subscriber-runtime.ts",
  "src/api/runtime/smartbill-subscriber-runtime.test.ts",
  "src/api/subscribers/smartbill-bundle.ts",
  "src/api/subscribers/smartbill.ts",
]) {
  if (existsSync(join(operatorRoot, relativePath)))
    violations.push(`${relativePath} must stay deleted`)
}

if (violations.length > 0) {
  console.error("Operator SmartBill authority check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

console.log(
  "check-operator-smartbill-authority: OK (typed Node host port; package runtime, subscribers, and pollers)",
)
