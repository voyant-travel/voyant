import { execFile } from "node:child_process"
import fs from "node:fs"
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
  if (arrayStart === -1) {
    throw new Error("npm pack did not return JSON output")
  }
  return JSON.parse(trimmed.slice(arrayStart))
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

  const expectedTargets = getPublishedTargets(pkg)
  if (expectedTargets.length === 0) return null
  const sourceFiles = new Set(listPackageFiles(packageDir))

  let stdout
  try {
    // --ignore-scripts skips prepack (= `pnpm run build` in every package). The
    // Build packages CI step already populated `dist/` for every workspace
    // package, so npm pack just needs to enumerate files, not rebuild them.
    const result = await execFileAsync(
      "npm",
      ["--cache", "/tmp/npm-cache", "pack", "--dry-run", "--json", "--ignore-scripts"],
      {
        cwd: packageDir,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      },
    )
    stdout = result.stdout
  } catch (error) {
    return {
      name: pkg.name,
      packageDir,
      problems: [`npm pack failed: ${error.stderr?.toString().trim() || error.message}`],
    }
  }

  let packInfo
  try {
    ;[packInfo] = getPackJson(stdout)
  } catch (error) {
    return {
      name: pkg.name,
      packageDir,
      problems: [`could not parse npm pack output: ${error.message}`],
    }
  }

  const tarballFiles = new Set(packInfo.files.map((file) => file.path))
  const missingTargets = expectedTargets.filter(
    (target) =>
      !matchesTarget(target, tarballFiles) &&
      !shouldIgnoreMissingWildcardTarget(target, sourceFiles),
  )
  const suspiciousFiles = packInfo.files
    .map((file) => file.path)
    .filter((filePath) => filePath.startsWith("dist/src/") || filePath.startsWith("dist/tests/"))

  if (missingTargets.length === 0 && suspiciousFiles.length === 0) return null

  const problems = []
  if (missingTargets.length > 0) {
    problems.push(`missing published targets: ${missingTargets.join(", ")}`)
  }
  if (suspiciousFiles.length > 0) {
    problems.push(`unexpected packaged build paths: ${suspiciousFiles.join(", ")}`)
  }

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
