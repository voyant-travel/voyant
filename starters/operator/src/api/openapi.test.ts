import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildOperatorOpenApiDocuments } from "./openapi.js"

const OUT_DIR = join(process.cwd(), "openapi")
const docs = await buildOperatorOpenApiDocuments()
const serialize = (document: unknown) => `${JSON.stringify(document, null, 2)}\n`

if (process.env.UPDATE_OPENAPI) {
  mkdirSync(OUT_DIR, { recursive: true })
  for (const [name, document] of Object.entries({
    "framework-openapi.json": docs.full,
    "framework-admin.json": docs.admin,
    "framework-storefront.json": docs.storefront,
  })) {
    writeFileSync(join(OUT_DIR, name), serialize(document))
  }
}

describe("operator openapi spec", () => {
  it("is generated exclusively from selected graph documents", () => {
    expect(docs.full.openapi).toBe("3.1.0")
    expect(docs.modules.size).toBeGreaterThan(0)
  })

  it("keeps deployment surfaces correctly partitioned", () => {
    for (const path of Object.keys(docs.admin.paths ?? {})) {
      expect(path.startsWith("/v1/admin")).toBe(true)
    }
    for (const path of Object.keys(docs.storefront.paths ?? {})) {
      expect(path.startsWith("/v1/public")).toBe(true)
    }
  })

  it("stamps every operation with selected graph ownership", () => {
    const owners = new Map<string, string>()
    for (const [documentName, document] of docs.modules) {
      for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
        for (const [method, operation] of Object.entries(pathItem ?? {})) {
          if (!operation || typeof operation !== "object" || !("responses" in operation)) continue
          const operationKey = `${method.toUpperCase()} ${path}`
          expect(owners.get(operationKey)).toBeUndefined()
          owners.set(operationKey, documentName)
          expect(operation).toHaveProperty("x-voyant-api-id")
          expect(operation).toHaveProperty("x-voyant-unit-id")
          expect(operation).toHaveProperty("x-voyant-package-name")
        }
      }
    }
    expect(owners.size).toBeGreaterThan(0)
  })

  it("keeps every selected operation in the aggregate", () => {
    for (const document of docs.modules.values()) {
      for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
        for (const [method, operation] of Object.entries(pathItem ?? {})) {
          if (!operation || typeof operation !== "object" || !("responses" in operation)) continue
          expect(docs.full.paths?.[path]).toHaveProperty(method)
        }
      }
    }
  })
})
