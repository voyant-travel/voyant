#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"

const repoRoot = process.cwd()

const retailSpineRoots = [
  {
    area: "Catalog",
    packages: ["@voyantjs/catalog", "@voyantjs/catalog-react"],
  },
  {
    area: "Commerce candidates",
    packages: [
      "@voyantjs/markets",
      "@voyantjs/markets-react",
      "@voyantjs/pricing",
      "@voyantjs/pricing-react",
      "@voyantjs/promotions",
      "@voyantjs/promotions-react",
      "@voyantjs/sellability",
      "@voyantjs/sellability-react",
    ],
  },
  {
    area: "Bookings",
    packages: [
      "@voyantjs/bookings",
      "@voyantjs/bookings-react",
      "@voyantjs/booking-requirements",
      "@voyantjs/booking-requirements-react",
    ],
  },
  {
    area: "Finance",
    packages: [
      "@voyantjs/finance",
      "@voyantjs/finance-react",
      "@voyantjs/checkout",
      "@voyantjs/checkout-react",
    ],
  },
  {
    area: "Distribution",
    packages: ["@voyantjs/distribution", "@voyantjs/distribution-react"],
  },
  {
    area: "Storefront",
    packages: [
      "@voyantjs/storefront",
      "@voyantjs/storefront-react",
      "@voyantjs/storefront-sdk",
      "@voyantjs/storefront-verification",
    ],
  },
  {
    area: "Admin surfaces",
    packages: ["@voyantjs/admin", "@voyantjs/admin-app", "@voyantjs/admin-react"],
  },
]

const forbiddenPackages = new Map([
  ["@voyantjs/inventory", "operated Inventory authoring runtime"],
  ["@voyantjs/inventory-react", "operated Inventory authoring UI"],
  ["@voyantjs/products", "operated Inventory authoring runtime"],
  ["@voyantjs/products-react", "operated Inventory authoring UI"],
  ["@voyantjs/availability", "operated Availability/Operations runtime"],
  ["@voyantjs/availability-react", "operated Availability/Operations UI"],
  ["@voyantjs/resources", "operated Operations runtime"],
  ["@voyantjs/resources-react", "operated Operations UI"],
  ["@voyantjs/ground", "operated Operations runtime"],
  ["@voyantjs/ground-react", "operated Operations UI"],
  ["@voyantjs/facilities", "operated Operations place/facility schema"],
  ["@voyantjs/facilities-react", "operated Operations place/facility UI"],
  ["@voyantjs/allocation-ui", "operated Availability allocation UI"],
  ["@voyantjs/crm", "Relationships/Quotes package pending v1 split"],
  ["@voyantjs/crm-react", "Relationships/Quotes UI pending v1 split"],
  ["@voyantjs/transactions", "retired runtime Transactions package"],
  ["@voyantjs/transactions-react", "retired runtime Transactions UI"],
])

const optionalEdgeAllowlist = [
  {
    from: "@voyantjs/catalog-react",
    type: "peerDependencies",
    to: "@voyantjs/products-react",
    reason: "catalog admin components can attach operated Inventory UI when a host installs it",
  },
  {
    from: "@voyantjs/pricing-react",
    type: "peerDependencies",
    to: "@voyantjs/products-react",
    reason:
      "pricing admin components can attach operated Inventory pickers when a host installs them",
  },
  {
    from: "@voyantjs/sellability-react",
    type: "peerDependencies",
    to: "@voyantjs/products-react",
    reason:
      "sellability admin components can attach operated Inventory pickers when a host installs them",
  },
  {
    from: "@voyantjs/bookings-react",
    type: "peerDependencies",
    to: "@voyantjs/availability-react",
    reason:
      "booking admin components can attach operated availability controls when a host installs them",
  },
  {
    from: "@voyantjs/bookings-react",
    type: "peerDependencies",
    to: "@voyantjs/products-react",
    reason:
      "booking admin components can attach operated Inventory summaries when a host installs them",
  },
  {
    from: "@voyantjs/finance-react",
    type: "peerDependencies",
    to: "@voyantjs/availability-react",
    reason:
      "finance admin components can attach operated availability context when a host installs it",
  },
  {
    from: "@voyantjs/finance-react",
    type: "peerDependencies",
    to: "@voyantjs/products-react",
    reason:
      "finance admin components can attach operated Inventory context when a host installs it",
  },
  {
    from: "@voyantjs/admin-app",
    type: "peerDependencies",
    to: "@voyantjs/products-react",
    reason:
      "the packaged admin shell can mount operated Inventory extensions when a host installs them",
  },
]

