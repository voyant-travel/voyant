import { readdir } from "node:fs/promises"
import path from "node:path"

export type ProjectConventionKind =
  | "admin"
  | "api-route"
  | "job"
  | "link"
  | "module"
  | "subscriber"
  | "workflow"

export type ProjectConventionRouteSurface = "admin" | "public"

interface ProjectConventionContributionBase {
  /** Stable, path-derived identifier. Source files are never evaluated. */
  id: string
  kind: ProjectConventionKind
  /** POSIX-formatted path relative to the project root. */
  sourcePath: string
}

export interface ProjectConventionApiRoute extends ProjectConventionContributionBase {
  kind: "api-route"
  surface: ProjectConventionRouteSurface
  /** Surface-relative URL path, including a leading slash. */
  route: string
}

export interface ProjectConventionFileContribution extends ProjectConventionContributionBase {
  kind: Exclude<ProjectConventionKind, "api-route">
}

export type ProjectConventionContribution =
  | ProjectConventionApiRoute
  | ProjectConventionFileContribution

export const PROJECT_CONVENTION_DIAGNOSTIC_CODES = {
  PROJECT_CONVENTION_ID_COLLISION:
    "Two convention contributions resolve to the same stable identifier.",
  PROJECT_CONVENTION_ROUTE_COLLISION:
    "Two convention API routes resolve to the same surface and route pattern.",
} as const

export type ProjectConventionDiagnosticCode = keyof typeof PROJECT_CONVENTION_DIAGNOSTIC_CODES

export interface ProjectConventionDiagnostic {
  code: ProjectConventionDiagnosticCode
  severity: "error"
  message: string
  /** Colliding identifier for ID diagnostics. */
  id?: string
  /** Colliding surface for route diagnostics. */
  surface?: ProjectConventionRouteSurface
  /** Canonical route pattern for route diagnostics. */
  route?: string
  /** Sorted project-relative paths involved in the collision. */
  sourcePaths: readonly string[]
}

export interface ProjectConventionDiscovery {
  contributions: readonly ProjectConventionContribution[]
  diagnostics: readonly ProjectConventionDiagnostic[]
}

export interface DiscoverProjectConventionsOptions {
  projectRoot: string
}

export type DiscoverProjectConventionsInput = string | DiscoverProjectConventionsOptions

interface RecursiveConvention {
  directory: string
  kind: Exclude<ProjectConventionKind, "admin" | "api-route" | "module">
  accepts: (fileName: string) => boolean
}

const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".generated",
  ".voyant",
  "__generated__",
  "build",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "vendor",
])

const RECURSIVE_CONVENTIONS: readonly RecursiveConvention[] = [
  { directory: "src/workflows", kind: "workflow", accepts: isTypeScriptFile },
  { directory: "src/jobs", kind: "job", accepts: isTypeScriptFile },
  { directory: "src/subscribers", kind: "subscriber", accepts: isTypeScriptFile },
  { directory: "src/links", kind: "link", accepts: isTypeScriptFile },
]

/**
 * Discover source-backed project contributions from conventional locations.
 *
 * This is a build-time, Node-only filesystem scan. It does not import, parse,
 * or execute project source files.
 */
export async function discoverProjectConventions(
  input: DiscoverProjectConventionsInput,
): Promise<ProjectConventionDiscovery> {
  const projectRoot = path.resolve(typeof input === "string" ? input : input.projectRoot)
  const contributions: ProjectConventionContribution[] = []

  await Promise.all([
    discoverApiRoutes(projectRoot, "admin", "src/api/admin", contributions),
    discoverApiRoutes(projectRoot, "public", "src/api/store", contributions),
    ...RECURSIVE_CONVENTIONS.map((convention) =>
      discoverRecursiveConvention(projectRoot, convention, contributions),
    ),
    discoverAdminExtensions(projectRoot, contributions),
    discoverModules(projectRoot, contributions),
  ])

  contributions.sort(compareContributions)

  return {
    contributions,
    diagnostics: findDiagnostics(contributions),
  }
}

