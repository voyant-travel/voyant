import { readFile, realpath } from "node:fs/promises"
import path from "node:path"
import type { VoyantGraphRouteBundle, VoyantGraphRouteMethod } from "@voyant-travel/core/project"
import ts from "typescript"
import { statementIdentifierName } from "./project-convention-static-data.js"
import {
  discoverProjectConventions,
  type ProjectConventionApiRoute,
  type ProjectConventionRouteSurface,
} from "./project-conventions.js"

/** Path relative to the project's disposable `.voyant` artifact root. */
export const PROJECT_API_GENERATED_PATH = "runtime/project-api.generated.ts"

const SUPPORTED_METHODS = new Set<VoyantGraphRouteMethod>([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
])

export const PROJECT_API_CONVENTION_DIAGNOSTIC_CODES = {
  PROJECT_API_DEFAULT_EXPORT: "Route files cannot have a default export.",
  PROJECT_API_DUPLICATE_ROUTE_METHOD:
    "Two route files cannot handle the same method and canonical route.",
  PROJECT_API_IMPORT_ESCAPE: "Route file imports cannot escape the project root.",
  PROJECT_API_MISSING_METHOD: "Route files must export at least one supported HTTP method.",
  PROJECT_API_UNSUPPORTED_EXPORT:
    "Route files cannot have runtime exports other than supported HTTP methods.",
} as const

export type ProjectApiConventionDiagnosticCode =
  keyof typeof PROJECT_API_CONVENTION_DIAGNOSTIC_CODES

export interface ProjectApiConventionDiagnostic {
  code: ProjectApiConventionDiagnosticCode
  severity: "error"
  message: string
  sourcePaths: readonly string[]
  exportName?: string
  method?: VoyantGraphRouteMethod
  route?: string
  surface?: ProjectConventionRouteSurface
}

export interface ProjectApiConventionRoute extends ProjectConventionApiRoute {
  methods: readonly VoyantGraphRouteMethod[]
}

export interface ProjectApiConventionAnalysis {
  routes: readonly ProjectApiConventionRoute[]
  diagnostics: readonly ProjectApiConventionDiagnostic[]
}

export interface ProjectApiGeneratedFile {
  path: typeof PROJECT_API_GENERATED_PATH
  contents: string
}

export interface ProjectApiConventionCompilation {
  routes: readonly ProjectApiConventionRoute[]
  graphRoutes: readonly VoyantGraphRouteBundle[]
  generatedFile: ProjectApiGeneratedFile
}

export interface ProjectApiConventionsOptions {
  projectRoot: string
}

export class ProjectApiConventionError extends Error {
  readonly diagnostics: readonly ProjectApiConventionDiagnostic[]

  constructor(diagnostics: readonly ProjectApiConventionDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join("\n"))
    this.name = "ProjectApiConventionError"
    this.diagnostics = diagnostics
  }
}

export async function analyzeProjectApiConventions(
  options: ProjectApiConventionsOptions,
): Promise<ProjectApiConventionAnalysis> {
  const projectRoot = path.resolve(options.projectRoot)
  const realProjectRoot = await realpath(projectRoot)
  const discovery = await discoverProjectConventions(projectRoot)
  const discoveredRoutes = discovery.contributions.filter(
    (contribution): contribution is ProjectConventionApiRoute => contribution.kind === "api-route",
  )
  const routes: ProjectApiConventionRoute[] = []
  const diagnostics: ProjectApiConventionDiagnostic[] = []

  for (const route of discoveredRoutes) {
    const sourceFilePath = resolveInsideProject(projectRoot, route.sourcePath)
    const realSourceFilePath = await realpath(sourceFilePath)
    if (!isInside(realProjectRoot, realSourceFilePath)) {
      diagnostics.push(importEscapeDiagnostic(route.sourcePath, route.sourcePath))
      continue
    }

    const source = await readFile(realSourceFilePath, "utf8")
    const sourceFile = ts.createSourceFile(
      realSourceFilePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )
    const analysis = analyzeRouteSource(sourceFile, route.sourcePath, projectRoot)
    diagnostics.push(...analysis.diagnostics)
    if (analysis.methods.length > 0) routes.push({ ...route, methods: analysis.methods })
  }

  diagnostics.push(...findDuplicateRouteMethods(routes))
  routes.sort(compareRoutes)
  diagnostics.sort(compareDiagnostics)
  return { routes, diagnostics }
}

