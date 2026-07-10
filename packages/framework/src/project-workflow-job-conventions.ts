import { readFile, realpath } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"

import {
  discoverProjectConventions,
  type ProjectConventionFileContribution,
} from "./project-conventions.js"
import {
  generateProjectJobsSource,
  generateProjectWorkflowsSource,
  PROJECT_JOBS_GENERATED_PATH,
  PROJECT_WORKFLOWS_GENERATED_PATH,
} from "./project-workflow-job-codegen.js"

export {
  generateProjectJobsSource,
  generateProjectWorkflowsSource,
  PROJECT_JOBS_GENERATED_PATH,
  PROJECT_WORKFLOWS_GENERATED_PATH,
} from "./project-workflow-job-codegen.js"

export const PROJECT_WORKFLOW_JOB_CONVENTION_DIAGNOSTIC_CODES = {
  PROJECT_JOB_ID_COLLISION: "Two job files resolve to the same stable identifier.",
  PROJECT_JOB_IMPORT_ESCAPE: "Job file imports cannot escape the project root.",
  PROJECT_JOB_MISSING_DEFAULT_EXPORT: "Job files must default-export a handler.",
  PROJECT_JOB_MISSING_SCHEDULE_EXPORT: 'Job files must export a named "schedule" value.',
  PROJECT_JOB_UNSUPPORTED_EXPORT:
    'Job files cannot have runtime exports other than "schedule" and default.',
  PROJECT_WORKFLOW_ID_COLLISION: "Two workflow files resolve to the same stable identifier.",
  PROJECT_WORKFLOW_IMPORT_ESCAPE: "Workflow file imports cannot escape the project root.",
  PROJECT_WORKFLOW_INVALID_DEFAULT_EXPORT:
    "Workflow files must directly default-export a pure defineWorkflow definition.",
  PROJECT_WORKFLOW_MISSING_DEFAULT_EXPORT:
    "Workflow files must default-export a pure defineWorkflow definition.",
  PROJECT_WORKFLOW_UNSUPPORTED_EXPORT: "Workflow files cannot have named runtime exports.",
} as const

export type ProjectWorkflowJobConventionDiagnosticCode =
  keyof typeof PROJECT_WORKFLOW_JOB_CONVENTION_DIAGNOSTIC_CODES

export interface ProjectWorkflowJobConventionDiagnostic {
  code: ProjectWorkflowJobConventionDiagnosticCode
  severity: "error"
  message: string
  sourcePaths: readonly string[]
  exportName?: string
  id?: string
  specifier?: string
}

export interface ProjectWorkflowConvention extends ProjectConventionFileContribution {
  kind: "workflow"
}

export interface ProjectJobConvention extends ProjectConventionFileContribution {
  kind: "job"
}

export interface ProjectWorkflowJobConventionAnalysis {
  workflows: readonly ProjectWorkflowConvention[]
  jobs: readonly ProjectJobConvention[]
  diagnostics: readonly ProjectWorkflowJobConventionDiagnostic[]
}

export interface ProjectWorkflowJobGeneratedFile {
  path: typeof PROJECT_WORKFLOWS_GENERATED_PATH | typeof PROJECT_JOBS_GENERATED_PATH
  contents: string
}

export interface ProjectWorkflowJobConventionCompilation {
  workflows: readonly ProjectWorkflowConvention[]
  jobs: readonly ProjectJobConvention[]
  generatedFiles: readonly [ProjectWorkflowJobGeneratedFile, ProjectWorkflowJobGeneratedFile]
}

export interface ProjectWorkflowJobConventionsOptions {
  projectRoot: string
}

export class ProjectWorkflowJobConventionError extends Error {
  readonly diagnostics: readonly ProjectWorkflowJobConventionDiagnostic[]

  constructor(diagnostics: readonly ProjectWorkflowJobConventionDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join("\n"))
    this.name = "ProjectWorkflowJobConventionError"
    this.diagnostics = diagnostics
  }
}

export async function analyzeProjectWorkflowJobConventions(
  options: ProjectWorkflowJobConventionsOptions,
): Promise<ProjectWorkflowJobConventionAnalysis> {
  const projectRoot = path.resolve(options.projectRoot)
  const realProjectRoot = await realpath(projectRoot)
  const discovery = await discoverProjectConventions(projectRoot)
  const workflows = discovery.contributions.filter(
    (contribution): contribution is ProjectWorkflowConvention => contribution.kind === "workflow",
  )
  const jobs = discovery.contributions.filter(
    (contribution): contribution is ProjectJobConvention => contribution.kind === "job",
  )
  const diagnostics: ProjectWorkflowJobConventionDiagnostic[] = [
    ...findIdCollisions(workflows, "workflow"),
    ...findIdCollisions(jobs, "job"),
  ]

  for (const workflow of workflows) {
    const sourceFile = await readConventionSource(
      projectRoot,
      realProjectRoot,
      workflow.sourcePath,
      "workflow",
      diagnostics,
    )
    if (sourceFile) diagnostics.push(...analyzeWorkflowSource(sourceFile, workflow.sourcePath))
  }

  for (const job of jobs) {
    const sourceFile = await readConventionSource(
      projectRoot,
      realProjectRoot,
      job.sourcePath,
      "job",
      diagnostics,
    )
    if (sourceFile) diagnostics.push(...analyzeJobSource(sourceFile, job.sourcePath))
  }

  workflows.sort(compareContributions)
  jobs.sort(compareContributions)
  diagnostics.sort(compareDiagnostics)
  return { workflows, jobs, diagnostics }
}

