// agent-quality: file-size exception -- owner: scripts; release tarball verification stays co-located because the pack, manifest, artifact, and export checks share one inspection flow.
// Verifies publish tarballs for public packages in the workspace package roots.
// By default every package is checked. Pass --package <name> one or more times
// to check only the packages that are about to be published.
//
// For each package this clean-builds (`pnpm run clean` + `.tsbuildinfo` removal
// + `pnpm run build`), then `pnpm pack`s and inspects the resulting tarball.
// The clean build is required so stale `dist` output from a prior compile
// cannot mask a regression — but it makes a local run noticeably slower than
// a normal `pnpm build`. Intended primarily for CI/release; bump
// VOYANT_PACK_CONCURRENCY when running on a beefier machine.
//
// Pass `--reuse-dist` (or set VOYANT_PACK_REUSE_DIST=1) to skip the per-package
// clean + build and pack against the existing dist on disk. Use this only when
// the caller has *just* produced fresh dist (e.g. CI's `pnpm build` step,
// which already runs through turbo with remote cache); locally the clean
// build is the safer default.

import { execFile } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"

import { packedFileExportsName } from "./lib/packed-exports.mjs"

const execFileAsync = promisify(execFile)
const PACK_CONCURRENCY = Number(process.env.VOYANT_PACK_CONCURRENCY) || 8
const REUSE_DIST =
  process.argv.includes("--reuse-dist") || process.env.VOYANT_PACK_REUSE_DIST === "1"
const PACKAGE_FILTERS = getPackageFilters(process.argv.slice(2))
const LEGACY_VOYANT_SCOPE = `@voyant${"js"}/`

const rootDir = process.cwd()
const packageRoots = ["packages", "apps"].map((dir) => path.join(rootDir, dir))
const financeContractsPaymentBodyExports = [
  "insertPaymentAuthorizationBodySchema",
  "insertPaymentSessionBodySchema",
  "insertSupplierInvoicePaymentBodySchema",
  "updatePaymentAuthorizationBodySchema",
  "updatePaymentSessionBodySchema",
]
const packedExportChecks = [
  {
    packageName: "@voyant-travel/workflows",
    entries: [
      {
        path: "dist/index.js",
        label: "root runtime",
        requiredExports: ["defineWorkflow"],
      },
      {
        path: "dist/index.d.ts",
        label: "root declaration",
        requiredExports: ["defineWorkflow"],
      },
    ],
  },
  {
    packageName: "@voyant-travel/finance-contracts",
    entries: [
      {
        path: "dist/validation-payments.js",
        label: "payment validation runtime",
        requiredExports: financeContractsPaymentBodyExports,
      },
      {
        path: "dist/validation-payments.d.ts",
        label: "payment validation declaration",
        requiredExports: financeContractsPaymentBodyExports,
      },
      {
        path: "dist/validation-shared.js",
        label: "shared validation runtime",
        requiredExports: ["paymentAuthorizationStatusSchema"],
      },
      {
        path: "dist/validation-shared.d.ts",
        label: "shared validation declaration",
        requiredExports: ["paymentAuthorizationStatusSchema"],
      },
    ],
  },
  {
    packageName: "@voyant-travel/inventory-react",
    entries: [
      {
        path: "dist/components/product-detail.js",
        label: "runtime",
        requiredExports: [
          "getProductMediaQueryOptions",
          "getProductDetailMediaQueryOptions",
          "getPricingCategoriesQueryOptions",
          "getProductDetailPricingCategoriesQueryOptions",
          "getProductOptionsQueryOptions",
          "getProductDetailProductOptionsQueryOptions",
        ],
      },
      {
        path: "dist/components/product-detail.d.ts",
        label: "declaration",
        requiredExports: [
          "getProductMediaQueryOptions",
          "getProductDetailMediaQueryOptions",
          "getPricingCategoriesQueryOptions",
          "getProductDetailPricingCategoriesQueryOptions",
          "getProductOptionsQueryOptions",
          "getProductDetailProductOptionsQueryOptions",
        ],
      },
    ],
  },
]

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

function getPackageFilters(argv) {
  const packageNames = new Set()

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--package") {
      packageNames.add(argv[index + 1])
      index += 1
      continue
    }

    if (arg.startsWith("--package=")) {
      packageNames.add(arg.slice("--package=".length))
    }
  }

  return packageNames
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

function packageExportHasTarget(exports, exportKey) {
  if (!exports || typeof exports !== "object") return false
  const targets = new Set()
  collectExportTargets(exports[exportKey], targets)
  return targets.size > 0
}

