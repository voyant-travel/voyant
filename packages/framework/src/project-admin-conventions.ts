import { readFile, realpath } from "node:fs/promises"
import path from "node:path"

import ts, { loadTypeScript } from "./lazy-typescript.js"
import type { ProjectConventionContribution } from "./project-conventions.js"

export const VOYANT_PROJECT_ADMIN_GENERATED_FILE = "admin/project-admin.generated.ts" as const

export const PROJECT_ADMIN_CONVENTION_DIAGNOSTIC_CODES = {
  PROJECT_ADMIN_DUPLICATE_EXTENSION_ID:
    "Two project admin entries statically declare the same AdminExtension ID.",
  PROJECT_ADMIN_DUPLICATE_ENTRY: "Multiple source files were supplied for one project admin entry.",
  PROJECT_ADMIN_INVALID_ENTRY_PATH:
    "A project admin source is outside the supported src/admin/<name>/index.ts[x] convention.",
  PROJECT_ADMIN_MISSING_DEFAULT_EXPORT: "A project admin entry has no default export.",
} as const

export type ProjectAdminConventionDiagnosticCode =
  keyof typeof PROJECT_ADMIN_CONVENTION_DIAGNOSTIC_CODES

export interface ProjectAdminConventionDiagnostic {
  code: ProjectAdminConventionDiagnosticCode
  severity: "error"
  message: string
  sourcePaths: readonly string[]
  extensionId?: string
}

export interface ProjectAdminConventionEntry {
  conventionId: string
  /** Statically known only for direct object literals and defineAdminExtension(...) calls. */
  extensionId?: string
  sourcePath: string
}

export interface AnalyzeProjectAdminConventionsInput {
  projectRoot: string
  contributions: readonly ProjectConventionContribution[]
}

export interface ProjectAdminConventionAnalysis {
  entries: readonly ProjectAdminConventionEntry[]
  diagnostics: readonly ProjectAdminConventionDiagnostic[]
}

export interface ProjectAdminGeneratedFile {
  path: typeof VOYANT_PROJECT_ADMIN_GENERATED_FILE
  contents: string
}

export interface CompiledProjectAdminConventions {
  entries: readonly ProjectAdminConventionEntry[]
  file: ProjectAdminGeneratedFile
}

export class ProjectAdminConventionError extends Error {
  readonly diagnostics: readonly ProjectAdminConventionDiagnostic[]

  constructor(diagnostics: readonly ProjectAdminConventionDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join("\n"))
    this.name = "ProjectAdminConventionError"
    this.diagnostics = diagnostics
  }
}