export async function compileProjectWorkflowJobConventions(
  options: ProjectWorkflowJobConventionsOptions,
): Promise<ProjectWorkflowJobConventionCompilation> {
  const analysis = await analyzeProjectWorkflowJobConventions(options)
  if (analysis.diagnostics.length > 0) {
    throw new ProjectWorkflowJobConventionError(analysis.diagnostics)
  }

  return {
    workflows: analysis.workflows,
    jobs: analysis.jobs,
    generatedFiles: [
      {
        path: PROJECT_WORKFLOWS_GENERATED_PATH,
        contents: generateProjectWorkflowsSource(analysis.workflows),
      },
      {
        path: PROJECT_JOBS_GENERATED_PATH,
        contents: generateProjectJobsSource(analysis.jobs),
      },
    ],
  }
}

async function readConventionSource(
  projectRoot: string,
  realProjectRoot: string,
  sourcePath: string,
  kind: "workflow" | "job",
  diagnostics: ProjectWorkflowJobConventionDiagnostic[],
): Promise<ts.SourceFile | undefined> {
  const sourceFilePath = resolveInsideProject(projectRoot, sourcePath)
  const realSourceFilePath = await realpath(sourceFilePath)
  if (!isInside(realProjectRoot, realSourceFilePath)) {
    diagnostics.push(importEscapeDiagnostic(kind, sourcePath, sourcePath))
    return undefined
  }

  const source = await readFile(realSourceFilePath, "utf8")
  const sourceFile = ts.createSourceFile(
    realSourceFilePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  inspectModuleSpecifiers(sourceFile, (specifier) => {
    if (!isPathImport(specifier)) return
    if (specifier.startsWith("file:")) {
      diagnostics.push(importEscapeDiagnostic(kind, sourcePath, specifier))
      return
    }
    const resolved = path.resolve(path.dirname(sourceFile.fileName), specifier)
    if (!isInside(projectRoot, resolved)) {
      diagnostics.push(importEscapeDiagnostic(kind, sourcePath, specifier))
    }
  })
  return sourceFile
}

function analyzeWorkflowSource(
  sourceFile: ts.SourceFile,
  sourcePath: string,
): ProjectWorkflowJobConventionDiagnostic[] {
  const exports = collectRuntimeExports(sourceFile)
  const diagnostics = exports.named.map((exportName) =>
    unsupportedExportDiagnostic("workflow", sourcePath, exportName),
  )

  if (!exports.hasDefault) {
    diagnostics.push({
      code: "PROJECT_WORKFLOW_MISSING_DEFAULT_EXPORT",
      severity: "error",
      sourcePaths: [sourcePath],
      exportName: "default",
      message: `Workflow file "${sourcePath}" must default-export defineWorkflow(...).`,
    })
  } else if (!isDirectDefineWorkflowExport(exports.defaultExpression, sourceFile)) {
    diagnostics.push({
      code: "PROJECT_WORKFLOW_INVALID_DEFAULT_EXPORT",
      severity: "error",
      sourcePaths: [sourcePath],
      exportName: "default",
      message: `Workflow file "${sourcePath}" default export must be a direct defineWorkflow(...) call imported from "@voyant-travel/workflows".`,
    })
  }

  return diagnostics
}

function analyzeJobSource(
  sourceFile: ts.SourceFile,
  sourcePath: string,
): ProjectWorkflowJobConventionDiagnostic[] {
  const exports = collectRuntimeExports(sourceFile)
  const diagnostics = exports.named
    .filter((exportName) => exportName !== "schedule")
    .map((exportName) => unsupportedExportDiagnostic("job", sourcePath, exportName))

  if (!exports.hasDefault) {
    diagnostics.push({
      code: "PROJECT_JOB_MISSING_DEFAULT_EXPORT",
      severity: "error",
      sourcePaths: [sourcePath],
      exportName: "default",
      message: `Job file "${sourcePath}" must default-export its handler.`,
    })
  }
  if (!exports.named.includes("schedule")) {
    diagnostics.push({
      code: "PROJECT_JOB_MISSING_SCHEDULE_EXPORT",
      severity: "error",
      sourcePaths: [sourcePath],
      exportName: "schedule",
      message: `Job file "${sourcePath}" must export a named "schedule" value.`,
    })
  }
  return diagnostics
}

interface RuntimeExports {
  hasDefault: boolean
  defaultExpression?: ts.Expression
  named: string[]
}

function collectRuntimeExports(sourceFile: ts.SourceFile): RuntimeExports {
  let hasDefault = false
  let defaultExpression: ts.Expression | undefined
  const named: string[] = []

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      hasDefault = true
      if (!statement.isExportEquals) defaultExpression = statement.expression
      continue
    }
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) {
        if (!statement.isTypeOnly) named.push("*")
        continue
      }
      if (!ts.isNamedExports(statement.exportClause)) continue
      for (const element of statement.exportClause.elements) {
        if (statement.isTypeOnly || element.isTypeOnly) continue
        if (element.name.text === "default") hasDefault = true
        else named.push(element.name.text)
      }
      continue
    }
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      hasDefault = true
      continue
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        named.push(...bindingNames(declaration.name))
      }
      continue
    }
    named.push("name" in statement && statement.name ? statement.name.text : "(anonymous)")
  }
  return { hasDefault, defaultExpression, named: [...new Set(named)].sort(compareStrings) }
}