function packageRuntimeExportKey(packageName, entry) {
  if (entry.startsWith("./")) return entry
  if (entry === packageName) return "."
  if (entry.startsWith(`${packageName}/`)) return `./${entry.slice(packageName.length + 1)}`
  return null
}

function collectRuntimeEntries(value, entries, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return
  seen.add(value)

  if (typeof value.entry === "string" && typeof value.export === "string") {
    entries.add(value.entry)
  }

  for (const nestedValue of Object.values(value)) {
    collectRuntimeEntries(nestedValue, entries, seen)
  }
}

export function collectPackedManifestRuntimeExportProblems(packedManifest, manifestNamespace) {
  const packageName = packedManifest.name
  if (typeof packageName !== "string") return ["packed package manifest has no package name"]

  const runtimeEntries = new Set()
  const packageRuntime = packedManifest.voyant?.runtime
  if (
    packageRuntime &&
    typeof packageRuntime.entry === "string" &&
    typeof packageRuntime.export === "string"
  ) {
    runtimeEntries.add(packageRuntime.entry)
  }

  for (const exportedValue of Object.values(manifestNamespace ?? {})) {
    if (
      !exportedValue ||
      typeof exportedValue !== "object" ||
      typeof exportedValue.schemaVersion !== "string" ||
      !exportedValue.schemaVersion.startsWith("voyant.")
    ) {
      continue
    }
    collectRuntimeEntries(exportedValue, runtimeEntries)
  }

  return [...runtimeEntries].sort().flatMap((entry) => {
    const exportKey = packageRuntimeExportKey(packageName, entry)
    if (exportKey === null || packageExportHasTarget(packedManifest.exports, exportKey)) return []
    return [`runtime entry ${entry} is not exported as ${exportKey}`]
  })
}

function preferredRuntimeTarget(value) {
  if (typeof value === "string") return value
  if (!value || typeof value !== "object") return null

  for (const condition of ["import", "node", "default"]) {
    const target = preferredRuntimeTarget(value[condition])
    if (target) return target
  }
  for (const [condition, nestedValue] of Object.entries(value)) {
    if (condition === "types" || ["import", "node", "default"].includes(condition)) continue
    const target = preferredRuntimeTarget(nestedValue)
    if (target) return target
  }
  return null
}

