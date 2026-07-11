#!/usr/bin/env node
/**
 * Cross-checks the resolved deployment graph's API bundles against the
 * committed operator OpenAPI documents.
 *
 * The graph is now the deploy-time source of API bundle declarations, while the
 * OpenAPI artifacts are the browsable/public contract. This checker keeps those
 * two views from drifting by requiring every graph API bundle to have at least
 * one documented path for its surface/module, unless the bundle is in the
 * temporary allowlist below.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import {
  buildDeploymentGraphOpenApiCoverageReport,
  formatDeploymentGraphOpenApiCoverageFailure,
} from "./lib/deployment-graph-openapi-coverage-report.mjs"

const DEFAULT_GRAPH = "starters/operator/.voyant/deployment-graph.generated.json"
const DEFAULT_OPENAPI_DIR = "starters/operator/openapi"
const CHECKED_SURFACES = new Set(["admin", "storefront"])
const HTTP_METHODS = new Set([
  "connect",
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
])

const DEFAULT_ALLOWLIST = new Map([
  [
    "@voyant-travel/public-document-delivery#api.public",
    "public document delivery routes are currently documented through the operator contract-document surface",
  ],
  [
    "@voyant-travel/flights#api",
    "flights declares a graph API bundle before committed operator OpenAPI paths are emitted for it",
  ],
  [
    "@voyant-travel/realtime#api.admin",
    "realtime admin routes are not yet emitted as a per-module OpenAPI document",
  ],
  [
    "@voyant-travel/realtime#api.public",
    "realtime public routes are not yet emitted as a storefront OpenAPI document",
  ],
  [
    "@voyant-travel/storage#api.admin.media",
    "storage media routes do not yet expose a package OpenAPI registry",
  ],
  [
    "@voyant-travel/storage#api.admin.uploads",
    "storage upload routes do not yet expose a package OpenAPI registry",
  ],
  [
    "@voyant-travel/storage#api.admin.video-upload-ticket",
    "storage video upload ticket routes do not yet expose a package OpenAPI registry",
  ],
  [
    "@voyant-travel/plugin-smartbill#api.admin",
    "SmartBill 0.138.0 publishes a plain Hono admin route and does not yet expose a package OpenAPI registry",
  ],
])

const repoRoot = process.cwd()
const options = parseArgs(process.argv.slice(2))
const allowlist = new Map(options.useDefaultAllowlist ? DEFAULT_ALLOWLIST : [])
for (const [id, reason] of readAllowlistFiles(options.allowlistFiles)) {
  allowlist.set(id, reason)
}

const graphPath = path.resolve(repoRoot, options.graph)
const openapiDir = path.resolve(repoRoot, options.openapiDir)

const graph = readJson(graphPath)
const docs = readOpenApiCoverage(openapiDir)
const bundles = readApiBundles(graph)
const failures = []
const coveredBundles = []
const allowlistedGaps = []

for (const bundle of bundles) {
  if (!CHECKED_SURFACES.has(bundle.surface)) continue

  const matched = bundle.candidateModules.some((module) =>
    docs.keys.has(coverageKey(bundle.surface, module)),
  )
  if (matched) {
    coveredBundles.push(bundle)
    if (allowlist.has(bundle.apiId)) {
      failures.push({ kind: "stale-allowlist", bundle })
    }
    continue
  }

  const reason = allowlist.get(bundle.apiId)
  if (reason) {
    allowlistedGaps.push({ bundle, reason })
  } else {
    failures.push({ kind: "missing-docs", bundle })
  }
}

for (const id of allowlist.keys()) {
  if (!bundles.some((bundle) => bundle.apiId === id)) {
    failures.push({ kind: "stale-allowlist", apiId: id })
  }
}

const report = buildDeploymentGraphOpenApiCoverageReport(
  { graph, graphPath, openapiDir, docs, coveredBundles, allowlistedGaps, failures },
  relativeToRepo,
)

if (options.json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.ok) process.exit(1)
  process.exit(0)
}

if (allowlistedGaps.length > 0) {
  console.warn("Deployment graph OpenAPI coverage warnings.")
  for (const gap of allowlistedGaps) console.warn(formatGap(gap.bundle, gap.reason))
}

if (failures.length > 0) {
  console.error("Deployment graph OpenAPI coverage failed.")
  console.error(
    `Checked graph ${relativeToRepo(graphPath)} against OpenAPI docs in ${relativeToRepo(openapiDir)}.\n`,
  )
  for (const failure of failures)
    console.error(formatDeploymentGraphOpenApiCoverageFailure(failure))
  process.exit(1)
}

console.log(
  `check-deployment-graph-openapi-coverage: OK (${coveredBundles.length} covered graph API bundles, ${allowlistedGaps.length} allowlisted gaps, ${docs.keys.size} documented surface/module pairs)`,
)

function readApiBundles(resolvedGraph) {
  const units = [...arrayOf(resolvedGraph.modules), ...arrayOf(resolvedGraph.plugins)]
  const bundles = []

  for (const unit of units) {
    for (const api of arrayOf(unit.api)) {
      if (!api || typeof api !== "object" || typeof api.id !== "string") continue
      const surface = normalizeSurface(api.surface)
      bundles.push({
        apiId: api.id,
        surface,
        graphSurface: api.surface,
        moduleId: stringOrEmpty(unit.id),
        localId: stringOrEmpty(unit.localId),
        packageName: stringOrEmpty(unit.packageName),
        mount: stringOrEmpty(api.mount),
        candidateModules: candidateModules(unit, api),
      })
    }
  }

  return bundles
}

function readOpenApiCoverage(openapiDirPath) {
  if (!existsSync(openapiDirPath) || !statSync(openapiDirPath).isDirectory()) {
    throw new Error(`${relativeToRepo(openapiDirPath)} is missing or is not a directory`)
  }

  const keys = new Set()
  const files = []
  for (const surfaceEntry of readdirSync(openapiDirPath, { withFileTypes: true })) {
    if (!surfaceEntry.isDirectory()) continue
    const fileSurface = normalizeSurface(surfaceEntry.name)
    if (!CHECKED_SURFACES.has(fileSurface)) continue
    const surfaceDir = path.join(openapiDirPath, surfaceEntry.name)
    for (const fileEntry of readdirSync(surfaceDir, { withFileTypes: true })) {
      if (!fileEntry.isFile() || !fileEntry.name.endsWith(".json")) continue
      const filePath = path.join(surfaceDir, fileEntry.name)
      const fileModule = fileEntry.name.replace(/\.json$/, "")
      const doc = readJson(filePath)
      const operations = documentedOperations(doc)
      if (operations.length === 0) continue

      let operationKeys = 0
      for (const operation of operations) {
        const operationSurface = normalizeSurface(operation["x-voyant-surface"] ?? fileSurface)
        const operationModule = operation["x-voyant-module"] ?? fileModule
        if (typeof operationModule !== "string" || operationModule.length === 0) continue
        keys.add(coverageKey(operationSurface, operationModule))
        operationKeys += 1
      }

      if (operationKeys === 0) keys.add(coverageKey(fileSurface, fileModule))
      files.push(relativeToRepo(filePath))
    }
  }

  return { files, keys }
}

function documentedOperations(doc) {
  const operations = []
  if (!doc || typeof doc !== "object" || !doc.paths || typeof doc.paths !== "object") {
    return operations
  }

  for (const pathItem of Object.values(doc.paths)) {
    if (!pathItem || typeof pathItem !== "object") continue
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue
      if (operation && typeof operation === "object") operations.push(operation)
    }
  }
  return operations
}

function candidateModules(unit, api) {
  const candidates = new Set()
  const unitId = stringOrEmpty(unit.id)
  const localId = stringOrEmpty(unit.localId)
  const packageName = stringOrEmpty(unit.packageName)
  const mount = stringOrEmpty(api.mount)
  const apiId = stringOrEmpty(api.id)

  addSlugCandidates(candidates, localId)
  addSlugCandidates(candidates, stripOperatorPrefix(localId))
  addSlugCandidates(candidates, localId.split(".").at(-1))
  addSlugCandidates(candidates, mount)
  addSlugCandidates(candidates, unitId)

  const packageSlug = packageName.replace(/^@voyant-travel\//, "")
  const fragment = graphFragment(unitId)
  const apiFragment = graphFragment(apiId)
    .replace(/^api\.?/, "")
    .replace(/\.?api(\.(admin|public|storefront))?$/, "")
  addSlugCandidates(candidates, packageSlug)
  addSlugCandidates(candidates, fragment)
  addSlugCandidates(candidates, apiFragment)
  if (packageSlug && fragment && fragment !== packageSlug) {
    addSlugCandidates(candidates, `${packageSlug}-${fragment}`)
    addSlugCandidates(candidates, `${singularFirstSegment(packageSlug)}-${fragment}`)
  }
  if (packageSlug && apiFragment && apiFragment !== packageSlug) {
    addSlugCandidates(candidates, `${packageSlug}-${apiFragment}`)
    addSlugCandidates(candidates, `${singularFirstSegment(packageSlug)}-${apiFragment}`)
  }

  return [...candidates].filter(Boolean)
}

function addSlugCandidates(candidates, value) {
  const slug = slugify(value)
  if (!slug) return
  candidates.add(slug)
  candidates.add(stripOperatorPrefix(slug))
  candidates.add(singularFirstSegment(slug))
}

function normalizeSurface(surface) {
  if (surface === "public") return "storefront"
  return String(surface ?? "").trim()
}

function coverageKey(surface, module) {
  return `${surface}:${module}`
}

function graphFragment(id) {
  const value = String(id ?? "")
  const index = value.indexOf("#")
  return index === -1 ? "" : value.slice(index + 1)
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@voyant-travel\//, "")
    .replace(/^operator[/.]/, "")
    .replace(/[/#.]/g, "-")
    .replace(/-api(?:-(?:admin|public|storefront))?$/, "")
    .replace(/^api-?/, "")
    .replace(/-(admin|public|storefront)$/, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
}

function stripOperatorPrefix(value) {
  return String(value ?? "").replace(/^operator[-./]/, "")
}

function singularFirstSegment(value) {
  const parts = String(value ?? "").split("-")
  if (parts.length <= 1) return value
  if (parts[0].endsWith("s")) parts[0] = parts[0].slice(0, -1)
  return parts.join("-")
}

function formatGap(bundle, allowlistReason) {
  const code = allowlistReason ? "allowlisted-gap" : "missing-docs"
  const suffix = allowlistReason ? ` Allowlist reason: ${allowlistReason}.` : ""
  return `  - [deployment-graph-openapi-coverage:${code}] ${bundle.apiId} (${bundle.graphSurface} -> ${bundle.surface}, ${bundle.localId || bundle.moduleId}) has no documented OpenAPI paths for candidates: ${bundle.candidateModules.join(", ")}.${suffix}`
}

function readAllowlistFiles(files) {
  const entries = []
  for (const file of files) {
    const allowlist = readJson(path.resolve(repoRoot, file))
    if (Array.isArray(allowlist)) {
      for (const item of allowlist) {
        if (typeof item === "string") entries.push([item, "external allowlist"])
        else if (item && typeof item.id === "string") {
          entries.push([item.id, stringOrEmpty(item.reason) || "external allowlist"])
        }
      }
      continue
    }
    if (allowlist && typeof allowlist === "object") {
      for (const [id, reason] of Object.entries(allowlist)) {
        entries.push([id, typeof reason === "string" ? reason : "external allowlist"])
      }
    }
  }
  return entries
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch (error) {
    throw new Error(`${relativeToRepo(filePath)} could not be read as JSON: ${error.message}`)
  }
}

function arrayOf(value) {
  return Array.isArray(value) ? value : []
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value : ""
}

function parseArgs(args) {
  const options = {
    graph: DEFAULT_GRAPH,
    openapiDir: DEFAULT_OPENAPI_DIR,
    allowlistFiles: [],
    useDefaultAllowlist: true,
    json: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/check-deployment-graph-openapi-coverage.mjs [options]

Options:
  --graph <path>            Resolved graph JSON path. Default: ${DEFAULT_GRAPH}
  --openapi-dir <path>      Directory containing openapi/<surface>/*.json. Default: ${DEFAULT_OPENAPI_DIR}
  --allowlist <path>        JSON object or array of { "id", "reason" } entries to merge.
  --json                    Emit the stable OpenAPI coverage report as JSON.
  --no-default-allowlist    Disable the repository's temporary allowlist, useful for fixture tests.`)
      process.exit(0)
    }
    if (arg === "--graph") {
      index += 1
      options.graph = requireValue(args, index, arg)
    } else if (arg === "--openapi-dir") {
      index += 1
      options.openapiDir = requireValue(args, index, arg)
    } else if (arg === "--allowlist") {
      index += 1
      options.allowlistFiles.push(requireValue(args, index, arg))
    } else if (arg === "--no-default-allowlist") {
      options.useDefaultAllowlist = false
    } else if (arg === "--json") {
      options.json = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function requireValue(args, index, flag) {
  const value = args[index]
  if (!value) throw new Error(`${flag} requires a value`)
  return value
}

function relativeToRepo(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/")
}
