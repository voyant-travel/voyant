import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

type PackageExports = Record<string, string | PublishedExport>

interface PublishedExport {
  types: string
  import: string
  default: string
}

interface PackageJson {
  exports: PackageExports
  publishConfig: {
    exports: PackageExports
  }
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const packageJson = JSON.parse(
  readFileSync(path.join(packageRoot, "package.json"), "utf8"),
) as PackageJson

function listSchemaSourceFiles(dir = path.join(packageRoot, "src", "schema")): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const entryPath = path.join(dir, entry)

      if (statSync(entryPath).isDirectory()) {
        return listSchemaSourceFiles(entryPath)
      }

      return entryPath.endsWith(".ts") && entry !== "index.ts" ? [entryPath] : []
    })
    .sort()
}

function schemaExportFor(filePath: string): string {
  const relativePath = path
    .relative(path.join(packageRoot, "src"), filePath)
    .replace(/\.ts$/, "")
    .split(path.sep)
    .join("/")

  return `./${relativePath}`
}

function sourceTargetFor(exportPath: string): string {
  return `./src/${exportPath.slice(2)}.ts`
}

function publishedTargetFor(exportPath: string): PublishedExport {
  const distPath = `./dist/${exportPath.slice(2)}`

  return {
    types: `${distPath}.d.ts`,
    import: `${distPath}.js`,
    default: `${distPath}.js`,
  }
}

describe("@voyantjs/db package schema exports", () => {
  it("exposes the KMS schema through an exact published subpath for Vite/Rollup", () => {
    expect(packageJson.publishConfig.exports["./schema/iam/kms"]).toEqual(
      publishedTargetFor("./schema/iam/kms"),
    )
  })

  it("has exact source and published exports for every concrete schema file", () => {
    for (const filePath of listSchemaSourceFiles()) {
      const exportPath = schemaExportFor(filePath)

      expect(packageJson.exports[exportPath]).toBe(sourceTargetFor(exportPath))
      expect(packageJson.publishConfig.exports[exportPath]).toEqual(publishedTargetFor(exportPath))
    }
  })
})
