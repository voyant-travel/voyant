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
const composition = readRequired(join(operatorRoot, "src/api/composition.ts"))
const adapter = readRequired(join(operatorRoot, "src/api/runtime/smartbill-subscriber-runtime.ts"))

if (operatorPackage.dependencies?.["@voyant-travel/plugin-smartbill"] !== "^0.138.0") {
  violations.push("operator must depend on @voyant-travel/plugin-smartbill ^0.138.0")
}
if (installedPackage.version !== "0.138.0") {
  violations.push("installed SmartBill package must resolve to 0.138.0")
}
if (
  installedPackage.voyant?.kind !== "plugin" ||
  installedPackage.voyant?.manifest !== "./voyant" ||
  !installedPackage.exports?.["./voyant"] ||
  !installedPackage.exports?.["./subscriber-runtime"]
) {
  violations.push(
    "SmartBill must advertise plugin metadata plus ./voyant and ./subscriber-runtime exports",
  )
}
if (!/resolve:\s*["']@voyant-travel\/plugin-smartbill["']/.test(config)) {
  violations.push("voyant.config.ts must directly select @voyant-travel/plugin-smartbill")
}
if (
  !composition.includes('"@voyant-travel/plugin-smartbill"') ||
  !composition.includes("registerOperatorSmartbillSubscriberRuntimeService")
) {
  violations.push("selected graph composition must bind the operator SmartBill runtime adapter")
}
if (
  !adapter.includes('from "@voyant-travel/plugin-smartbill/subscriber-runtime"') ||
  !adapter.includes("container.register(SMARTBILL_SUBSCRIBER_RUNTIME_KEY")
) {
  violations.push("operator adapter must register the SmartBill subscriber runtime service")
}
if (/eventBus\.subscribe|descriptor\.register/.test(`${app}\n${composition}\n${adapter}`)) {
  violations.push("Operator code must not own or register SmartBill subscriber descriptors")
}
if (/smartbillOperatorBundle|subscribers\/smartbill/.test(app)) {
  violations.push("operator app must not mount or import a SmartBill compatibility bundle")
}
for (const relativePath of [
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
  "check-operator-smartbill-authority: OK (package subscriber authority; operator service adapter only)",
)
