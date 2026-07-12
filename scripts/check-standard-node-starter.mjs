import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const root = argumentPath("--root") ?? scriptRoot
const suppliedStarterDir = argumentPath("--starter-dir")
const generatedRoot = suppliedStarterDir
  ? undefined
  : mkdtempSync(join(tmpdir(), "voyant-starter-gate-"))
const starterDir = suppliedStarterDir ?? join(generatedRoot, "starter")
const violations = []

try {
  if (!suppliedStarterDir) generateStandardStarter(root, generatedRoot, starterDir)
  inspectGeneratedStarter(starterDir)
  inspectRepositoryAuthority(root)

  if (violations.length > 0) {
    console.error("Standard Node starter acceptance check failed:")
    for (const violation of violations) console.error(`- ${violation}`)
    process.exitCode = 1
  } else {
    console.log(
      "check-standard-node-starter: OK (packaged: 4 authored files; checked-in: no database authority; generic Node bootstrap)",
    )
  }
} finally {
  if (generatedRoot) rmSync(generatedRoot, { recursive: true, force: true })
}

function generateStandardStarter(repoRoot, outputRoot, destination) {
  const version = "0.0.0-starter-acceptance"
  execFileSync(
    process.execPath,
    [join(repoRoot, "scripts/package-starters.mjs"), "--version", version, "--out-dir", outputRoot],
    { cwd: repoRoot, stdio: "pipe" },
  )
  const archive = join(outputRoot, `voyant-starter-operator-${version}.tar.gz`)
  mkdirSync(destination, { recursive: true })
  execFileSync("tar", ["-xzf", archive, "-C", destination], { stdio: "pipe" })
}

function inspectGeneratedStarter(starterRoot) {
  const expectedDirectories = [
    "src/admin",
    "src/api/admin",
    "src/api/public",
    "src/jobs",
    "src/links",
    "src/modules",
    "src/scripts",
    "src/subscribers",
    "src/workflows",
  ]
  const expectedFiles = [".env.example", "package.json", "src/scripts/seed.ts", "voyant.config.ts"]
  const actualFiles = walkFiles(starterRoot)

  if (actualFiles.join("\n") !== expectedFiles.join("\n")) {
    violations.push(
      `generated authored tree must contain exactly ${expectedFiles.length} files: ${expectedFiles.join(", ")}; found ${actualFiles.join(", ") || "none"}`,
    )
  }
  for (const directory of expectedDirectories) {
    if (!existsSync(join(starterRoot, directory))) {
      violations.push(`generated starter must expose optional project directory ${directory}`)
    }
  }

  for (const forbidden of ["migrations", "openapi"]) {
    if (existsSync(join(starterRoot, forbidden))) {
      violations.push(`generated starter must not contain package-owned ${forbidden}`)
    }
  }
  for (const directory of [
    "src/admin",
    "src/api/admin",
    "src/api/public",
    "src/jobs",
    "src/links",
    "src/modules",
    "src/subscribers",
    "src/workflows",
  ]) {
    if (
      existsSync(join(starterRoot, directory)) &&
      walkFiles(join(starterRoot, directory)).length > 0
    ) {
      violations.push(`generated project customization directory must start empty: ${directory}`)
    }
  }

  const configPath = join(starterRoot, "voyant.config.ts")
  if (!existsSync(configPath)) {
    violations.push("generated starter must contain voyant.config.ts")
  } else {
    inspectConfig(configPath)
  }

  const packageJsonPath = join(starterRoot, "package.json")
  if (!existsSync(packageJsonPath)) {
    violations.push("generated starter must contain package.json")
  } else {
    inspectPackageJson(packageJsonPath)
  }

  const envExamplePath = join(starterRoot, ".env.example")
  if (
    existsSync(envExamplePath) &&
    !/^DATABASE_URL=postgresql:\/\//m.test(readFileSync(envExamplePath, "utf8"))
  ) {
    violations.push("generated .env.example must declare DATABASE_URL")
  }

  const authoredSources = actualFiles
    .filter((path) => !["package.json", "voyant.config.ts"].includes(path))
    .map((path) => [path, readFileSync(join(starterRoot, path), "utf8")])
  for (const [path, source] of authoredSources) {
    if (/@voyant-travel\//.test(source)) {
      violations.push(`generated authored source must not name first-party packages: ${path}`)
    }
  }
}

function inspectConfig(configPath) {
  const configSource = readFileSync(configPath, "utf8")
  const expectedConfig = `import { defineConfig } from "@voyant-travel/framework/project"

export default defineConfig({
  deployment: {
    target: "node",
    providers: { database: "postgres" },
  },
})
`
  if (configSource !== expectedConfig) {
    for (const property of ["modules", "extensions", "plugins", "access", "meta"]) {
      if (new RegExp(`\\b${property}\\s*:`).test(configSource)) {
        violations.push(`generated config must not declare ${property}`)
      }
    }
    if (/\b(migrations|mode)\s*:/.test(configSource)) {
      violations.push("generated deployment must not contain migrations or legacy mode policy")
    }
    if (/\bresolve\s*:/.test(configSource)) {
      violations.push("generated config must not repeat standard product selections")
    }
    violations.push(
      "generated voyant.config.ts must match the minimal standard Node config snapshot",
    )
  }
  if (/smartbill/i.test(configSource)) {
    violations.push("generated config must not select or configure SmartBill by default")
  }
}

