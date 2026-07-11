import { readFile, realpath } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"

import {
  hasModifier,
  inspectModuleSpecifiers,
  isInside,
  isPathImport,
  resolveInsideProject,
} from "./project-convention-compiler-utils.js"
import {
  isDurableExpression,
  resolveExpression,
  stringProperty,
  unwrapExpression,
} from "./project-convention-static-data.js"
import {
  discoverProjectConventions,
  type ProjectConventionFileContribution,
} from "./project-conventions.js"

export const PROJECT_SUBSCRIBERS_GENERATED_PATH = "runtime/project-subscribers.generated.ts"
export const PROJECT_LINKS_GENERATED_PATH = "runtime/project-links.generated.ts"

export const PROJECT_SUBSCRIBER_LINK_DIAGNOSTIC_CODES = {
  PROJECT_CONVENTION_ID_COLLISION: "Convention files must have unique path-derived identifiers.",
  PROJECT_CONVENTION_IMPORT_ESCAPE: "Convention file imports cannot escape the project root.",
  PROJECT_CONVENTION_MISSING_DEFAULT_EXPORT: "Convention files must have one default export.",
  PROJECT_CONVENTION_MULTIPLE_DEFAULT_EXPORTS:
    "Convention files cannot have more than one default export.",
  PROJECT_CONVENTION_UNSUPPORTED_EXPORT: "Convention files cannot have named runtime exports.",
  PROJECT_LINK_INVALID_DEFINITION:
    "Link files must default-export a definition created by the imported defineLink helper.",
  PROJECT_SUBSCRIBER_ID_COLLISION: "Subscriber descriptor ids must be unique.",
  PROJECT_SUBSCRIBER_INVALID_DESCRIPTOR:
    "Subscriber files must default-export an EventFilterDescriptor object with literal id and eventType fields.",
  PROJECT_SUBSCRIBER_NON_DURABLE_DESCRIPTOR:
    "Subscriber descriptors must contain only durable, serializable data.",
} as const

export type ProjectSubscriberLinkDiagnosticCode =
  keyof typeof PROJECT_SUBSCRIBER_LINK_DIAGNOSTIC_CODES

export interface ProjectSubscriberLinkDiagnostic {
  code: ProjectSubscriberLinkDiagnosticCode
  severity: "error"
  message: string
  sourcePaths: readonly string[]
  exportName?: string
  subscriberId?: string
}

export type ProjectSubscriberLinkConventionDiagnostic = ProjectSubscriberLinkDiagnostic

export interface ProjectSubscriberConvention extends ProjectConventionFileContribution {
  kind: "subscriber"
  subscriberId: string
  eventType: string
}

export interface ProjectLinkConvention extends ProjectConventionFileContribution {
  kind: "link"
}

export interface ProjectSubscriberLinkConventionAnalysis {
  subscribers: readonly ProjectSubscriberConvention[]
  links: readonly ProjectLinkConvention[]
  diagnostics: readonly ProjectSubscriberLinkDiagnostic[]
}

export interface ProjectSubscriberLinkGeneratedFile {
  path: typeof PROJECT_SUBSCRIBERS_GENERATED_PATH | typeof PROJECT_LINKS_GENERATED_PATH
  contents: string
}

export interface ProjectSubscriberLinkConventionCompilation {
  subscribers: readonly ProjectSubscriberConvention[]
  links: readonly ProjectLinkConvention[]
  generatedFiles: readonly [ProjectSubscriberLinkGeneratedFile, ProjectSubscriberLinkGeneratedFile]
}

export interface ProjectSubscriberLinkConventionsOptions {
  projectRoot: string
}

export class ProjectSubscriberLinkConventionError extends Error {
  readonly diagnostics: readonly ProjectSubscriberLinkDiagnostic[]

  constructor(diagnostics: readonly ProjectSubscriberLinkDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join("\n"))
    this.name = "ProjectSubscriberLinkConventionError"
    this.diagnostics = diagnostics
  }
}