/** Analyze project-admin entries without importing or executing project source. */
export async function analyzeProjectAdminConventions(
  input: AnalyzeProjectAdminConventionsInput,
): Promise<ProjectAdminConventionAnalysis> {
  const projectRoot = path.resolve(input.projectRoot)
  const entries: ProjectAdminConventionEntry[] = []
  const diagnostics: ProjectAdminConventionDiagnostic[] = []
  const adminContributions = input.contributions
    .filter((contribution) => contribution.kind === "admin")
    .sort((left, right) => compareStrings(left.sourcePath, right.sourcePath))
  if (adminContributions.length === 0) return { entries, diagnostics }

  await loadTypeScript()
  const realProjectRoot = await realpath(projectRoot)

  for (const contribution of adminContributions) {
    const sourcePath = normalizeProjectPath(contribution.sourcePath)
    if (!isAdminEntryPath(sourcePath)) {
      diagnostics.push(invalidPathDiagnostic(contribution.sourcePath))
      continue
    }

    const absoluteSourcePath = path.resolve(projectRoot, sourcePath)
    if (!isPathInside(projectRoot, absoluteSourcePath)) {
      diagnostics.push(invalidPathDiagnostic(contribution.sourcePath))
      continue
    }

    let realSourcePath: string
    try {
      realSourcePath = await realpath(absoluteSourcePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      diagnostics.push(invalidPathDiagnostic(contribution.sourcePath))
      continue
    }
    if (!isPathInside(realProjectRoot, realSourcePath)) {
      diagnostics.push(invalidPathDiagnostic(contribution.sourcePath))
      continue
    }

    const sourceText = await readFile(realSourcePath, "utf8")
    const sourceFile = ts.createSourceFile(
      sourcePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const defaultExport = findDefaultExport(sourceFile)
    if (!defaultExport) {
      diagnostics.push({
        code: "PROJECT_ADMIN_MISSING_DEFAULT_EXPORT",
        severity: "error",
        sourcePaths: [sourcePath],
        message: `Project admin entry "${sourcePath}" must default-export an AdminExtension.`,
      })
      continue
    }

    const extensionId = findStaticExtensionId(defaultExport, sourceFile)
    entries.push({
      conventionId: contribution.id,
      ...(extensionId ? { extensionId } : {}),
      sourcePath,
    })
  }

  diagnostics.push(...findDuplicateEntryDiagnostics(entries))
  diagnostics.push(...findDuplicateExtensionIdDiagnostics(entries))

  return {
    entries: entries.sort((left, right) => compareStrings(left.sourcePath, right.sourcePath)),
    diagnostics: diagnostics.sort(compareDiagnostics),
  }
}

/** Analyze and generate the deterministic client module consumed by later artifact stages. */
export async function compileProjectAdminConventions(
  input: AnalyzeProjectAdminConventionsInput,
): Promise<CompiledProjectAdminConventions> {
  const analysis = await analyzeProjectAdminConventions(input)
  if (analysis.diagnostics.length > 0) throw new ProjectAdminConventionError(analysis.diagnostics)

  return {
    entries: analysis.entries,
    file: {
      path: VOYANT_PROJECT_ADMIN_GENERATED_FILE,
      contents: generateProjectAdminModule(analysis.entries),
    },
  }
}

export function generateProjectAdminModule(
  entries: readonly ProjectAdminConventionEntry[],
): string {
  const sortedEntries = [...entries].sort((left, right) =>
    compareStrings(left.sourcePath, right.sourcePath),
  )
  const imports = sortedEntries.map((entry, index) => {
    if (!isAdminEntryPath(entry.sourcePath)) {
      throw new Error(`Invalid admin entry: ${entry.sourcePath}`)
    }
    return `import projectAdminExtension${index} from ${JSON.stringify(importSpecifier(entry.sourcePath))}`
  })
  const values = sortedEntries.map((_, index) => `  projectAdminExtension${index},`)

  return [
    "// Generated by @voyant-travel/framework. Do not edit.",
    'import type { AdminExtension } from "@voyant-travel/admin"',
    ...imports,
    "",
    "export const projectAdminExtensions = [",
    ...values,
    "] satisfies readonly AdminExtension[]",
    "",
  ].join("\n")
}

function findDefaultExport(sourceFile: ts.SourceFile): ts.Expression | true | undefined {
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) return statement.expression
    if (
      hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
      hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    ) {
      return true
    }
    if (!ts.isExportDeclaration(statement) || !statement.exportClause) continue
    if (!ts.isNamedExports(statement.exportClause)) continue
    const defaultExport = statement.exportClause.elements.find(
      (element) => element.name.text === "default",
    )
    if (!defaultExport) continue
    if (statement.moduleSpecifier) return true
    return ts.factory.createIdentifier(defaultExport.propertyName?.text ?? defaultExport.name.text)
  }
  return undefined
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return Boolean(
    ts.getModifiers(node as ts.HasModifiers)?.some((modifier) => modifier.kind === kind),
  )
}

function findStaticExtensionId(
  defaultExport: ts.Expression | true,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (defaultExport === true) return undefined
  const expression = resolveExpression(defaultExport, sourceFile, new Set())
  const objectLiteral = ts.isCallExpression(expression)
    ? unwrapExpression(expression.arguments[0])
    : expression
  if (!objectLiteral || !ts.isObjectLiteralExpression(objectLiteral)) return undefined

  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property) || propertyName(property.name) !== "id") continue
    const value = unwrapExpression(property.initializer)
    if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) {
      return value.text
    }
  }
  return undefined
}

