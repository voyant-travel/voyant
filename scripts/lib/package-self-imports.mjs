import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import ts from "typescript"

export function sourceImportsOwnPackage(source, ownName, fileName = "source.ts") {
  const scriptKind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    false,
    scriptKind,
  )

  return sourceFile.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) return false
    const specifier = statement.moduleSpecifier
    if (!specifier || !ts.isStringLiteralLike(specifier)) return false
    return specifier.text === ownName || specifier.text.startsWith(`${ownName}/`)
  })
}

export function packageSelfImports(dir, ownName) {
  const stack = [join(dir, "src")]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || !existsSync(current)) continue
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = join(current, entry.name)
      if (entry.isDirectory()) stack.push(file)
      else if (/\.tsx?$/.test(entry.name)) {
        if (sourceImportsOwnPackage(readFileSync(file, "utf8"), ownName, file)) return true
      }
    }
  }
  return false
}