export async function analyzeProjectSubscriberLinkConventions(
  options: ProjectSubscriberLinkConventionsOptions,
): Promise<ProjectSubscriberLinkConventionAnalysis> {
  const projectRoot = path.resolve(options.projectRoot)
  const realProjectRoot = await realpath(projectRoot)
  const discovery = await discoverProjectConventions(projectRoot)
  const subscribers: ProjectSubscriberConvention[] = []
  const links: ProjectLinkConvention[] = []
  const diagnostics: ProjectSubscriberLinkDiagnostic[] = []
  const contributions = discovery.contributions.filter(
    (contribution): contribution is ProjectConventionFileContribution =>
      contribution.kind === "subscriber" || contribution.kind === "link",
  )
  const contributionPaths = new Set(contributions.map(({ sourcePath }) => sourcePath))
  diagnostics.push(
    ...discovery.diagnostics
      .filter(
        (diagnostic) =>
          diagnostic.code === "PROJECT_CONVENTION_ID_COLLISION" &&
          diagnostic.sourcePaths.some((sourcePath) => contributionPaths.has(sourcePath)),
      )
      .map((diagnostic) => ({
        code: "PROJECT_CONVENTION_ID_COLLISION" as const,
        severity: "error" as const,
        sourcePaths: diagnostic.sourcePaths,
        message: diagnostic.message,
      })),
  )

  for (const contribution of contributions) {
    const sourceFilePath = resolveInsideProject(projectRoot, contribution.sourcePath)
    const realSourceFilePath = await realpath(sourceFilePath)
    if (!isInside(realProjectRoot, realSourceFilePath)) {
      diagnostics.push(importEscapeDiagnostic(contribution.sourcePath, contribution.sourcePath))
      continue
    }

    const sourceFile = ts.createSourceFile(
      realSourceFilePath,
      await readFile(realSourceFilePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )
    const common = analyzeConventionModule(sourceFile, contribution.sourcePath, projectRoot)
    diagnostics.push(...common.diagnostics)
    if (!common.defaultExport) continue

    if (contribution.kind === "subscriber") {
      const subscriber = analyzeSubscriber(contribution, common.defaultExport, common.constants)
      diagnostics.push(...subscriber.diagnostics)
      if (subscriber.value) subscribers.push(subscriber.value)
    } else {
      const linkDiagnostic = analyzeLink(
        contribution.sourcePath,
        common.defaultExport,
        common.constants,
        common.defineLinkImports,
      )
      if (linkDiagnostic) diagnostics.push(linkDiagnostic)
      else links.push(contribution as ProjectLinkConvention)
    }
  }

  diagnostics.push(...findSubscriberIdCollisions(subscribers))
  subscribers.sort(compareConventions)
  links.sort(compareConventions)
  diagnostics.sort(compareDiagnostics)
  return { subscribers, links, diagnostics }
}

export async function compileProjectSubscriberLinkConventions(
  options: ProjectSubscriberLinkConventionsOptions,
): Promise<ProjectSubscriberLinkConventionCompilation> {
  const analysis = await analyzeProjectSubscriberLinkConventions(options)
  if (analysis.diagnostics.length > 0) {
    throw new ProjectSubscriberLinkConventionError(analysis.diagnostics)
  }

  return {
    subscribers: analysis.subscribers,
    links: analysis.links,
    generatedFiles: [
      {
        path: PROJECT_SUBSCRIBERS_GENERATED_PATH,
        contents: generateProjectSubscribersSource(analysis.subscribers),
      },
      {
        path: PROJECT_LINKS_GENERATED_PATH,
        contents: generateProjectLinksSource(analysis.links),
      },
    ],
  }
}

export function generateProjectSubscribersSource(
  subscribers: readonly ProjectSubscriberConvention[],
): string {
  const ordered = [...subscribers].sort(compareConventions)
  return generatedCollectionSource(
    ordered,
    "EventFilterDescriptor",
    "projectSubscribers",
    "subscriber",
  )
}

export function generateProjectLinksSource(links: readonly ProjectLinkConvention[]): string {
  const ordered = [...links].sort(compareConventions)
  return generatedCollectionSource(ordered, "LinkDefinition", "projectLinks", "link")
}

interface ModuleAnalysis {
  defaultExport?: ts.Expression
  constants: ReadonlyMap<string, ts.Expression>
  defineLinkImports: ReadonlySet<string>
  diagnostics: ProjectSubscriberLinkDiagnostic[]
}

function analyzeConventionModule(
  sourceFile: ts.SourceFile,
  sourcePath: string,
  projectRoot: string,
): ModuleAnalysis {
  const constants = new Map<string, ts.Expression>()
  const defineLinkImports = new Set<string>()
  const defaultExports: ts.Expression[] = []
  const diagnostics: ProjectSubscriberLinkDiagnostic[] = []

  inspectModuleSpecifiers(sourceFile, (specifier) => {
    if (!isPathImport(specifier)) return
    if (specifier.startsWith("file:")) {
      diagnostics.push(importEscapeDiagnostic(sourcePath, specifier))
      return
    }
    const resolved = path.resolve(path.dirname(sourceFile.fileName), specifier)
    if (!isInside(projectRoot, resolved))
      diagnostics.push(importEscapeDiagnostic(sourcePath, specifier))
  })

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      recordDefineLinkImports(statement, defineLinkImports)
      continue
    }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      defaultExports.push(statement.expression)
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
        diagnostics.push(unsupportedExportDiagnostic(sourcePath, element.name.text))
      }
      continue
    }
    if (ts.isVariableStatement(statement)) {
      const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword)
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          constants.set(declaration.name.text, declaration.initializer)
        }
        if (exported)
          for (const exportName of bindingNames(declaration.name))
            diagnostics.push(unsupportedExportDiagnostic(sourcePath, exportName))
      }
      continue
    }
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      diagnostics.push(invalidDefaultExportDiagnostic(sourcePath))
      continue
    }
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue
    const name = "name" in statement && statement.name ? statement.name.text : "(anonymous)"
    diagnostics.push(unsupportedExportDiagnostic(sourcePath, name))
  }

  if (defaultExports.length === 0) diagnostics.push(missingDefaultExportDiagnostic(sourcePath))
  if (defaultExports.length > 1) diagnostics.push(multipleDefaultExportsDiagnostic(sourcePath))
  return { defaultExport: defaultExports[0], constants, defineLinkImports, diagnostics }
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text]
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
  )
}

