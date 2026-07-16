// agent-quality: file-size exception -- reason: workflow and job convention parsing share one static-analysis contract and diagnostic model; split only through a dedicated parser refactor.
import { readFile, realpath } from "node:fs/promises"
import path from "node:path"
import type {
  VoyantGraphJsonObject,
  VoyantGraphJsonValue,
  VoyantGraphWorkflow,
} from "@voyant-travel/core/project"
import ts, { loadTypeScript } from "./lazy-typescript.js"
import { statementIdentifierName } from "./project-convention-static-data.js"
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

const WORKFLOW_AUTHORING_IMPORTS = new Set([
  "@voyant-travel/framework/project-runtime",
  "@voyant-travel/workflows",
])

export {
  generateProjectJobsSource,
  generateProjectWorkflowsSource,
  PROJECT_JOBS_GENERATED_PATH,
  PROJECT_WORKFLOWS_GENERATED_PATH,
} from "./project-workflow-job-codegen.js"

export const PROJECT_WORKFLOW_JOB_CONVENTION_DIAGNOSTIC_CODES = {
  PROJECT_JOB_ID_COLLISION: "Two job files resolve to the same stable identifier.",
  PROJECT_JOB_IMPORT_ESCAPE: "Job file imports cannot escape the project root.",
  PROJECT_JOB_INVALID_SCHEDULE: "Job schedules must be durable static data.",
  PROJECT_JOB_MISSING_DEFAULT_EXPORT: "Job files must default-export a handler.",
  PROJECT_JOB_MISSING_SCHEDULE_EXPORT: 'Job files must export a named "schedule" value.',
  PROJECT_JOB_UNSUPPORTED_EXPORT:
    'Job files cannot have runtime exports other than "schedule" and default.',
  PROJECT_WORKFLOW_ID_COLLISION: "Two workflow files resolve to the same stable identifier.",
  PROJECT_WORKFLOW_IMPORT_ESCAPE: "Workflow file imports cannot escape the project root.",
  PROJECT_WORKFLOW_INVALID_ID: "Workflow IDs must be non-empty static strings.",
  PROJECT_WORKFLOW_INVALID_SCHEDULE: "Workflow schedules must be durable static data.",
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
  workflowId: string
  config: VoyantGraphJsonObject
}

export interface ProjectJobConvention extends ProjectConventionFileContribution {
  kind: "job"
  schedule: VoyantGraphJsonValue
}