export async function compileProjectApiConventions(
  options: ProjectApiConventionsOptions,
): Promise<ProjectApiConventionCompilation> {
  const analysis = await analyzeProjectApiConventions(options)
  if (analysis.diagnostics.length > 0) {
    throw new ProjectApiConventionError(analysis.diagnostics)
  }

  return {
    routes: analysis.routes,
    graphRoutes: analysis.routes.map(({ id, methods, route, surface }) => ({
      id,
      methods,
      mount: route,
      surface,
    })),
    generatedFile: {
      path: PROJECT_API_GENERATED_PATH,
      contents: generateProjectApiAdapterSource(analysis.routes),
    },
  }
}

export function generateProjectApiAdapterSource(
  routes: readonly ProjectApiConventionRoute[],
): string {
  const orderedRoutes = [...routes].sort(compareRoutes)
  const imports = orderedRoutes.map(
    (route, index) =>
      `import * as route${index} from ${JSON.stringify(generatedImportSpecifier(route.sourcePath))}`,
  )
  const admin = routeRegistrations(orderedRoutes, "admin")
  const public_ = routeRegistrations(orderedRoutes, "public")

  return [
    'import type { HonoModule } from "@voyant-travel/hono/module"',
    'import type { VoyantBindings, VoyantVariables } from "@voyant-travel/hono/types"',
    'import { Hono } from "hono"',
    ...imports,
    "",
    "type ProjectApiEnv = { Bindings: VoyantBindings; Variables: VoyantVariables }",
    ...(admin.length > 0 ? ["const adminRoutes = new Hono<ProjectApiEnv>()", ...admin] : []),
    ...(public_.length > 0 ? ["const publicRoutes = new Hono<ProjectApiEnv>()", ...public_] : []),
    "",
    "export const projectApiHonoModule = {",
    '  module: { name: "project-api" },',
    ...(admin.length > 0 ? ["  adminRoutes,"] : []),
    ...(public_.length > 0 ? ["  publicRoutes,", '  publicPath: "/",'] : []),
    "} satisfies HonoModule",
    "",
  ].join("\n")
}

function analyzeRouteSource(
  sourceFile: ts.SourceFile,
  sourcePath: string,
  projectRoot: string,
): {
  methods: VoyantGraphRouteMethod[]
  diagnostics: ProjectApiConventionDiagnostic[]
} {
  const methods = new Set<VoyantGraphRouteMethod>()
  const diagnostics: ProjectApiConventionDiagnostic[] = []

  inspectModuleSpecifiers(sourceFile, (specifier) => {
    if (!isPathImport(specifier)) return
    if (specifier.startsWith("file:")) {
      diagnostics.push(importEscapeDiagnostic(sourcePath, specifier))
      return
    }
    const resolved = path.resolve(path.dirname(sourceFile.fileName), specifier)
    if (!isInside(projectRoot, resolved)) {
      diagnostics.push(importEscapeDiagnostic(sourcePath, specifier))
    }
  })

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      diagnostics.push(defaultExportDiagnostic(sourcePath))
      continue
    }

    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) {
        if (!statement.isTypeOnly) diagnostics.push(unsupportedExportDiagnostic(sourcePath, "*"))
        continue
      }
      if (!ts.isNamedExports(statement.exportClause)) continue
      for (const element of statement.exportClause.elements) {
        if (statement.isTypeOnly || element.isTypeOnly) continue
        recordExport(element.name.text, sourcePath, methods, diagnostics)
      }
      continue
    }

    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      diagnostics.push(defaultExportDiagnostic(sourcePath))
      continue
    }
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        for (const name of bindingNames(declaration.name)) {
          recordExport(name, sourcePath, methods, diagnostics)
        }
      }
      continue
    }
    recordExport(
      statementIdentifierName(statement) ?? "(anonymous)",
      sourcePath,
      methods,
      diagnostics,
    )
  }

  if (methods.size === 0) {
    diagnostics.push({
      code: "PROJECT_API_MISSING_METHOD",
      severity: "error",
      sourcePaths: [sourcePath],
      message: `Route file "${sourcePath}" must export at least one of ${[
        ...SUPPORTED_METHODS,
      ].join(", ")}.`,
    })
  }

  return { methods: [...methods].sort(compareStrings), diagnostics }
}