function inspectPackageJson(packageJsonPath) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
  if (packageJson.scripts?.start !== "voyant-operator start") {
    violations.push('generated starter must use the generic "voyant-operator start" Node bootstrap')
  }
  const firstPartyDependencies = Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  })
    .filter((name) => name.startsWith("@voyant-travel/"))
    .sort()
  const expectedDependencies = [
    "@voyant-travel/cli",
    "@voyant-travel/framework",
    "@voyant-travel/operator-runtime",
  ]
  if (firstPartyDependencies.join("\n") !== expectedDependencies.join("\n")) {
    violations.push(
      `generated starter dependencies must expose only CLI, framework, and generic Node runtime; found ${firstPartyDependencies.join(", ")}`,
    )
  }
  if (packageJson.dependencies?.["@voyant-travel/plugin-smartbill"]) {
    violations.push("generated starter must not install SmartBill by default")
  }
}

function inspectRepositoryAuthority(repoRoot) {
  if (existsSync(join(repoRoot, "packages/cli"))) {
    violations.push(
      "packages/cli must not exist; CLI implementation belongs to the separate voyant-travel/cli repository",
    )
  }

  for (const relativePath of [
    "starters/operator/drizzle.config.ts",
    "starters/operator/drizzle.deployment-migrations.config.ts",
    "starters/operator/drizzle.framework-bundle.config.ts",
    "starters/operator/drizzle.links.generated.ts",
    "starters/operator/drizzle.schemas.generated.ts",
    "starters/operator/migrations",
  ]) {
    if (existsSync(join(repoRoot, relativePath))) {
      violations.push(`checked-in starter must not own database artifact ${relativePath}`)
    }
  }

  for (const relativePath of [
    "starters/operator/src/api/lib/catalog-context.ts",
    "starters/operator/src/api/runtime/payment-config.ts",
    "starters/operator/src/api/runtime/booking-payment-policy-runtime.ts",
    "starters/operator/src/api/runtime/media-runtime.ts",
    "starters/operator/src/api/lib/db.ts",
    "starters/operator/src/api/lib/db.test.ts",
    "starters/operator/src/api/auth/cookie-domain.ts",
    "starters/operator/src/api/auth/cookie-domain.test.ts",
  ]) {
    if (existsSync(join(repoRoot, relativePath))) {
      violations.push(`checked-in starter authority must stay deleted: ${relativePath}`)
    }
  }

  const operatorRuntimePath = join(repoRoot, "packages/operator-runtime/src/index.ts")
  const deploymentArtifactsPath = join(repoRoot, "packages/framework/src/deployment-artifacts.ts")
  if (existsSync(operatorRuntimePath) && existsSync(deploymentArtifactsPath)) {
    const operatorRuntime = readFileSync(operatorRuntimePath, "utf8")
    const deploymentArtifacts = readFileSync(deploymentArtifactsPath, "utf8")
    if (!operatorRuntime.includes("runtimePorts: generated.createRuntimePorts({ primitives })")) {
      violations.push("packaged starter must boot real statically selected runtime ports")
    }
    if (operatorRuntime.includes("createVoyantGraphRuntimePortStubs")) {
      violations.push("packaged starter must not use fail-on-use runtime port stubs")
    }
    if (!deploymentArtifacts.includes("createRuntimePorts: createGeneratedGraphRuntimePorts")) {
      violations.push("generated project runtime must expose selected contributor composition")
    }
  }

  const distributionPath = join(repoRoot, "packages/framework/src/operator-distribution.ts")
  const configPath = join(repoRoot, "starters/operator/voyant.config.ts")
  if (existsSync(distributionPath) && existsSync(configPath)) {
    const distributionSource = readFileSync(distributionPath, "utf8")
    const configSource = readFileSync(configPath, "utf8")
    const standardSelections = [...distributionSource.matchAll(/resolve:\s*"([^"]+)"/g)].map(
      (match) => match[1],
    )
    for (const selection of standardSelections) {
      if (configSource.includes(`"${selection}"`)) {
        violations.push(`authored Operator config repeats standard selection ${selection}`)
      }
    }
  }

  if (existsSync(join(repoRoot, "packages/framework/src/composition-lazy.ts"))) {
    violations.push("framework composition-lazy.ts compatibility catalog must stay deleted")
  }
  const resourcesPath = join(repoRoot, "starters/operator/src/api/runtime/deployment-resources.ts")
  if (existsSync(resourcesPath)) {
    const resources = readFileSync(resourcesPath, "utf8")
    for (const symbol of [
      "operatorGraphRuntimeBindings",
      "deploymentLocalExtensions",
      "bindingsFromExtensionFactories",
    ]) {
      if (resources.includes(symbol)) {
        violations.push(`Operator compatibility binding symbol remains: ${symbol}`)
      }
    }
  }
  const artifactPaths = join(repoRoot, "packages/framework/src/project-artifact-paths.ts")
  if (
    existsSync(artifactPaths) &&
    !readFileSync(artifactPaths, "utf8").includes("product-bom.generated.json")
  ) {
    violations.push("project resolver must emit an inspectable product BOM expansion")
  }
}

function walkFiles(root) {
  if (!existsSync(root)) return []
  const files = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry)
      if (statSync(path).isDirectory()) visit(path)
      else files.push(relative(root, path))
    }
  }
  visit(root)
  return files.sort()
}

function argumentPath(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : undefined
}