type DiscoveredWorkflowConvention = ProjectConventionFileContribution & { kind: "workflow" }
type DiscoveredJobConvention = ProjectConventionFileContribution & { kind: "job" }

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
  graphWorkflows: readonly VoyantGraphWorkflow[]
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
  await loadTypeScript()
  const projectRoot = path.resolve(options.projectRoot)
  const realProjectRoot = await realpath(projectRoot)
  const discovery = await discoverProjectConventions(projectRoot)
  const discoveredWorkflows = discovery.contributions.filter(
    (contribution): contribution is DiscoveredWorkflowConvention =>
      contribution.kind === "workflow",
  )
  const discoveredJobs = discovery.contributions.filter(
    (contribution): contribution is DiscoveredJobConvention => contribution.kind === "job",
  )
  const workflows: ProjectWorkflowConvention[] = []
  const jobs: ProjectJobConvention[] = []
  const diagnostics: ProjectWorkflowJobConventionDiagnostic[] = [
    ...findIdCollisions(discoveredWorkflows, "workflow"),
    ...findIdCollisions(discoveredJobs, "job"),
  ]

  for (const workflow of discoveredWorkflows) {
    const sourceFile = await readConventionSource(
      projectRoot,
      realProjectRoot,
      workflow.sourcePath,
      "workflow",
      diagnostics,
    )
    if (!sourceFile) continue
    const sourceAnalysis = analyzeWorkflowSource(sourceFile, workflow.sourcePath)
    diagnostics.push(...sourceAnalysis.diagnostics)
    if (sourceAnalysis.workflowId && sourceAnalysis.config) {
      workflows.push({
        ...workflow,
        workflowId: sourceAnalysis.workflowId,
        config: sourceAnalysis.config,
      })
    }
  }

  for (const job of discoveredJobs) {
    const sourceFile = await readConventionSource(
      projectRoot,
      realProjectRoot,
      job.sourcePath,
      "job",
      diagnostics,
    )
    if (!sourceFile) continue
    const sourceAnalysis = analyzeJobSource(sourceFile, job.sourcePath)
    diagnostics.push(...sourceAnalysis.diagnostics)
    if (sourceAnalysis.schedule !== undefined)
      jobs.push({ ...job, schedule: sourceAnalysis.schedule })
  }

  diagnostics.push(...findWorkflowIdCollisions(workflows))
  diagnostics.push(...findWorkflowAndJobIdCollisions(workflows, jobs))
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
    graphWorkflows: [
      ...analysis.workflows.map((workflow, index) => ({
        id: workflow.workflowId,
        config: workflow.config,
        runtime: {
          entry: `./.voyant/${PROJECT_WORKFLOWS_GENERATED_PATH}`,
          export: `projectWorkflow${index}`,
        },
      })),
      ...analysis.jobs.map((job, index) => ({
        id: job.id,
        config: { schedule: job.schedule },
        runtime: {
          entry: `./.voyant/${PROJECT_JOBS_GENERATED_PATH}`,
          export: `projectJobWorkflow${index}`,
        },
      })),
    ],
    generatedFiles: [
      {
        path: PROJECT_WORKFLOWS_GENERATED_PATH,
        contents: generateProjectWorkflowsSource(
          analysis.workflows.map((workflow) => ({
            id: workflow.workflowId,
            sourcePath: workflow.sourcePath,
          })),
        ),
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
): {
  workflowId?: string
  config?: VoyantGraphJsonObject
  diagnostics: ProjectWorkflowJobConventionDiagnostic[]
} {
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
      message: `Workflow file "${sourcePath}" default export must be a direct defineWorkflow(...) call imported from "@voyant-travel/framework/project-runtime" or "@voyant-travel/workflows".`,
    })
  } else {
    const config = workflowConfigExpression(exports.defaultExpression!, sourceFile)
    const constants = collectStaticConstants(sourceFile)
    const workflowId = config ? staticStringProperty(config, "id", constants) : undefined
    if (!workflowId) {
      diagnostics.push({
        code: "PROJECT_WORKFLOW_INVALID_ID",
        severity: "error",
        sourcePaths: [sourcePath],
        message: `Workflow file "${sourcePath}" must declare a non-empty static string id.`,
      })
    }
    const graphConfig = config ? durableWorkflowConfig(config, constants) : undefined
    if (graphConfig === null) {
      diagnostics.push({
        code: "PROJECT_WORKFLOW_INVALID_SCHEDULE",
        severity: "error",
        sourcePaths: [sourcePath],
        message: `Workflow file "${sourcePath}" schedule must be durable static data.`,
      })
    }
    return {
      ...(workflowId ? { workflowId } : {}),
      ...(graphConfig && workflowId ? { config: graphConfig } : {}),
      diagnostics,
    }
  }

  return { diagnostics }
}

