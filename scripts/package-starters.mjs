import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const args = parseArgs(process.argv.slice(2))
const version = resolveVersion(args.version)
const outDir = resolve(repoRoot, args.outDir ?? ".release/starters")
const starters = ["operator"]
const standardNodeStarter = readJson(
  join(repoRoot, "packages", "framework", "src", "standard-node-starter.json"),
)

mkdirSync(outDir, { recursive: true })

for (const starter of starters) {
  const stagingRoot = mkdtempSync(join(tmpdir(), `voyant-starter-${starter}-`))
  const stagingTemplate = join(stagingRoot, "template")

  try {
    stageMinimalOperatorStarter(stagingTemplate, args.localLinks === true)

    const archivePath = join(outDir, assetFileName(starter, version))
    execFileSync("tar", ["-czf", archivePath, "-C", stagingTemplate, "."], {
      stdio: "inherit",
    })
    console.log(`Packaged ${starter}: ${archivePath}`)
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true })
  }
}

function stageMinimalOperatorStarter(stagingTemplate, localLinks) {
  mkdirSync(stagingTemplate, { recursive: true })
  for (const directory of standardNodeStarter.optionalDirectories) {
    mkdirSync(join(stagingTemplate, directory), { recursive: true })
  }

  const dependency = (name) =>
    localLinks && name.startsWith("@voyant-travel/")
      ? `link:${workspacePackageDirectory(name)}`
      : standardNodeStarter.runtimeDependencyCoordinates[name]
  const localCliPackage = resolve(repoRoot, "..", "cli", "packages", "cli")
  const cliDependency =
    localLinks && existsSync(join(localCliPackage, "package.json"))
      ? `link:${localCliPackage}`
      : standardNodeStarter.developmentDependencyCoordinates["@voyant-travel/cli"]
  writeJson(join(stagingTemplate, "package.json"), {
    name: "voyant-app",
    private: true,
    license: "Apache-2.0",
    type: "module",
    scripts: standardNodeStarter.packageScripts,
    dependencies: Object.fromEntries(
      standardNodeStarter.runtimeDependencies.map((name) => [name, dependency(name)]),
    ),
    devDependencies: Object.fromEntries(
      standardNodeStarter.developmentDependencies.map((name) => [
        name,
        name === "@voyant-travel/cli"
          ? cliDependency
          : standardNodeStarter.developmentDependencyCoordinates[name],
      ]),
    ),
  })
  writeFileSync(
    join(stagingTemplate, "voyant.config.ts"),
    `import { defineConfig } from "@voyant-travel/framework/project"

export default defineConfig({
  deployment: {
    target: "${standardNodeStarter.deploymentTarget}",
    providers: { database: "${standardNodeStarter.databaseProvider}" },
  },
})
`,
  )
  writeFileSync(
    join(stagingTemplate, ".gitignore"),
    `${standardNodeStarter.gitignoreEntries.join("\n")}\n`,
  )
  writeFileSync(
    join(stagingTemplate, ".env.example"),
    `DATABASE_URL=${["postgresql", "://postgres:postgres@localhost:5432/voyant"].join("")}\nPORT=8080\n`,
  )
  writeFileSync(
    join(stagingTemplate, "src/scripts/seed.ts"),
    'console.info("Add project seed data here.")\n',
  )
}

function workspacePackageDirectory(name) {
  for (const root of ["packages", join("packages", "plugins"), "apps"]) {
    const rootPath = join(repoRoot, root)
    if (!existsSync(rootPath)) continue
    for (const entry of readdirSync(rootPath)) {
      const directory = join(rootPath, entry)
      const packageJsonPath = join(directory, "package.json")
      if (!existsSync(packageJsonPath)) continue
      if (readJson(packageJsonPath).name === name) return directory
    }
  }
  throw new Error(`Missing workspace package directory for ${name}`)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function assetFileName(starter, version) {
  return `voyant-starter-${starter}-${version}.tar.gz`
}

function parseArgs(argv) {
  const result = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--out-dir") {
      result.outDir = argv[i + 1]
      i += 1
      continue
    }
    if (arg === "--version") {
      result.version = argv[i + 1]
      i += 1
      continue
    }
    if (arg === "--local-links") {
      result.localLinks = true
    }
  }
  return result
}

function resolveVersion(explicitVersion) {
  if (explicitVersion) return explicitVersion

  throw new Error(
    "Starter packaging requires the separately released @voyant-travel/cli version. Pass --version explicitly.",
  )
}