function analyzeSubscriber(
  contribution: ProjectConventionFileContribution,
  expression: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>,
): { value?: ProjectSubscriberConvention; diagnostics: ProjectSubscriberLinkDiagnostic[] } {
  const resolved = resolveExpression(expression, constants)
  if (!ts.isObjectLiteralExpression(resolved)) {
    return { diagnostics: [invalidSubscriberDiagnostic(contribution.sourcePath)] }
  }
  const subscriberId = stringProperty(resolved, "id", constants)
  const eventType = stringProperty(resolved, "eventType", constants)
  if (!subscriberId || !eventType) {
    return { diagnostics: [invalidSubscriberDiagnostic(contribution.sourcePath)] }
  }
  if (!isDurableExpression(resolved, constants)) {
    return { diagnostics: [nonDurableSubscriberDiagnostic(contribution.sourcePath, subscriberId)] }
  }
  return {
    value: { ...contribution, kind: "subscriber", subscriberId, eventType },
    diagnostics: [],
  }
}

function analyzeLink(
  sourcePath: string,
  expression: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>,
  defineLinkImports: ReadonlySet<string>,
): ProjectSubscriberLinkDiagnostic | undefined {
  const resolved = unwrapExpression(resolveExpression(expression, constants))
  if (
    !ts.isCallExpression(resolved) ||
    !ts.isIdentifier(resolved.expression) ||
    !defineLinkImports.has(resolved.expression.text) ||
    resolved.arguments.length < 2 ||
    resolved.arguments.length > 3
  ) {
    return invalidLinkDiagnostic(sourcePath)
  }
  return undefined
}

function recordDefineLinkImports(declaration: ts.ImportDeclaration, imports: Set<string>): void {
  if (!ts.isStringLiteralLike(declaration.moduleSpecifier)) return
  if (declaration.importClause?.isTypeOnly) return
  if (
    declaration.moduleSpecifier.text !== "@voyant-travel/core" &&
    declaration.moduleSpecifier.text !== "@voyant-travel/core/links"
  )
    return
  for (const element of declaration.importClause?.namedBindings &&
  ts.isNamedImports(declaration.importClause.namedBindings)
    ? declaration.importClause.namedBindings.elements
    : []) {
    if ((element.propertyName?.text ?? element.name.text) === "defineLink" && !element.isTypeOnly) {
      imports.add(element.name.text)
    }
  }
}