function analyzeJobSource(
  sourceFile: ts.SourceFile,
  sourcePath: string,
): {
  schedule?: VoyantGraphJsonValue
  diagnostics: ProjectWorkflowJobConventionDiagnostic[]
} {
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
  const scheduleExpression = findNamedExportExpression(sourceFile, "schedule")
  const durableSchedule = scheduleExpression
    ? toDurableJsonValue(scheduleExpression, collectStaticConstants(sourceFile))
    : undefined
  const schedule =
    durableSchedule !== undefined && isScheduleJsonValue(durableSchedule, false)
      ? durableSchedule
      : undefined
  if (exports.named.includes("schedule") && schedule === undefined) {
    diagnostics.push({
      code: "PROJECT_JOB_INVALID_SCHEDULE",
      severity: "error",
      sourcePaths: [sourcePath],
      exportName: "schedule",
      message: `Job file "${sourcePath}" schedule must be durable static data.`,
    })
  }
  return { ...(schedule !== undefined ? { schedule } : {}), diagnostics }
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
    named.push(statementIdentifierName(statement) ?? "(anonymous)")
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
      !WORKFLOW_AUTHORING_IMPORTS.has(statement.moduleSpecifier.text) ||
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

function workflowConfigExpression(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
): ts.ObjectLiteralExpression | undefined {
  const call = unwrapExpression(expression)
  if (!ts.isCallExpression(call) || call.arguments.length !== 1) return undefined
  const config = resolveStaticExpression(call.arguments[0]!, collectStaticConstants(sourceFile))
  return ts.isObjectLiteralExpression(config) ? config : undefined
}

function durableWorkflowConfig(
  config: ts.ObjectLiteralExpression,
  constants: ReadonlyMap<string, ts.Expression>,
): VoyantGraphJsonObject | null {
  const output: Record<string, VoyantGraphJsonValue> = {}
  for (const property of config.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const name = staticPropertyName(property.name)
    if (!name || name === "id" || name === "run") continue
    const value = toDurableJsonValue(property.initializer, constants)
    if (name === "schedule") {
      if (value === undefined || !isScheduleJsonValue(value, true)) return null
      output.schedule = value
      continue
    }
    if (value !== undefined) output[name] = value
  }
  return output
}

function staticStringProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
  constants: ReadonlyMap<string, ts.Expression>,
): string | undefined {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property) || staticPropertyName(property.name) !== name) continue
    const value = resolveStaticExpression(property.initializer, constants)
    return ts.isStringLiteralLike(value) && value.text.trim() ? value.text.trim() : undefined
  }
  return undefined
}

function collectStaticConstants(sourceFile: ts.SourceFile): Map<string, ts.Expression> {
  const constants = new Map<string, ts.Expression>()
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        constants.set(declaration.name.text, declaration.initializer)
      }
    }
  }
  return constants
}

function findNamedExportExpression(
  sourceFile: ts.SourceFile,
  exportName: string,
): ts.Expression | undefined {
  const constants = collectStaticConstants(sourceFile)
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName) {
          return declaration.initializer
        }
      }
    }
    if (!ts.isExportDeclaration(statement) || !statement.exportClause || statement.moduleSpecifier)
      continue
    if (!ts.isNamedExports(statement.exportClause)) continue
    for (const element of statement.exportClause.elements) {
      if (element.name.text !== exportName) continue
      return constants.get(element.propertyName?.text ?? element.name.text)
    }
  }
  return undefined
}

function toDurableJsonValue(
  expression: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>,
  seen: ReadonlySet<string> = new Set(),
): VoyantGraphJsonValue | undefined {
  const value = unwrapExpression(expression)
  if (ts.isIdentifier(value)) {
    if (value.text === "undefined" || seen.has(value.text)) return undefined
    const initializer = constants.get(value.text)
    if (!initializer) return undefined
    return toDurableJsonValue(initializer, constants, new Set([...seen, value.text]))
  }
  if (ts.isStringLiteralLike(value)) return value.text
  if (ts.isNumericLiteral(value)) return Number(value.text)
  if (value.kind === ts.SyntaxKind.TrueKeyword) return true
  if (value.kind === ts.SyntaxKind.FalseKeyword) return false
  if (value.kind === ts.SyntaxKind.NullKeyword) return null
  if (
    ts.isPrefixUnaryExpression(value) &&
    value.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(value.operand)
  ) {
    return -Number(value.operand.text)
  }
  if (ts.isArrayLiteralExpression(value)) {
    const items: VoyantGraphJsonValue[] = []
    for (const element of value.elements) {
      if (ts.isSpreadElement(element)) return undefined
      const item = toDurableJsonValue(element, constants, seen)
      if (item === undefined) return undefined
      items.push(item)
    }
    return items
  }
  if (ts.isObjectLiteralExpression(value)) {
    const object: Record<string, VoyantGraphJsonValue> = {}
    for (const property of value.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = staticPropertyName(property.name)
        const item = toDurableJsonValue(property.initializer, constants, seen)
        if (!name || item === undefined) return undefined
        object[name] = item
      } else if (ts.isShorthandPropertyAssignment(property)) {
        const item = toDurableJsonValue(property.name, constants, seen)
        if (item === undefined) return undefined
        object[property.name.text] = item
      } else {
        return undefined
      }
    }
    return object
  }
  return undefined
}

