import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const rootFlagIndex = process.argv.indexOf("--root")
const root =
  rootFlagIndex >= 0 && process.argv[rootFlagIndex + 1]
    ? resolve(process.argv[rootFlagIndex + 1])
    : scriptRoot
const configPath = join(root, "starters/operator/voyant.config.ts")
const configSource = readFileSync(configPath, "utf8")
const configFile = ts.createSourceFile(configPath, configSource, ts.ScriptTarget.Latest, true)
const violations = []

const config = findDefineConfigObject(configFile)
if (!config) {
  violations.push("starters/operator/voyant.config.ts must default-export defineConfig({...})")
} else {
  rejectProperties(config, ["modules", "extensions", "access", "meta"], "authored config")
  const deployment = objectProperty(config, "deployment")
  if (!deployment) {
    violations.push("authored config must explicitly select the Node deployment target")
  } else {
    rejectProperties(deployment, ["mode"], "deployment differences")
    const target = stringProperty(deployment, "target")
    if (target !== "node") violations.push('deployment.target must be "node"')
    const providers = objectProperty(deployment, "providers")
    const providerKeys = providers ? propertyNames(providers) : []
    if (providerKeys.join(",") !== "database") {
      violations.push("authored deployment providers must contain only the database deviation")
    }
  }
}

const distributionSource = readFileSync(
  join(root, "packages/framework/src/operator-distribution.ts"),
  "utf8",
)
const standardSelections = [...distributionSource.matchAll(/resolve:\s*"([^"]+)"/g)].map(
  (match) => match[1],
)
for (const selection of standardSelections) {
  if (configSource.includes(`"${selection}"`)) {
    violations.push(`authored config repeats standard selection ${selection}`)
  }
}

const frameworkComposition = readFileSync(
  join(root, "packages/framework/src/composition-lazy.ts"),
  "utf8",
)
if (frameworkComposition.split(/\r?\n/).length > 532) {
  violations.push("composition-lazy.ts compatibility catalog grew beyond its ratchet")
}

const operatorComposition = readFileSync(
  join(root, "starters/operator/src/api/composition.ts"),
  "utf8",
)
const bindingsBody = operatorComposition.match(
  /export const operatorGraphRuntimeBindings[\s\S]*?=\s*\{([\s\S]*?)\n\}/,
)?.[1]
const bindingIds = bindingsBody
  ? [...bindingsBody.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1])
  : []
if (bindingIds.length > 0) {
  violations.push(`Operator package-specific runtime bindings remain: ${bindingIds.join(", ")}`)
}

if (
  !readFileSync(join(root, "packages/framework/src/project-artifact-paths.ts"), "utf8").includes(
    "product-bom.generated.json",
  )
) {
  violations.push("project resolver must emit an inspectable product BOM expansion")
}

if (violations.length > 0) {
  console.error("Standard Node starter authority check failed:")
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(
  `check-standard-node-starter: OK (${standardSelections.length} standard selections hidden, no package bridges)`,
)

function findDefineConfigObject(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isExportAssignment(statement) || !ts.isCallExpression(statement.expression)) continue
    const call = statement.expression
    if (!ts.isIdentifier(call.expression) || call.expression.text !== "defineConfig") continue
    const [argument] = call.arguments
    if (argument && ts.isObjectLiteralExpression(argument)) return argument
  }
}

function propertyNames(object) {
  return object.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property) || !property.name) return []
    return [property.name.getText(configFile).replaceAll(/["']/g, "")]
  })
}

function rejectProperties(object, names, label) {
  const present = propertyNames(object).filter((name) => names.includes(name))
  if (present.length > 0) violations.push(`${label} must not declare ${present.join(", ")}`)
}

function objectProperty(object, name) {
  const property = object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      candidate.name.getText(configFile).replaceAll(/["']/g, "") === name,
  )
  return property && ts.isObjectLiteralExpression(property.initializer)
    ? property.initializer
    : undefined
}

function stringProperty(object, name) {
  const property = object.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      candidate.name.getText(configFile).replaceAll(/["']/g, "") === name,
  )
  return property && ts.isStringLiteral(property.initializer)
    ? property.initializer.text
    : undefined
}