function inspectModuleSpecifiers(
  sourceFile: ts.SourceFile,
  inspect: (specifier: string) => void,
): void {
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      inspect(node.moduleSpecifier.text)
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      inspect(node.moduleReference.expression.text)
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]!)
    ) {
      inspect(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

function recordExport(
  name: string,
  sourcePath: string,
  methods: Set<VoyantGraphRouteMethod>,
  diagnostics: ProjectApiConventionDiagnostic[],
): void {
  if (name === "default") {
    diagnostics.push(defaultExportDiagnostic(sourcePath))
  } else if (SUPPORTED_METHODS.has(name as VoyantGraphRouteMethod)) {
    methods.add(name as VoyantGraphRouteMethod)
  } else {
    diagnostics.push(unsupportedExportDiagnostic(sourcePath, name))
  }
}

function findDuplicateRouteMethods(
  routes: readonly ProjectApiConventionRoute[],
): ProjectApiConventionDiagnostic[] {
  const identities = new Map<string, ProjectApiConventionRoute[]>()
  for (const route of routes) {
    for (const method of route.methods) {
      const key = [route.surface, method, canonicalRoutePattern(route.route)].join("\0")
      const matches = identities.get(key)
      if (matches) matches.push(route)
      else identities.set(key, [route])
    }
  }

  const diagnostics: ProjectApiConventionDiagnostic[] = []
  for (const [key, matches] of identities) {
    if (matches.length < 2) continue
    const [surface, method, route] = key.split("\0") as [
      ProjectConventionRouteSurface,
      VoyantGraphRouteMethod,
      string,
    ]
    const sourcePaths = [...new Set(matches.map((match) => match.sourcePath))].sort(compareStrings)
    diagnostics.push({
      code: "PROJECT_API_DUPLICATE_ROUTE_METHOD",
      severity: "error",
      method,
      route,
      sourcePaths,
      surface,
      message: `${method} routes on the ${surface} surface collide at "${route}": ${sourcePaths
        .map((sourcePath) => `"${sourcePath}"`)
        .join(", ")}.`,
    })
  }
  return diagnostics
}

function routeRegistrations(
  routes: readonly ProjectApiConventionRoute[],
  surface: ProjectConventionRouteSurface,
): string[] {
  const app = surface === "admin" ? "adminRoutes" : "publicRoutes"
  return routes.flatMap((route, index) =>
    route.surface === surface
      ? route.methods.map(
          (method) =>
            `${app}.on(${JSON.stringify(method)}, ${JSON.stringify(route.route)}, route${index}.${method})`,
        )
      : [],
  )
}

function generatedImportSpecifier(sourcePath: string): string {
  const withoutExtension = sourcePath.replace(/\.ts$/, ".js")
  return `../../${withoutExtension}`
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

function resolveInsideProject(projectRoot: string, sourcePath: string): string {
  if (path.isAbsolute(sourcePath))
    throw new Error(`Expected a project-relative path: ${sourcePath}`)
  const resolved = path.resolve(projectRoot, sourcePath)
  if (!isInside(projectRoot, resolved)) throw new Error(`Path escapes project root: ${sourcePath}`)
  return resolved
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function isPathImport(specifier: string): boolean {
  return specifier.startsWith(".") || path.isAbsolute(specifier) || specifier.startsWith("file:")
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return Boolean(
    ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((item) => item.kind === kind),
  )
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
  )
}

function defaultExportDiagnostic(sourcePath: string): ProjectApiConventionDiagnostic {
  return {
    code: "PROJECT_API_DEFAULT_EXPORT",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName: "default",
    message: `Route file "${sourcePath}" cannot have a default export.`,
  }
}

function unsupportedExportDiagnostic(
  sourcePath: string,
  exportName: string,
): ProjectApiConventionDiagnostic {
  return {
    code: "PROJECT_API_UNSUPPORTED_EXPORT",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName,
    message: `Route file "${sourcePath}" has unsupported runtime export "${exportName}".`,
  }
}

function importEscapeDiagnostic(
  sourcePath: string,
  specifier: string,
): ProjectApiConventionDiagnostic {
  return {
    code: "PROJECT_API_IMPORT_ESCAPE",
    severity: "error",
    sourcePaths: [sourcePath],
    message: `Route file "${sourcePath}" import "${specifier}" escapes the project root.`,
  }
}

function compareRoutes(left: ProjectApiConventionRoute, right: ProjectApiConventionRoute): number {
  return (
    compareStrings(left.surface, right.surface) ||
    compareStrings(left.route, right.route) ||
    compareStrings(left.sourcePath, right.sourcePath)
  )
}

function compareDiagnostics(
  left: ProjectApiConventionDiagnostic,
  right: ProjectApiConventionDiagnostic,
): number {
  return (
    compareStrings(left.code, right.code) ||
    compareStrings(left.sourcePaths.join("\0"), right.sourcePaths.join("\0")) ||
    compareStrings(left.exportName ?? "", right.exportName ?? "")
  )
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