function resolveStaticExpression(
  expression: ts.Expression,
  constants: ReadonlyMap<string, ts.Expression>,
): ts.Expression {
  let value = unwrapExpression(expression)
  const seen = new Set<string>()
  while (ts.isIdentifier(value) && !seen.has(value.text)) {
    const initializer = constants.get(value.text)
    if (!initializer) break
    seen.add(value.text)
    value = unwrapExpression(initializer)
  }
  return value
}

function staticPropertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined
}

function isScheduleJsonValue(value: VoyantGraphJsonValue, allowArray: boolean): boolean {
  if (Array.isArray(value))
    return allowArray && value.every((item) => isScheduleJsonValue(item, false))
  if (!isJsonObject(value)) return false
  const triggers = ["cron", "every", "at"].filter((key) => value[key] !== undefined)
  if (triggers.length !== 1) return false
  if (value.cron !== undefined && typeof value.cron !== "string") return false
  if (
    value.every !== undefined &&
    typeof value.every !== "string" &&
    typeof value.every !== "number"
  )
    return false
  if (value.at !== undefined && typeof value.at !== "string") return false
  if (value.timezone !== undefined && typeof value.timezone !== "string") return false
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") return false
  if (
    value.overlap !== undefined &&
    value.overlap !== "skip" &&
    value.overlap !== "queue" &&
    value.overlap !== "allow"
  )
    return false
  if (
    value.environments !== undefined &&
    (!Array.isArray(value.environments) ||
      !value.environments.every(
        (entry) => entry === "production" || entry === "preview" || entry === "development",
      ))
  )
    return false
  return true
}

function isJsonObject(value: VoyantGraphJsonValue): value is VoyantGraphJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
  contributions: readonly ProjectConventionFileContribution[],
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

function findWorkflowIdCollisions(
  workflows: readonly ProjectWorkflowConvention[],
): ProjectWorkflowJobConventionDiagnostic[] {
  const byId = new Map<string, string[]>()
  for (const workflow of workflows) {
    const sourcePaths = byId.get(workflow.workflowId) ?? []
    sourcePaths.push(workflow.sourcePath)
    byId.set(workflow.workflowId, sourcePaths)
  }
  return [...byId.entries()].flatMap(([id, sourcePaths]) =>
    sourcePaths.length < 2
      ? []
      : [
          {
            code: "PROJECT_WORKFLOW_ID_COLLISION" as const,
            severity: "error" as const,
            id,
            sourcePaths: [...sourcePaths].sort(compareStrings),
            message: `Workflow id "${id}" is declared by ${sourcePaths
              .sort(compareStrings)
              .map((sourcePath) => `"${sourcePath}"`)
              .join(", ")}.`,
          },
        ],
  )
}

function findWorkflowAndJobIdCollisions(
  workflows: readonly ProjectWorkflowConvention[],
  jobs: readonly ProjectJobConvention[],
): ProjectWorkflowJobConventionDiagnostic[] {
  const workflowsById = new Map(workflows.map((workflow) => [workflow.workflowId, workflow]))
  return jobs.flatMap((job) => {
    const workflow = workflowsById.get(job.id)
    if (!workflow) return []
    return [
      {
        code: "PROJECT_WORKFLOW_ID_COLLISION" as const,
        severity: "error" as const,
        id: job.id,
        sourcePaths: [workflow.sourcePath, job.sourcePath].sort(compareStrings),
        message: `Workflow and job conventions both declare runtime workflow id "${job.id}".`,
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
