import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const cliPackageJsonPath = join(repoRoot, "packages", "cli", "package.json")
const args = parseArgs(process.argv.slice(2))
const version = resolveVersion(args.version)
const outDir = resolve(repoRoot, args.outDir ?? ".release/starters")
const starters = ["dmc", "operator"]
const skipNames = new Set([
  "node_modules",
  ".git",
  ".github",
  ".turbo",
  ".tanstack",
  "dist",
  ".wrangler",
  ".next",
  ".vite",
  "coverage",
  ".cache",
  ".env",
  ".env.local",
  ".dev.vars",
  ".dev.vars.local",
  ".DS_Store",
])

mkdirSync(outDir, { recursive: true })

for (const starter of starters) {
  const source = join(repoRoot, "templates", starter)
  if (!existsSync(source)) {
    throw new Error(`Missing starter template: ${source}`)
  }

  const stagingRoot = mkdtempSync(join(tmpdir(), `voyant-starter-${starter}-`))
  const stagingTemplate = join(stagingRoot, "template")

  try {
    cpSync(source, stagingTemplate, {
      recursive: true,
      force: true,
      filter: (src) => {
        const rel = src.slice(source.length).replace(/^[\\/]+/, "")
        if (!rel) return true
        const first = rel.split(/[\\/]/)[0]
        return !skipNames.has(first)
      },
    })

    const archivePath = join(outDir, assetFileName(starter, version))
    execFileSync("tar", ["-czf", archivePath, "-C", stagingTemplate, "."], {
      stdio: "inherit",
    })
    console.log(`Packaged ${starter}: ${archivePath}`)
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true })
  }
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
    }
  }
  return result
}

function readVersion(pkgPath) {
  const raw = readFileSync(pkgPath, "utf8")
  const pkg = JSON.parse(raw)
  return pkg.version
}

function resolveVersion(explicitVersion) {
  if (explicitVersion) {
    return explicitVersion
  }

  if (existsSync(cliPackageJsonPath)) {
    return readVersion(cliPackageJsonPath)
  }

  throw new Error(
    "Starter packaging no longer has an implicit repo-wide package version. Pass --version explicitly.",
  )
}