async function loadPackedVoyantManifestNamespace(packageDir, packedManifest) {
  const manifestExport = packedManifest.voyant?.manifest
  if (typeof manifestExport !== "string") return {}

  const target = preferredRuntimeTarget(packedManifest.exports?.[manifestExport])
  if (!target?.startsWith("./")) {
    throw new Error(`${manifestExport} has no relative runtime export target`)
  }

  const targetPath = path.resolve(packageDir, target)
  const packageRoot = `${path.resolve(packageDir)}${path.sep}`
  if (!targetPath.startsWith(packageRoot)) {
    throw new Error(`${manifestExport} runtime export target escapes the package directory`)
  }

  return import(`${pathToFileURL(targetPath).href}?voyant-pack=${Date.now()}-${Math.random()}`)
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

// Extract the whole tarball once into a temp dir. Reading subsequent files
// via fs is dramatically cheaper than spawning a `tar -xOf` per file when
// scanning every published JS file.
async function extractTarball(tarballPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voyant-pack-extract-"))
  try {
    await execFileAsync("tar", ["-xf", tarballPath, "-C", dir], {
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true })
    throw error
  }
  return {
    root: path.join(dir, "package"),
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

async function cleanAndBuildPackage(packageDir, pkg) {
  if (pkg.scripts?.clean) {
    try {
      await execFileAsync("pnpm", ["run", "clean"], {
        cwd: packageDir,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        env: process.env,
      })
    } catch (error) {
      return `pnpm run clean failed: ${error.stderr?.toString().trim() || error.message}`
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
      return `pnpm run build failed: ${error.stderr?.toString().trim() || error.message}`
    }
  }

  return null
}

function hasExplicitRuntimeExtension(specifier) {
  return /\.(?:c?js|mjs|json|css|wasm|svg|png|jpe?g|gif|webp)(?:[?#].*)?$/.test(specifier)
}

function collectExtensionlessRelativeSpecifiers(filePath, source) {
  const problems = []
  // `\s*` (rather than `\s+`) before the quote is intentional: it covers the
  // rare but legal `import"./x"` / `export {x} from"./y"` shapes that omit
  // whitespace before the specifier (uncommon in TS-emitted output, but valid
  // ECMAScript and seen after some minifiers).
  const pattern =
    /\b(?:import|export)(?:\s+[^'"]*?\s+from)?\s*(['"])(\.{1,2}\/[^'"]+)\1|\bimport\s*\(\s*(['"])(\.{1,2}\/[^'"]+)\3\s*\)/g

  for (const match of source.matchAll(pattern)) {
    const specifier = match[2] ?? match[4]
    if (!specifier || hasExplicitRuntimeExtension(specifier)) continue

    const line = source.slice(0, match.index).split("\n").length
    problems.push(`${filePath}:${line} imports ${specifier}`)
  }

  return problems
}

function collectPackedExtensionlessRelativeSpecifiers(extractRoot, packInfo) {
  const problems = []
  const jsFiles = packInfo.files
    .map((file) => file.path)
    .filter((filePath) => filePath.startsWith("dist/") && filePath.endsWith(".js"))

  for (const filePath of jsFiles) {
    const source = fs.readFileSync(path.join(extractRoot, filePath), "utf8")
    problems.push(...collectExtensionlessRelativeSpecifiers(filePath, source))
  }

  return problems
}

function collectPackedLegacyVoyantSpecifiers(extractRoot, packInfo) {
  const problems = []
  const legacySpecifierPattern = new RegExp(`${LEGACY_VOYANT_SCOPE}[A-Za-z0-9._-]+`, "g")
  const scannedFiles = packInfo.files
    .map((file) => file.path)
    .filter(
      (filePath) =>
        filePath === "package.json" ||
        (filePath.startsWith("dist/") && /\.(?:c?js|mjs|d\.ts|d\.mts|d\.cts)$/.test(filePath)),
    )

  for (const filePath of scannedFiles) {
    const source = fs.readFileSync(path.join(extractRoot, filePath), "utf8")
    const matches = [...source.matchAll(legacySpecifierPattern)]
    if (matches.length === 0) continue

    const seen = new Set()
    for (const match of matches) {
      if (!match[0] || seen.has(match[0])) continue
      seen.add(match[0])
      const line = source.slice(0, match.index).split("\n").length
      problems.push(`${filePath}:${line} references ${match[0]}`)
    }
  }

  return problems
}

function collectPackedExportProblems(extractRoot, packageName) {
  const check = packedExportChecks.find((candidate) => candidate.packageName === packageName)
  if (!check) return []

  const problems = []
  for (const entry of check.entries) {
    const entryPath = path.join(extractRoot, entry.path)
    if (!fs.existsSync(entryPath)) {
      problems.push(`${entry.label} export file ${entry.path} is missing`)
      continue
    }

    const missingExports = entry.requiredExports.filter(
      (name) => !packedFileExportsName(extractRoot, entry.path, name),
    )

    if (missingExports.length > 0) {
      problems.push(
        `${entry.label} export file ${entry.path} is missing exports: ${missingExports.join(", ")}`,
      )
    }
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

async function packAndInspectPackage(packageDir) {
  const packDestination = fs.mkdtempSync(path.join(os.tmpdir(), "voyant-pack-"))

  let stdout
  let packInfo
  let packedManifest
  try {
    // npm pack does not apply pnpm's publish-time manifest rewrites, including
    // publishConfig exports and workspace: dependency replacement. The release
    // job publishes through pnpm, so verify the same lifecycle and packed
    // manifest consumers receive.
    //
    // When reusing dist, also skip lifecycle scripts: most packages declare a
    // `prepack` that runs `pnpm run build`, so without --config.ignore-scripts
    // every pack would silently re-tsc on top of the already-fresh dist.
    const packArgs = ["pack", "--json", "--pack-destination", packDestination]
    if (REUSE_DIST) packArgs.unshift("--config.ignore-scripts=true")
    const result = await execFileAsync("pnpm", packArgs, {
      cwd: packageDir,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: process.env,
    })
    stdout = result.stdout
  } catch (error) {
    fs.rmSync(packDestination, { recursive: true, force: true })
    return {
      error: `pnpm pack failed: ${error.stderr?.toString().trim() || error.message}`,
    }
  }

  let extensionlessRelativeSpecifiers = []
  let legacyVoyantSpecifiers = []
  let missingPackedExports = []
  let missingPackedManifestRuntimeExports = []
  let extracted
  try {
    ;[packInfo] = getPackJson(stdout)
    extracted = await extractTarball(packInfo.filename)
    packedManifest = JSON.parse(fs.readFileSync(path.join(extracted.root, "package.json"), "utf8"))
    extensionlessRelativeSpecifiers = collectPackedExtensionlessRelativeSpecifiers(
      extracted.root,
      packInfo,
    )
    legacyVoyantSpecifiers = collectPackedLegacyVoyantSpecifiers(extracted.root, packInfo)
    missingPackedExports = collectPackedExportProblems(extracted.root, packedManifest.name)
    const manifestNamespace = await loadPackedVoyantManifestNamespace(packageDir, packedManifest)
    missingPackedManifestRuntimeExports = collectPackedManifestRuntimeExportProblems(
      packedManifest,
      manifestNamespace,
    )
  } catch (error) {
    return { error: `could not parse pnpm pack output: ${error.message}` }
  } finally {
    extracted?.cleanup()
    fs.rmSync(packDestination, { recursive: true, force: true })
  }

  return {
    packInfo,
    packedManifest,
    extensionlessRelativeSpecifiers,
    legacyVoyantSpecifiers,
    missingPackedExports,
    missingPackedManifestRuntimeExports,
  }
}

function collectTarballProblems(
  {
    packInfo,
    packedManifest,
    extensionlessRelativeSpecifiers,
    legacyVoyantSpecifiers,
    missingPackedExports,
    missingPackedManifestRuntimeExports,
  },
  sourceFiles,
) {
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
  if (legacyVoyantSpecifiers.length > 0) {
    problems.push(
      `legacy Voyant package scope specifiers in packed artifacts: ${legacyVoyantSpecifiers.join(
        ", ",
      )}`,
    )
  }
  if (missingPackedExports.length > 0) {
    problems.push(`missing packed exports: ${missingPackedExports.join("; ")}`)
  }
  if (missingPackedManifestRuntimeExports.length > 0) {
    problems.push(
      `packed Voyant manifest references missing runtime exports: ${missingPackedManifestRuntimeExports.join(
        "; ",
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

  return { missingTargets, problems }
}

function shouldVerifyPackageDir(packageDir) {
  if (PACKAGE_FILTERS.size === 0) {
    return true
  }

  const packageJsonPath = path.join(packageDir, "package.json")
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

  return PACKAGE_FILTERS.has(pkg.name)
}

async function verifyPackage(packageDir) {
  const packageJsonPath = path.join(packageDir, "package.json")
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

  if (pkg.private) return null

  if (!REUSE_DIST) {
    const buildProblem = await cleanAndBuildPackage(packageDir, pkg)
    if (buildProblem) return { name: pkg.name, packageDir, problems: [buildProblem] }
  }

  const sourceFiles = new Set(listPackageFiles(packageDir))
  let inspection = await packAndInspectPackage(packageDir)
  if (inspection.error) {
    return {
      name: pkg.name,
      packageDir,
      problems: [inspection.error],
    }
  }

  let { missingTargets, problems } = collectTarballProblems(inspection, sourceFiles)

  if (REUSE_DIST && missingTargets.length > 0 && pkg.scripts?.build) {
    const buildProblem = await cleanAndBuildPackage(packageDir, pkg)
    if (buildProblem) return { name: pkg.name, packageDir, problems: [buildProblem] }

    inspection = await packAndInspectPackage(packageDir)
    if (inspection.error) {
      return {
        name: pkg.name,
        packageDir,
        problems: [inspection.error],
      }
    }
    ;({ problems } = collectTarballProblems(inspection, sourceFiles))
  }

  if (problems.length === 0) return null

  return { name: pkg.name, packageDir, problems }
}

async function main() {
  const packageDirs = packageRoots
    .filter((packageRoot) => fs.existsSync(packageRoot))
    .flatMap((packageRoot) => findPackageDirs(packageRoot))
    .filter(shouldVerifyPackageDir)
    .sort()

  if (PACKAGE_FILTERS.size > 0) {
    const foundPackageNames = new Set(
      packageDirs.map((packageDir) => {
        const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"))
        return pkg.name
      }),
    )
    const missingPackageNames = [...PACKAGE_FILTERS].filter((packageName) => {
      if (!packageName.startsWith("@voyant-travel/")) return false
      return !foundPackageNames.has(packageName)
    })

    if (missingPackageNames.length > 0) {
      console.error(`No package directories found for: ${missingPackageNames.join(", ")}`)
      process.exitCode = 1
      return
    }
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
    process.exitCode = 1
    return
  }

  console.log(`Verified publish tarballs for ${packageDirs.length} package directories.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main()
}