function findSubscriberIdCollisions(
  subscribers: readonly ProjectSubscriberConvention[],
): ProjectSubscriberLinkDiagnostic[] {
  const byId = new Map<string, ProjectSubscriberConvention[]>()
  for (const subscriber of subscribers) {
    const matches = byId.get(subscriber.subscriberId)
    if (matches) matches.push(subscriber)
    else byId.set(subscriber.subscriberId, [subscriber])
  }
  return [...byId]
    .filter(([, matches]) => matches.length > 1)
    .map(([subscriberId, matches]) => {
      const sourcePaths = matches.map(({ sourcePath }) => sourcePath).sort(compareStrings)
      return {
        code: "PROJECT_SUBSCRIBER_ID_COLLISION",
        severity: "error",
        subscriberId,
        sourcePaths,
        message: `Subscriber id "${subscriberId}" is exported by ${formatSources(sourcePaths)}.`,
      }
    })
}

function generatedCollectionSource(
  contributions: readonly ProjectConventionFileContribution[],
  typeName: "EventFilterDescriptor" | "LinkDefinition",
  exportName: "projectSubscribers" | "projectLinks",
  importName: "subscriber" | "link",
): string {
  return [
    `import type { ${typeName} } from "@voyant-travel/core"`,
    ...contributions.map(
      ({ sourcePath }, index) =>
        `import ${importName}${index} from ${JSON.stringify(generatedImportSpecifier(sourcePath))}`,
    ),
    "",
    `export const ${exportName} = [${contributions.map((_, index) => `${importName}${index}`).join(", ")}] as const satisfies readonly ${typeName}[]`,
    "",
  ].join("\n")
}

function generatedImportSpecifier(sourcePath: string): string {
  return `../../${sourcePath.replace(/\.ts$/, ".js")}`
}

function importEscapeDiagnostic(
  sourcePath: string,
  specifier: string,
): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_CONVENTION_IMPORT_ESCAPE",
    severity: "error",
    sourcePaths: [sourcePath],
    message: `Convention file "${sourcePath}" import "${specifier}" escapes the project root.`,
  }
}

function missingDefaultExportDiagnostic(sourcePath: string): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_CONVENTION_MISSING_DEFAULT_EXPORT",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName: "default",
    message: `Convention file "${sourcePath}" must have a default export.`,
  }
}

function multipleDefaultExportsDiagnostic(sourcePath: string): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_CONVENTION_MULTIPLE_DEFAULT_EXPORTS",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName: "default",
    message: `Convention file "${sourcePath}" has more than one default export.`,
  }
}

function invalidDefaultExportDiagnostic(sourcePath: string): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_CONVENTION_MISSING_DEFAULT_EXPORT",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName: "default",
    message: `Convention file "${sourcePath}" must default-export an expression.`,
  }
}

function unsupportedExportDiagnostic(
  sourcePath: string,
  exportName: string,
): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_CONVENTION_UNSUPPORTED_EXPORT",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName,
    message: `Convention file "${sourcePath}" has unsupported runtime export "${exportName}".`,
  }
}

function invalidSubscriberDiagnostic(sourcePath: string): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_SUBSCRIBER_INVALID_DESCRIPTOR",
    severity: "error",
    sourcePaths: [sourcePath],
    message: `Subscriber file "${sourcePath}" must default-export an object with non-empty literal "id" and "eventType" fields.`,
  }
}

function nonDurableSubscriberDiagnostic(
  sourcePath: string,
  subscriberId: string,
): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_SUBSCRIBER_NON_DURABLE_DESCRIPTOR",
    severity: "error",
    subscriberId,
    sourcePaths: [sourcePath],
    message: `Subscriber "${subscriberId}" in "${sourcePath}" must contain only literal, serializable data.`,
  }
}

function invalidLinkDiagnostic(sourcePath: string): ProjectSubscriberLinkDiagnostic {
  return {
    code: "PROJECT_LINK_INVALID_DEFINITION",
    severity: "error",
    sourcePaths: [sourcePath],
    message: `Link file "${sourcePath}" must default-export defineLink(left, right, options?).`,
  }
}

function compareConventions(
  left: ProjectConventionFileContribution,
  right: ProjectConventionFileContribution,
): number {
  return compareStrings(left.sourcePath, right.sourcePath) || compareStrings(left.id, right.id)
}

function compareDiagnostics(
  left: ProjectSubscriberLinkDiagnostic,
  right: ProjectSubscriberLinkDiagnostic,
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

function formatSources(sourcePaths: readonly string[]): string {
  return sourcePaths.map((sourcePath) => `"${sourcePath}"`).join(", ")
}