const dependencyGroups = [
  { type: "dependencies", runtime: true },
  { type: "peerDependencies", runtime: true },
  { type: "optionalDependencies", runtime: true, optional: true },
  { type: "devDependencies", runtime: false },
]

const skipDirs = new Set([".git", ".turbo", ".vite", "coverage", "dist", "node_modules"])

function findPackageJsonFiles(dir) {
  const files = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findPackageJsonFiles(fullPath))
      continue
    }

    if (entry.name === "package.json") {
      files.push(fullPath)
    }
  }

  return files
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function edgeKey(edge) {
  return `${edge.from}\n${edge.type}\n${edge.to}`
}

function formatEdge(edge) {
  const relativePath = path.relative(repoRoot, edge.packageJsonPath)
  const optional = edge.optional ? " optional" : ""
  return `${relativePath}: ${edge.from} --${edge.type}${optional}--> ${edge.to}`
}

function formatPath(packagePath) {
  return packagePath.join(" -> ")
}

function packageEdges(pkgRecord) {
  const { pkg } = pkgRecord
  const edges = []

  for (const group of dependencyGroups) {
    const deps = pkg[group.type]
    if (!deps || typeof deps !== "object") continue

    for (const depName of Object.keys(deps).sort()) {
      const peerMeta = pkg.peerDependenciesMeta?.[depName]
      const optional =
        group.optional === true ||
        (group.type === "peerDependencies" && peerMeta?.optional === true)

      edges.push({
        from: pkg.name,
        to: depName,
        type: group.type,
        runtime: group.runtime,
        optional,
        packageJsonPath: pkgRecord.packageJsonPath,
      })
    }
  }

  const requiredSchemas = pkg.voyant?.requiresSchemas
  if (Array.isArray(requiredSchemas)) {
    for (const depName of [...requiredSchemas].sort()) {
      edges.push({
        from: pkg.name,
        to: depName,
        type: "voyant.requiresSchemas",
        runtime: true,
        optional: false,
        packageJsonPath: pkgRecord.packageJsonPath,
      })
    }
  }

  return edges
}

const packageJsonFiles = findPackageJsonFiles(repoRoot)
const workspacePackages = new Map()

for (const packageJsonPath of packageJsonFiles) {
  const pkg = readJson(packageJsonPath)
  if (typeof pkg.name !== "string") continue
  if (!pkg.name.startsWith("@voyantjs/")) continue

  workspacePackages.set(pkg.name, {
    pkg,
    packageJsonPath,
  })
}

const rootPackages = retailSpineRoots.flatMap((root) => root.packages)
const missingRoots = rootPackages.filter((pkgName) => !workspacePackages.has(pkgName))
const allowlistByKey = new Map(optionalEdgeAllowlist.map((entry) => [edgeKey(entry), entry]))
const matchedAllowlistKeys = new Set()

const closure = new Set()
const packagePaths = new Map()
const queue = []
const hardBlockers = []
const unallowlistedOptionalEdges = []
const allowedOptionalEdges = []
const ignoredForbiddenDevEdges = []

for (const pkgName of rootPackages) {
  if (!workspacePackages.has(pkgName)) continue
  if (closure.has(pkgName)) continue

  closure.add(pkgName)
  packagePaths.set(pkgName, [pkgName])
  queue.push(pkgName)
}

