import path from "node:path"
import ts from "typescript"

export function inspectModuleSpecifiers(
  sourceFile: ts.SourceFile,
  inspect: (specifier: string) => void,
): void {
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      inspect(node.moduleSpecifier.text)
    else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    )
      inspect(node.moduleReference.expression.text)
    else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]!)
    )
      inspect(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

export function resolveInsideProject(projectRoot: string, sourcePath: string): string {
  if (path.isAbsolute(sourcePath))
    throw new Error(`Expected a project-relative path: ${sourcePath}`)
  const resolved = path.resolve(projectRoot, sourcePath)
  if (!isInside(projectRoot, resolved)) throw new Error(`Path escapes project root: ${sourcePath}`)
  return resolved
}

export function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

export function isPathImport(specifier: string): boolean {
  return specifier.startsWith(".") || path.isAbsolute(specifier) || specifier.startsWith("file:")
}

export function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return Boolean(
    ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((item) => item.kind === kind),
  )
}
