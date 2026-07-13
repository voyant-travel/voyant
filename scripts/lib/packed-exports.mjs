import fs from "node:fs"
import path from "node:path"

import ts from "typescript"

export function packedFileExportsName(extractRoot, filePath, exportName, visited = new Set()) {
  if (visited.has(filePath)) return false
  visited.add(filePath)

  const absolutePath = path.join(extractRoot, filePath)
  if (!fs.existsSync(absolutePath)) return false

  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(absolutePath, "utf8"),
    ts.ScriptTarget.Latest,
    false,
    filePath.endsWith(".d.ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  )

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        if (statement.exportClause.elements.some((element) => element.name.text === exportName)) {
          return true
        }
        continue
      }

      if (!statement.exportClause && ts.isStringLiteral(statement.moduleSpecifier)) {
        const reexportPath = resolveReexportPath(filePath, statement.moduleSpecifier.text)
        if (reexportPath && packedFileExportsName(extractRoot, reexportPath, exportName, visited)) {
          return true
        }
      }
      continue
    }

    if (!hasExportModifier(statement)) continue
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name?.text === exportName
    ) {
      return true
    }
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some((declaration) =>
        bindingNameContains(declaration.name, exportName),
      )
    ) {
      return true
    }
  }

  return false
}

function resolveReexportPath(filePath, specifier) {
  if (!specifier.startsWith(".")) return undefined
  let reexportPath = path.normalize(path.join(path.dirname(filePath), specifier))
  if (filePath.endsWith(".d.ts") && reexportPath.endsWith(".js")) {
    reexportPath = `${reexportPath.slice(0, -3)}.d.ts`
  }
  return reexportPath
}

function hasExportModifier(statement) {
  return statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
}

function bindingNameContains(name, exportName) {
  if (ts.isIdentifier(name)) return name.text === exportName
  return name.elements.some(
    (element) => !ts.isOmittedExpression(element) && bindingNameContains(element.name, exportName),
  )
}
