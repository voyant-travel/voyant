import { readFile, realpath } from "node:fs/promises"
import path from "node:path"
import type {
  VoyantGraphJsonObject,
  VoyantGraphLinkDeclaration,
  VoyantGraphSubscriber,
} from "@voyant-travel/core/project"

import ts, { loadTypeScript } from "./lazy-typescript.js"
import {
  hasModifier,
  inspectModuleSpecifiers,
  isInside,
  isPathImport,
  resolveInsideProject,
} from "./project-convention-compiler-utils.js"
import {
  durableJsonValue,
  isDurableExpression,
  resolveExpression,
  statementIdentifierName,
  stringProperty,
  unwrapExpression,
} from "./project-convention-static-data.js"
import {
  discoverProjectConventions,
  type ProjectConventionDiscovery,
  type ProjectConventionFileContribution,
} from "./project-conventions.js"
import {
  compareDiagnostics,
  findSubscriberIdCollisions,
  importEscapeDiagnostic,
  invalidDefaultExportDiagnostic,
  invalidLinkDiagnostic,
  invalidSubscriberDiagnostic,
  missingDefaultExportDiagnostic,
  multipleDefaultExportsDiagnostic,
  nonDurableSubscriberDiagnostic,
  unsupportedExportDiagnostic,
} from "./project-subscriber-link-diagnostics.js"
import {
  generateProjectLinksSource,
  generateProjectSubscribersSource,
} from "./project-subscriber-link-generated-source.js"

export {
  generateProjectLinksSource,
  generateProjectSubscribersSource,
  generateSelectedLinksSource,
} from "./project-subscriber-link-generated-source.js"

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
  PROJECT_SUBSCRIBER_MISSING_MANIFEST:
    "Subscriber descriptors must include a complete durable event-filter manifest.",
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
  descriptor: VoyantGraphJsonObject
  manifest: VoyantGraphJsonObject
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
  graphSubscribers: readonly VoyantGraphSubscriber[]
  graphLinks: readonly VoyantGraphLinkDeclaration[]
  generatedFiles: readonly [ProjectSubscriberLinkGeneratedFile, ProjectSubscriberLinkGeneratedFile]
}

export interface ProjectSubscriberLinkConventionsOptions {
  projectRoot: string
  /** Reuse an authoritative discovery snapshot instead of scanning the project again. */
  discovery?: ProjectConventionDiscovery
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
  const discovery = options.discovery ?? (await discoverProjectConventions(projectRoot))
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
  if (contributions.length === 0) return { subscribers, links, diagnostics }

  await loadTypeScript()
  const realProjectRoot = await realpath(projectRoot)

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
    const common = analyzeConventionModule(sourceFile, contribution.sourcePath, realProjectRoot)
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
    graphSubscribers: analysis.subscribers.map((subscriber, index) => ({
      id: subscriber.subscriberId,
      eventType: subscriber.eventType,
      eventFilterId: subscriber.manifest.id as string,
      workflowId: subscriber.manifest.targetWorkflowId as string,
      filter: subscriber.descriptor,
      runtime: {
        entry: `./.voyant/${PROJECT_SUBSCRIBERS_GENERATED_PATH}`,
        export: `projectSubscriber${index}`,
      },
    })),
    graphLinks: analysis.links.map((link) => ({
      id: link.id,
      kind: "definition",
      source: link.sourcePath,
      export: "default",
    })),
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
    diagnostics.push(
      unsupportedExportDiagnostic(sourcePath, statementIdentifierName(statement) ?? "(anonymous)"),
    )
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
  const descriptor = durableJsonValue(resolved, constants)
  if (!isJsonObject(descriptor)) {
    return { diagnostics: [nonDurableSubscriberDiagnostic(contribution.sourcePath, subscriberId)] }
  }
  const manifest = descriptor.manifest
  if (
    !isJsonObject(manifest) ||
    manifest.id !== subscriberId ||
    manifest.eventType !== eventType ||
    typeof manifest.payloadHash !== "string" ||
    manifest.payloadHash.length === 0 ||
    typeof manifest.targetWorkflowId !== "string" ||
    manifest.targetWorkflowId.length === 0
  ) {
    return {
      diagnostics: [
        {
          code: "PROJECT_SUBSCRIBER_MISSING_MANIFEST",
          severity: "error",
          subscriberId,
          sourcePaths: [contribution.sourcePath],
          message: `Subscriber "${subscriberId}" in "${contribution.sourcePath}" must include a manifest with matching id/eventType, payloadHash, and targetWorkflowId.`,
        },
      ],
    }
  }
  return {
    value: {
      ...contribution,
      kind: "subscriber",
      subscriberId,
      eventType,
      descriptor,
      manifest,
    },
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

function isJsonObject(value: unknown): value is VoyantGraphJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function compareConventions(
  left: ProjectConventionFileContribution,
  right: ProjectConventionFileContribution,
): number {
  return compareStrings(left.sourcePath, right.sourcePath) || compareStrings(left.id, right.id)
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