async function discoverAdminExtensions(
  projectRoot: string,
  contributions: ProjectConventionContribution[],
): Promise<void> {
  const directory = "src/admin"
  for (const entry of await readDirectory(path.join(projectRoot, directory))) {
    if (!entry.isDirectory() || shouldIgnoreDirectory(entry.name)) continue

    for (const fileName of ["index.ts", "index.tsx"] as const) {
      const sourcePath = `${directory}/${entry.name}/${fileName}`
      if (!(await containsFile(projectRoot, sourcePath))) continue

      contributions.push({
        id: stableId("admin", entry.name),
        kind: "admin",
        sourcePath,
      })
    }
  }
}

async function discoverApiRoutes(
  projectRoot: string,
  surface: ProjectConventionRouteSurface,
  directory: string,
  contributions: ProjectConventionContribution[],
): Promise<void> {
  const files = await walkFiles(projectRoot, directory, (fileName) => fileName === "route.ts")
  for (const sourcePath of files) {
    const routeSegments = sourcePath
      .slice(`${directory}/`.length, -"/route.ts".length)
      .split("/")
      .filter(Boolean)
      .filter((segment) => !isRouteGroup(segment))
    const route = routeFromSegments(routeSegments)
    contributions.push({
      id: stableId("api", surface, ...(routeSegments.length === 0 ? ["root"] : routeSegments)),
      kind: "api-route",
      sourcePath,
      surface,
      route,
    })
  }
}

async function discoverRecursiveConvention(
  projectRoot: string,
  convention: RecursiveConvention,
  contributions: ProjectConventionContribution[],
): Promise<void> {
  const files = await walkFiles(projectRoot, convention.directory, convention.accepts)
  for (const sourcePath of files) {
    const relativeEntry = sourcePath.slice(`${convention.directory}/`.length)
    contributions.push({
      id: stableId(convention.kind, ...withoutFinalExtension(relativeEntry).split("/")),
      kind: convention.kind,
      sourcePath,
    })
  }
}

async function discoverModules(
  projectRoot: string,
  contributions: ProjectConventionContribution[],
): Promise<void> {
  const directory = "src/modules"
  for (const entry of await readDirectory(path.join(projectRoot, directory))) {
    if (!entry.isDirectory() || shouldIgnoreDirectory(entry.name)) continue

    const sourcePath = `${directory}/${entry.name}/index.ts`
    if (!(await containsFile(projectRoot, sourcePath))) continue

    contributions.push({
      id: stableId("module", entry.name),
      kind: "module",
      sourcePath,
    })
  }
}

async function walkFiles(
  projectRoot: string,
  relativeDirectory: string,
  accepts: (fileName: string) => boolean,
): Promise<string[]> {
  const discovered: string[] = []

  async function visit(directory: string): Promise<void> {
    for (const entry of await readDirectory(path.join(projectRoot, directory))) {
      const entryPath = `${directory}/${entry.name}`
      if (entry.isDirectory()) {
        if (!shouldIgnoreDirectory(entry.name)) await visit(entryPath)
      } else if (entry.isFile() && accepts(entry.name)) {
        discovered.push(entryPath)
      }
    }
  }

  await visit(relativeDirectory)
  return discovered.sort(compareStrings)
}

