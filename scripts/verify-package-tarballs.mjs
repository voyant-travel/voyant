import { execFile } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const PACK_CONCURRENCY = Number(process.env.VOYANT_PACK_CONCURRENCY) || 8

const rootDir = process.cwd()
const packagesRoot = path.join(rootDir, "packages")

function findPackageDirs(dir) {
  const packageJsonPath = path.join(dir, "package.json")
  if (fs.existsSync(packageJsonPath)) {
    return [dir]
  }

  const dirs = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (entry.name === "node_modules" || entry.name === "dist") continue
    dirs.push(...findPackageDirs(path.join(dir, entry.name)))
  }
  return dirs
}

function listPackageFiles(dir, baseDir = dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listPackageFiles(fullPath, baseDir))
      continue
    }
    files.push(path.relative(baseDir, fullPath))
  }
  return files
}

function removeTsBuildInfoFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      removeTsBuildInfoFiles(fullPath)
      continue
    }
    if (entry.name.endsWith(".tsbuildinfo")) {
      fs.rmSync(fullPath, { force: true })
    }
  }
}

function stripDotSlash(value) {
  return value.replace(/^\.\//, "")
}

function matchesTarget(target, tarballFiles) {
  if (!target.includes("*")) {
    return tarballFiles.has(target)
  }

  const escaped = target.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, "[^/]+")
  const pattern = new RegExp(`^${escaped}$`)
  for (const file of tarballFiles) {
    if (pattern.test(file)) return true
  }
  return false
}

function sourcePatternForTarget(target) {
  return target
    .replace(/^dist\//, "src/")
    .replace(/\.d\.ts$/, ".ts")
    .replace(/\.js$/, ".ts")
}

function shouldIgnoreMissingWildcardTarget(target, sourceFiles) {
  if (!target.includes("*")) return false
  return !matchesTarget(sourcePatternForTarget(target), sourceFiles)
}

function collectExportTargets(value, targets) {
  if (!value) return
  if (typeof value === "string") {
    targets.add(stripDotSlash(value))
    return
  }
  if (typeof value !== "object") return
  for (const nestedValue of Object.values(value)) {
    collectExportTargets(nestedValue, targets)
  }
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

  if (jsonStart === -1) {
    throw new Error("npm pack did not return JSON output")
  }

  const parsed = JSON.parse(trimmed.slice(jsonStart))
  return Array.isArray(parsed) ? parsed : [parsed]
}

async function readPackedManifest(tarballPath) {
  const result = await execFileAsync("tar", ["-xOf", tarballPath, "package/package.json"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  })

  return JSON.parse(result.stdout)
}

async function readPackedFile(tarballPath, filePath) {
  const result = await execFileAsync("tar", ["-xOf", tarballPath, `package/${filePath}`], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })

  return result.stdout
}

