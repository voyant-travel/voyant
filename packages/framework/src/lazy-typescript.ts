import type TypeScript from "typescript"

type TypeScriptCompiler = typeof import("typescript")

let compiler: TypeScriptCompiler | undefined
let compilerPromise: Promise<TypeScriptCompiler> | undefined

export function loadTypeScript(): Promise<TypeScriptCompiler> {
  compilerPromise ??= import("typescript")
    .then((module) => {
      compiler = module.default
      return compiler
    })
    .catch((cause: unknown) => {
      compilerPromise = undefined
      throw new Error(
        'TypeScript is required to analyze Voyant project source. Install "typescript" as a development dependency before running project compilation.',
        { cause },
      )
    })
  return compilerPromise
}

const ts = new Proxy({} as TypeScriptCompiler, {
  get(_target, property) {
    if (!compiler) {
      throw new Error("TypeScript compiler accessed before loadTypeScript() completed.")
    }
    return Reflect.get(compiler, property, compiler)
  },
})

namespace ts {
  export type BindingName = TypeScript.BindingName
  export type Expression = TypeScript.Expression
  export type HasModifiers = TypeScript.HasModifiers
  export type ImportDeclaration = TypeScript.ImportDeclaration
  export type Node = TypeScript.Node
  export type ObjectLiteralExpression = TypeScript.ObjectLiteralExpression
  export type PropertyName = TypeScript.PropertyName
  export type SourceFile = TypeScript.SourceFile
  export type Statement = TypeScript.Statement
  export type SyntaxKind = TypeScript.SyntaxKind
}

export default ts