function isDirectDefineWorkflowExport(
  expression: ts.Expression | undefined,
  sourceFile: ts.SourceFile,
): boolean {
  if (!expression) return false
  const unwrapped = unwrapExpression(expression)
  if (!ts.isCallExpression(unwrapped) || !ts.isIdentifier(unwrapped.expression)) return false
  const localName = unwrapped.expression.text

  return sourceFile.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== "@voyant-travel/workflows" ||
      !statement.importClause ||
      statement.importClause.isTypeOnly ||
      !statement.importClause.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      return false
    }
    return statement.importClause.namedBindings.elements.some(
      (element) =>
        !element.isTypeOnly &&
        (element.propertyName?.text ?? element.name.text) === "defineWorkflow" &&
        element.name.text === localName,
    )
  })
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function findIdCollisions(
  contributions: readonly (ProjectWorkflowConvention | ProjectJobConvention)[],
  kind: "workflow" | "job",
): ProjectWorkflowJobConventionDiagnostic[] {
  const byId = new Map<string, string[]>()
  for (const contribution of contributions) {
    const sourcePaths = byId.get(contribution.id)
    if (sourcePaths) sourcePaths.push(contribution.sourcePath)
    else byId.set(contribution.id, [contribution.sourcePath])
  }
  return [...byId.entries()].flatMap(([id, sourcePaths]) => {
    if (sourcePaths.length < 2) return []
    const sorted = [...sourcePaths].sort(compareStrings)
    const label = kind === "workflow" ? "Workflow" : "Job"
    return [
      {
        code: kind === "workflow" ? "PROJECT_WORKFLOW_ID_COLLISION" : "PROJECT_JOB_ID_COLLISION",
        severity: "error" as const,
        id,
        sourcePaths: sorted,
        message: `${label} convention ID "${id}" is produced by ${sorted
          .map((sourcePath) => `"${sourcePath}"`)
          .join(", ")}.`,
      },
    ]
  })
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

function unsupportedExportDiagnostic(
  kind: "workflow" | "job",
  sourcePath: string,
  exportName: string,
): ProjectWorkflowJobConventionDiagnostic {
  const label = kind === "workflow" ? "Workflow" : "Job"
  return {
    code:
      kind === "workflow"
        ? "PROJECT_WORKFLOW_UNSUPPORTED_EXPORT"
        : "PROJECT_JOB_UNSUPPORTED_EXPORT",
    severity: "error",
    sourcePaths: [sourcePath],
    exportName,
    message: `${label} file "${sourcePath}" has unsupported runtime export "${exportName}".`,
  }
}

function importEscapeDiagnostic(
  kind: "workflow" | "job",
  sourcePath: string,
  specifier: string,
): ProjectWorkflowJobConventionDiagnostic {
  const label = kind === "workflow" ? "Workflow" : "Job"
  return {
    code: kind === "workflow" ? "PROJECT_WORKFLOW_IMPORT_ESCAPE" : "PROJECT_JOB_IMPORT_ESCAPE",
    severity: "error",
    sourcePaths: [sourcePath],
    specifier,
    message: `${label} file "${sourcePath}" import "${specifier}" escapes the project root.`,
  }
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

function compareContributions(
  left: ProjectWorkflowConvention | ProjectJobConvention,
  right: ProjectWorkflowConvention | ProjectJobConvention,
): number {
  return compareStrings(left.sourcePath, right.sourcePath) || compareStrings(left.id, right.id)
}

function compareDiagnostics(
  left: ProjectWorkflowJobConventionDiagnostic,
  right: ProjectWorkflowJobConventionDiagnostic,
): number {
  return (
    compareStrings(left.code, right.code) ||
    compareStrings(left.sourcePaths.join("\0"), right.sourcePaths.join("\0")) ||
    compareStrings(left.exportName ?? "", right.exportName ?? "") ||
    compareStrings(left.specifier ?? "", right.specifier ?? "")
  )
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