function hasExplicitRuntimeExtension(specifier) {
  return /\.(?:c?js|mjs|json|css|wasm|svg|png|jpe?g|gif|webp)(?:[?#].*)?$/.test(specifier)
}

function collectExtensionlessRelativeSpecifiers(filePath, source) {
  const problems = []
  const pattern =
    /\b(?:import|export)\s+(?:[^'"]*?\s+from\s*)?(['"])(\.{1,2}\/[^'"]+)\1|import\s*\(\s*(['"])(\.{1,2}\/[^'"]+)\3\s*\)/g

  for (const match of source.matchAll(pattern)) {
    const specifier = match[2] ?? match[4]
    if (!specifier || hasExplicitRuntimeExtension(specifier)) continue

    const line = source.slice(0, match.index).split("\n").length
    problems.push(`${filePath}:${line} imports ${specifier}`)
  }

  return problems
}

async function collectPackedExtensionlessRelativeSpecifiers(tarballPath, packInfo) {
  const problems = []
  const jsFiles = packInfo.files
    .map((file) => file.path)
    .filter((filePath) => filePath.startsWith("dist/") && filePath.endsWith(".js"))

  for (const filePath of jsFiles) {
    const source = await readPackedFile(tarballPath, filePath)
    problems.push(...collectExtensionlessRelativeSpecifiers(filePath, source))
  }

  return problems
}

function collectWorkspaceProtocolDependencies(pkg) {
  const problems = []
  const dependencyFields = [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
    "devDependencies",
  ]

  for (const field of dependencyFields) {
    const dependencies = pkg[field]
    if (!dependencies || typeof dependencies !== "object") continue

    for (const [name, version] of Object.entries(dependencies)) {
      if (typeof version === "string" && version.startsWith("workspace:")) {
        problems.push(`${field}.${name}=${version}`)
      }
    }
  }

  return problems
}

function getPublishedTargets(pkg) {
  const targets = new Set()
  const publishedMain = pkg.publishConfig?.main ?? pkg.main
  const publishedTypes = pkg.publishConfig?.types ?? pkg.types
  const publishedExports = pkg.publishConfig?.exports ?? pkg.exports

  if (publishedMain) targets.add(stripDotSlash(publishedMain))
  if (publishedTypes) targets.add(stripDotSlash(publishedTypes))
  collectExportTargets(publishedExports, targets)

  if (typeof pkg.bin === "string") {
    targets.add(stripDotSlash(pkg.bin))
  } else if (pkg.bin && typeof pkg.bin === "object") {
    for (const value of Object.values(pkg.bin)) {
      if (typeof value === "string") {
        targets.add(stripDotSlash(value))
      }
    }
  }

  return [...targets].sort()
}

const packageDirs = findPackageDirs(packagesRoot).sort()

async function verifyPackage(packageDir) {
  const packageJsonPath = path.join(packageDir, "package.json")
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

  if (pkg.private) return null

  if (pkg.scripts?.clean) {
    try {
      await execFileAsync("pnpm", ["run", "clean"], {
        cwd: packageDir,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        env: process.env,
      })
    } catch (error) {
      return {
        name: pkg.name,
        packageDir,
        problems: [`pnpm run clean failed: ${error.stderr?.toString().trim() || error.message}`],
      }
    }
  }
  removeTsBuildInfoFiles(packageDir)

  if (pkg.scripts?.build) {
    try {
      await execFileAsync("pnpm", ["run", "build"], {
        cwd: packageDir,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        env: process.env,
      })
    } catch (error) {
      return {
        name: pkg.name,
        packageDir,
        problems: [`pnpm run build failed: ${error.stderr?.toString().trim() || error.message}`],
      }
    }
  }

  const sourceFiles = new Set(listPackageFiles(packageDir))
  const packDestination = fs.mkdtempSync(path.join(os.tmpdir(), "voyant-pack-"))

  let stdout
  let packInfo
  let packedManifest
  try {
    // npm pack does not apply pnpm's publish-time manifest rewrites, including
    // publishConfig exports and workspace: dependency replacement. The release
    // job publishes through pnpm, so verify the same lifecycle and packed
    // manifest consumers receive.
    const result = await execFileAsync(
      "pnpm",
      ["pack", "--json", "--pack-destination", packDestination],
      {
        cwd: packageDir,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        env: process.env,
      },
    )
    stdout = result.stdout
  } catch (error) {
    fs.rmSync(packDestination, { recursive: true, force: true })
    return {
      name: pkg.name,
      packageDir,
      problems: [`pnpm pack failed: ${error.stderr?.toString().trim() || error.message}`],
    }
  }

  let extensionlessRelativeSpecifiers = []
  try {
    ;[packInfo] = getPackJson(stdout)
    packedManifest = await readPackedManifest(packInfo.filename)
    extensionlessRelativeSpecifiers = await collectPackedExtensionlessRelativeSpecifiers(
      packInfo.filename,
      packInfo,
    )
  } catch (error) {
    fs.rmSync(packDestination, { recursive: true, force: true })
    return {
      name: pkg.name,
      packageDir,
      problems: [`could not parse pnpm pack output: ${error.message}`],
    }
  } finally {
    fs.rmSync(packDestination, { recursive: true, force: true })
  }

  const expectedTargets = getPublishedTargets(packedManifest)
  const tarballFiles = new Set(packInfo.files.map((file) => file.path))
  const missingTargets = expectedTargets.filter(
    (target) =>
      !matchesTarget(target, tarballFiles) &&
      !shouldIgnoreMissingWildcardTarget(target, sourceFiles),
  )
  const suspiciousFiles = packInfo.files
    .map((file) => file.path)
    .filter((filePath) => filePath.startsWith("dist/src/") || filePath.startsWith("dist/tests/"))

  const problems = []
  if (missingTargets.length > 0) {
    problems.push(`missing published targets: ${missingTargets.join(", ")}`)
  }
  if (extensionlessRelativeSpecifiers.length > 0) {
    problems.push(
      `extensionless relative ESM specifiers in dist files: ${extensionlessRelativeSpecifiers.join(
        ", ",
      )}`,
    )
  }
  const workspaceProtocolDependencies = collectWorkspaceProtocolDependencies(packedManifest)
  if (workspaceProtocolDependencies.length > 0) {
    problems.push(
      `packed manifest contains workspace protocol dependencies: ${workspaceProtocolDependencies.join(
        ", ",
      )}`,
    )
  }
  if (suspiciousFiles.length > 0) {
    problems.push(`unexpected packaged build paths: ${suspiciousFiles.join(", ")}`)
  }

  if (problems.length === 0) return null

  return { name: pkg.name, packageDir, problems }
}

const failures = []
const queue = [...packageDirs]
const workers = Array.from({ length: Math.min(PACK_CONCURRENCY, queue.length) }, async () => {
  while (queue.length > 0) {
    const packageDir = queue.shift()
    if (!packageDir) break
    const result = await verifyPackage(packageDir)
    if (result) failures.push(result)
  }
})
await Promise.all(workers)
failures.sort((left, right) => left.name.localeCompare(right.name))

if (failures.length > 0) {
  console.error("Publish tarball verification failed:\n")
  for (const failure of failures) {
    console.error(`${failure.name} (${path.relative(rootDir, failure.packageDir)})`)
    for (const problem of failure.problems) {
      console.error(`  - ${problem}`)
    }
    console.error("")
  }
  process.exit(1)
}

console.log(`Verified publish tarballs for ${packageDirs.length} package directories.`)