for (let index = 0; index < queue.length; index += 1) {
  const pkgName = queue[index]
  const pkgRecord = workspacePackages.get(pkgName)
  const currentPath = packagePaths.get(pkgName) ?? [pkgName]

  for (const edge of packageEdges(pkgRecord)) {
    if (!edge.to.startsWith("@voyantjs/")) continue

    const isForbidden = forbiddenPackages.has(edge.to)
    const isWorkspacePackage = workspacePackages.has(edge.to)
    const isAllowedOptionalEdge =
      edge.runtime && edge.optional && isForbidden && allowlistByKey.has(edgeKey(edge))

    if (isAllowedOptionalEdge) {
      matchedAllowlistKeys.add(edgeKey(edge))
      allowedOptionalEdges.push({
        edge,
        reason: allowlistByKey.get(edgeKey(edge)).reason,
        packagePath: currentPath,
      })
      continue
    }

    if (edge.runtime && edge.optional && isForbidden) {
      unallowlistedOptionalEdges.push({
        edge,
        reason: forbiddenPackages.get(edge.to),
        packagePath: currentPath,
      })
      continue
    }

    if (edge.runtime && edge.optional) continue

    if (!edge.runtime) {
      if (isForbidden) {
        ignoredForbiddenDevEdges.push({
          edge,
          reason: forbiddenPackages.get(edge.to),
          packagePath: currentPath,
        })
      }
      continue
    }

    if (isForbidden) {
      hardBlockers.push({
        edge,
        reason: forbiddenPackages.get(edge.to),
        packagePath: currentPath,
      })
      continue
    }

    if (!isWorkspacePackage) continue
    if (closure.has(edge.to)) continue

    closure.add(edge.to)
    packagePaths.set(edge.to, [...currentPath, edge.to])
    queue.push(edge.to)
  }
}

const staleAllowlistEntries = optionalEdgeAllowlist.filter(
  (entry) => !matchedAllowlistKeys.has(edgeKey(entry)),
)

const hasFailures =
  missingRoots.length > 0 ||
  hardBlockers.length > 0 ||
  unallowlistedOptionalEdges.length > 0 ||
  staleAllowlistEntries.length > 0

const report = [
  "Retail spine package closure gate",
  "",
  `Roots: ${rootPackages.length} packages across ${retailSpineRoots.length} areas`,
  `Hard runtime closure: ${closure.size} workspace packages`,
  "",
]

function appendSection(title, lines) {
  if (lines.length === 0) {
    return
  }
  report.push(title, ...lines, "")
}

appendSection(
  "Missing configured root packages:",
  missingRoots.map((pkgName) => `  - ${pkgName}`),
)

appendSection(
  "Forbidden hard runtime edges:",
  hardBlockers.flatMap((blocker) => [
    `  - ${formatEdge(blocker.edge)}`,
    `    closure path: ${formatPath(blocker.packagePath)}`,
    `    reason: ${blocker.reason}`,
  ]),
)

appendSection(
  "Forbidden optional runtime edges missing an edge allowlist entry:",
  unallowlistedOptionalEdges.flatMap((blocker) => [
    `  - ${formatEdge(blocker.edge)}`,
    `    closure path: ${formatPath(blocker.packagePath)}`,
    `    reason: ${blocker.reason}`,
  ]),
)

appendSection(
  "Stale optional edge allowlist entries:",
  staleAllowlistEntries.flatMap((entry) => [
    `  - ${entry.from} --${entry.type} optional--> ${entry.to}`,
    `    reason: ${entry.reason}`,
  ]),
)

appendSection(
  "Allowlisted optional edges:",
  allowedOptionalEdges.flatMap((allowed) => [
    `  - ${formatEdge(allowed.edge)}`,
    `    closure path: ${formatPath(allowed.packagePath)}`,
    `    allowlist: ${allowed.reason}`,
  ]),
)

appendSection(
  "Ignored dev/test/type-only edges to forbidden packages:",
  ignoredForbiddenDevEdges.flatMap((ignored) => [
    `  - ${formatEdge(ignored.edge)}`,
    `    closure path: ${formatPath(ignored.packagePath)}`,
    `    reason: ${ignored.reason}`,
  ]),
)

if (hasFailures) {
  report.push(
    "Retail spine closure is not satisfied. Remove hard runtime blockers or convert deliberate adapter/shim links to explicit optional edges.",
  )
  console.error(report.join("\n"))
  process.exit(1)
}

report.push("Verified retail spine package closure.")
console.log(report.join("\n"))