async function readDirectory(directory: string) {
  try {
    return await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}

async function containsFile(projectRoot: string, sourcePath: string): Promise<boolean> {
  const directory = path.dirname(path.join(projectRoot, sourcePath))
  const fileName = path.basename(sourcePath)
  return (await readDirectory(directory)).some((entry) => entry.isFile() && entry.name === fileName)
}

function findDiagnostics(
  contributions: readonly ProjectConventionContribution[],
): ProjectConventionDiagnostic[] {
  const diagnostics: ProjectConventionDiagnostic[] = []
  const ids = groupBy(contributions, (contribution) => contribution.id)

  for (const [id, matches] of ids) {
    if (matches.length < 2) continue
    const sourcePaths = sortedUnique(matches.map((match) => match.sourcePath))
    diagnostics.push({
      code: "PROJECT_CONVENTION_ID_COLLISION",
      severity: "error",
      id,
      sourcePaths,
      message: `Convention ID "${id}" is produced by ${formatSources(sourcePaths)}.`,
    })
  }

  const routes = contributions.filter(
    (contribution): contribution is ProjectConventionApiRoute => contribution.kind === "api-route",
  )
  const routePatterns = groupBy(
    routes,
    (route) => `${route.surface}\0${canonicalRoutePattern(route.route)}`,
  )

  for (const [key, matches] of routePatterns) {
    if (matches.length < 2) continue
    const [surface, route] = key.split("\0") as [ProjectConventionRouteSurface, string]
    const sourcePaths = sortedUnique(matches.map((match) => match.sourcePath))
    diagnostics.push({
      code: "PROJECT_CONVENTION_ROUTE_COLLISION",
      severity: "error",
      surface,
      route,
      sourcePaths,
      message: `Convention routes on the ${surface} surface collide at "${route}": ${formatSources(sourcePaths)}.`,
    })
  }

  return diagnostics.sort(compareDiagnostics)
}

function groupBy<T>(values: readonly T[], keyFor: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const value of values) {
    const key = keyFor(value)
    const group = groups.get(key)
    if (group) group.push(value)
    else groups.set(key, [value])
  }
  return groups
}

function routeFromSegments(segments: readonly string[]): string {
  if (segments.length === 0) return "/"
  return `/${segments.map(routeSegment).join("/")}`
}

function routeSegment(segment: string): string {
  const optionalCatchAll = segment.match(/^\[\[\.\.\.([^\]]+)\]\]$/)
  if (optionalCatchAll) return `*${optionalCatchAll[1]}?`
  const catchAll = segment.match(/^\[\.\.\.([^\]]+)\]$/)
  if (catchAll) return `*${catchAll[1]}`
  const dynamic = segment.match(/^\[([^\]]+)\]$/)
  if (dynamic) return `:${dynamic[1]}`
  return segment
}

function canonicalRoutePattern(route: string): string {
  return route
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) return ":param"
      if (segment.startsWith("*")) return segment.endsWith("?") ? "*optional" : "*catch-all"
      return segment
    })
    .join("/")
}

function stableId(namespace: string, ...parts: readonly string[]): string {
  return ["project", namespace, ...parts.map(stableIdPart)].join(".")
}

function stableIdPart(part: string): string {
  const routeValue = routeSegment(part)
    .replace(/^:/, "by-")
    .replace(/^\*/, "all-")
    .replace(/\?$/, "-optional")
  return (
    routeValue
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "root"
  )
}

function withoutFinalExtension(filePath: string): string {
  return filePath.replace(/\.[^./]+$/, "")
}

function isTypeScriptFile(fileName: string): boolean {
  return fileName.endsWith(".ts") && !fileName.endsWith(".d.ts")
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")")
}

function shouldIgnoreDirectory(name: string): boolean {
  return IGNORED_DIRECTORY_NAMES.has(name) || name.startsWith(".")
}

function compareContributions(
  left: ProjectConventionContribution,
  right: ProjectConventionContribution,
): number {
  return (
    compareStrings(left.sourcePath, right.sourcePath) ||
    compareStrings(left.kind, right.kind) ||
    compareStrings(left.id, right.id)
  )
}

function compareDiagnostics(
  left: ProjectConventionDiagnostic,
  right: ProjectConventionDiagnostic,
): number {
  return (
    compareStrings(left.code, right.code) ||
    compareStrings(left.id ?? "", right.id ?? "") ||
    compareStrings(left.surface ?? "", right.surface ?? "") ||
    compareStrings(left.route ?? "", right.route ?? "") ||
    compareStrings(left.sourcePaths.join("\0"), right.sourcePaths.join("\0"))
  )
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings)
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function formatSources(sourcePaths: readonly string[]): string {
  return sourcePaths.map((sourcePath) => `"${sourcePath}"`).join(", ")
}