function resolveExpression(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  seen: Set<string>,
): ts.Expression {
  const unwrapped = unwrapExpression(expression) ?? expression
  if (!ts.isIdentifier(unwrapped) || seen.has(unwrapped.text)) return unwrapped
  seen.add(unwrapped.text)

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === unwrapped.text &&
        declaration.initializer
      ) {
        return resolveExpression(declaration.initializer, sourceFile, seen)
      }
    }
  }
  return unwrapped
}

function unwrapExpression(expression: ts.Expression | undefined): ts.Expression | undefined {
  let current = expression
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression
  }
  return current
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }
  return undefined
}

function findDuplicateEntryDiagnostics(
  entries: readonly ProjectAdminConventionEntry[],
): ProjectAdminConventionDiagnostic[] {
  return duplicateDiagnostics(
    entries,
    (entry) => entry.conventionId,
    (id, sourcePaths) => ({
      code: "PROJECT_ADMIN_DUPLICATE_ENTRY",
      severity: "error",
      sourcePaths,
      message: `Project admin entry "${id}" has multiple index files: ${formatSources(sourcePaths)}.`,
    }),
  )
}

function findDuplicateExtensionIdDiagnostics(
  entries: readonly ProjectAdminConventionEntry[],
): ProjectAdminConventionDiagnostic[] {
  return duplicateDiagnostics(
    entries.filter((entry): entry is ProjectAdminConventionEntry & { extensionId: string } =>
      Boolean(entry.extensionId),
    ),
    (entry) => entry.extensionId,
    (extensionId, sourcePaths) => ({
      code: "PROJECT_ADMIN_DUPLICATE_EXTENSION_ID",
      severity: "error",
      extensionId,
      sourcePaths,
      message: `AdminExtension ID "${extensionId}" is declared by ${formatSources(sourcePaths)}.`,
    }),
  )
}

function duplicateDiagnostics<T extends { sourcePath: string }>(
  entries: readonly T[],
  keyFor: (entry: T) => string,
  diagnosticFor: (key: string, sourcePaths: string[]) => ProjectAdminConventionDiagnostic,
): ProjectAdminConventionDiagnostic[] {
  const groups = new Map<string, T[]>()
  for (const entry of entries) {
    const key = keyFor(entry)
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return [...groups]
    .filter(([, matches]) => matches.length > 1)
    .map(([key, matches]) =>
      diagnosticFor(key, matches.map((match) => match.sourcePath).sort(compareStrings)),
    )
}

function invalidPathDiagnostic(sourcePath: string): ProjectAdminConventionDiagnostic {
  return {
    code: "PROJECT_ADMIN_INVALID_ENTRY_PATH",
    severity: "error",
    sourcePaths: [sourcePath],
    message: `Project admin source "${sourcePath}" must be a project-confined src/admin/<name>/index.ts or index.tsx file.`,
  }
}

function importSpecifier(sourcePath: string): string {
  return `../../${sourcePath.replace(/\.tsx?$/, ".js")}`
}

function normalizeProjectPath(sourcePath: string): string {
  return sourcePath.split(path.sep).join("/")
}

function isAdminEntryPath(sourcePath: string): boolean {
  return /^src\/admin\/[^/.][^/]*\/index\.tsx?$/.test(sourcePath)
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  )
}

function compareDiagnostics(
  left: ProjectAdminConventionDiagnostic,
  right: ProjectAdminConventionDiagnostic,
): number {
  return (
    compareStrings(left.code, right.code) ||
    compareStrings(left.extensionId ?? "", right.extensionId ?? "") ||
    compareStrings(left.sourcePaths.join("\0"), right.sourcePaths.join("\0"))
  )
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function formatSources(sourcePaths: readonly string[]): string {
  return sourcePaths.map((sourcePath) => `"${sourcePath}"`).join(", ")
}
