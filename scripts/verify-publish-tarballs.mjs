// Runs the general publish-tarball verifier, then repacks source-map-producing
// packages from the fresh dist output and verifies that every map is usable.

import { execFile, spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const rootDir = process.cwd()
const packageRoots = ["packages", "apps"].map((dir) => path.join(rootDir, dir))

function getPackageFilters(argv) {
  const packageNames = new Set()

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--package") {
      packageNames.add(argv[index + 1])
      index += 1
    } else if (arg.startsWith("--package=")) {
      packageNames.add(arg.slice("--package=".length))
    }
  }

  return packageNames
}

function findPackageDirs(dir) {
  if (fs.existsSync(path.join(dir, "package.json"))) return [dir]

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist",
    )
    .flatMap((entry) => findPackageDirs(path.join(dir, entry.name)))
}

function explicitlyEnablesSourceMaps(packageDir) {
  const configPath = path.join(packageDir, "tsconfig.build.json")
  if (!fs.existsSync(configPath)) return false

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
  return config.compilerOptions?.sourceMap === true
}

function resolvePackedSourceMapSource(mapPath, sourceRoot, source) {
  const rootedSource = sourceRoot ? path.posix.join(sourceRoot, source) : source
  if (path.posix.isAbsolute(rootedSource) || /^[a-z][a-z0-9+.-]*:/i.test(rootedSource)) {
    return null
  }

  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(mapPath), rootedSource))
  if (resolved === ".." || resolved.startsWith("../")) return null
  return resolved.replace(/^\.\//, "")
}

export function collectPackedSourceMapProblems(extractRoot, packInfo) {
  const problems = []
  const tarballFiles = new Set(packInfo.files.map((file) => file.path))
  const sourceMapFiles = packInfo.files
    .map((file) => file.path)
    .filter((filePath) => filePath.endsWith(".map"))

  for (const mapPath of sourceMapFiles) {
    let sourceMap
    try {
      sourceMap = JSON.parse(fs.readFileSync(path.join(extractRoot, mapPath), "utf8"))
    } catch (error) {
      problems.push(`${mapPath} is not a valid source map: ${error.message}`)
      continue
    }

    if (!Array.isArray(sourceMap.sources)) continue

    const missingSources = sourceMap.sources.filter((source, index) => {
      if (typeof sourceMap.sourcesContent?.[index] === "string") return false
      if (typeof source !== "string") return true

      const packedSource = resolvePackedSourceMapSource(mapPath, sourceMap.sourceRoot, source)
      return packedSource === null || !tarballFiles.has(packedSource)
    })

    if (missingSources.length > 0) {
      problems.push(
        `${mapPath} references unavailable sources without sourcesContent: ${missingSources.join(
          ", ",
        )}`,
      )
    }
  }

  return problems
}

function getPackJson(stdout) {
  const trimmed = stdout.trim()
  const arrayStart = trimmed.indexOf("[")
  const objectStart = trimmed.indexOf("{")
  const jsonStart =
    arrayStart === -1
      ? objectStart
      : objectStart === -1
        ? arrayStart
        : Math.min(arrayStart, objectStart)

  if (jsonStart === -1) throw new Error("pnpm pack did not return JSON output")
  const parsed = JSON.parse(trimmed.slice(jsonStart))
  return Array.isArray(parsed) ? parsed : [parsed]
}

async function runGeneralTarballVerifier(argv) {
  const child = spawn(process.execPath, ["scripts/verify-package-tarballs.mjs", ...argv], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
  })

  return new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`publish tarball verifier exited with signal ${signal}`))
      else resolve(code ?? 1)
    })
  })
}

async function inspectPackedSourceMaps(packageDir) {
  const packDestination = fs.mkdtempSync(path.join(os.tmpdir(), "voyant-sourcemap-pack-"))
  const extractDestination = fs.mkdtempSync(path.join(os.tmpdir(), "voyant-sourcemap-extract-"))

  try {
    const result = await execFileAsync(
      "pnpm",
      ["--config.ignore-scripts=true", "pack", "--json", "--pack-destination", packDestination],
      {
        cwd: packageDir,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        env: process.env,
      },
    )
    const [packInfo] = getPackJson(result.stdout)
    const tarballPath = path.join(packDestination, path.basename(packInfo.filename))
    await execFileAsync("tar", ["-xf", tarballPath, "-C", extractDestination], {
      maxBuffer: 64 * 1024 * 1024,
    })

    return collectPackedSourceMapProblems(path.join(extractDestination, "package"), packInfo)
  } finally {
    fs.rmSync(packDestination, { recursive: true, force: true })
    fs.rmSync(extractDestination, { recursive: true, force: true })
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const verifierExitCode = await runGeneralTarballVerifier(argv)
  if (verifierExitCode !== 0) {
    process.exitCode = verifierExitCode
    return
  }

  const packageFilters = getPackageFilters(argv)
  const packageDirs = packageRoots
    .filter((packageRoot) => fs.existsSync(packageRoot))
    .flatMap((packageRoot) => findPackageDirs(packageRoot))
    .filter(explicitlyEnablesSourceMaps)
    .filter((packageDir) => {
      if (packageFilters.size === 0) return true
      const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"))
      return packageFilters.has(pkg.name)
    })
    .sort()

  const failures = []
  for (const packageDir of packageDirs) {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"))
    try {
      const problems = await inspectPackedSourceMaps(packageDir)
      if (problems.length > 0) failures.push({ name: pkg.name, packageDir, problems })
    } catch (error) {
      failures.push({ name: pkg.name, packageDir, problems: [error.message] })
    }
  }

  if (failures.length > 0) {
    console.error("Packed source map verification failed:\n")
    for (const failure of failures) {
      console.error(`${failure.name} (${path.relative(rootDir, failure.packageDir)})`)
      for (const problem of failure.problems) console.error(`  - ${problem}`)
      console.error("")
    }
    process.exitCode = 1
    return
  }

  console.log(`Verified packed source maps for ${packageDirs.length} package directories.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main()
}
