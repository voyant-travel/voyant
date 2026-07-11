import type { VoyantGraphRouteMethod } from "@voyant-travel/core/project"
import {
  buildModulePathOwnership,
  type GenerateOpenApiOptions,
  generateOpenApiDocument,
  type LazyMount,
  type ModuleMount,
  mergeLazyOpenApiPaths,
  type OpenApiDocument,
  stampModuleMetadata,
} from "@voyant-travel/hono/openapi"

import { resolveVoyantGraphRouteMountPath } from "./runtime-composition.js"
import type { VoyantGraphRuntime, VoyantGraphRuntimeUnitLoader } from "./runtime-lowering.js"

const HTTP_METHODS = new Set(["delete", "get", "head", "options", "patch", "post", "put", "trace"])

type OpenApiSourceApp = Parameters<typeof generateOpenApiDocument>[0] & {
  lazyMounts?: readonly LazyMount[]
  moduleMounts?: readonly ModuleMount[]
}

export interface BuildSelectedGraphOpenApiDocumentsInput {
  runtime: Pick<VoyantGraphRuntime, "modules" | "extensions" | "plugins">
  app: OpenApiSourceApp
  options: GenerateOpenApiOptions
}

interface OpenApiClaim {
  document: string
  mount: string
  route: VoyantGraphRuntimeUnitLoader["routes"][number]["route"]
  unit: VoyantGraphRuntimeUnitLoader
}

/**
 * Emit one OpenAPI document for each opted-in API bundle in the selected graph.
 * This entry point is build-time only and is intentionally excluded from the
 * framework runtime barrel.
 */
export async function buildSelectedGraphOpenApiDocuments(
  input: BuildSelectedGraphOpenApiDocumentsInput,
): Promise<Map<string, OpenApiDocument>> {
  const eager = generateOpenApiDocument(input.app, input.options)
  const merged = await mergeLazyOpenApiPaths(eager, input.app.lazyMounts ?? [], input.options)
  const ownership = await buildModulePathOwnership(input.app.moduleMounts ?? [], input.options)
  const source = stampModuleMetadata(merged, ownership)
  const claims = collectClaims(input.runtime)
  validateDocumentClaims(claims)

  const claimedOperations = new Map<string, OpenApiClaim>()
  const documents = new Map<string, OpenApiDocument>()
  for (const claim of claims) {
    const paths: Record<string, unknown> = {}
    let operationCount = 0

    for (const [path, pathItem] of Object.entries(source.paths ?? {})) {
      if (!isWithinMount(path, claim.mount) || !isRecord(pathItem)) continue

      const selectedItem: Record<string, unknown> = {}
      let selectedOperationCount = 0
      for (const [key, value] of Object.entries(pathItem)) {
        const method = key.toLowerCase()
        if (!HTTP_METHODS.has(method)) {
          selectedItem[key] = value
          continue
        }
        if (!isRecord(value) || !routeClaimsMethod(claim, method)) continue

        const explicitApiId = value["x-voyant-api-id"]
        if (typeof explicitApiId === "string" && explicitApiId !== claim.route.id) continue

        const operation = `${method.toUpperCase()} ${path}`
        const previous = claimedOperations.get(operation)
        if (previous) {
          throw new Error(
            `Selected graph OpenAPI path "${path}" method "${method.toUpperCase()}" is claimed by both "${previous.route.id}" (${previous.document}) and "${claim.route.id}" (${claim.document}).`,
          )
        }
        claimedOperations.set(operation, claim)

        operationCount += 1
        selectedOperationCount += 1
        selectedItem[key] = {
          ...value,
          "x-voyant-api-id": claim.route.id,
          "x-voyant-unit-id": claim.unit.id,
          "x-voyant-package-name": claim.unit.packageName,
        }
      }

      if (selectedOperationCount === 0) continue
      paths[path] = selectedItem
    }

    if (operationCount === 0) {
      throw new Error(
        `Selected graph OpenAPI bundle "${claim.route.id}" (${claim.document}) matched zero operations at "${claim.mount}".`,
      )
    }

    documents.set(claim.document, { ...source, paths } as OpenApiDocument)
  }

  return documents
}

function collectClaims(
  runtime: Pick<VoyantGraphRuntime, "modules" | "extensions" | "plugins">,
): OpenApiClaim[] {
  return [...runtime.modules, ...runtime.extensions, ...runtime.plugins]
    .flatMap((unit) =>
      unit.routes.flatMap(({ route }) =>
        route.openapi
          ? [
              {
                document: route.openapi.document,
                mount: resolveVoyantGraphRouteMountPath(unit, route),
                route,
                unit,
              },
            ]
          : [],
      ),
    )
    .sort(
      (left, right) =>
        left.document.localeCompare(right.document) || left.route.id.localeCompare(right.route.id),
    )
}

function validateDocumentClaims(claims: readonly OpenApiClaim[]): void {
  const byDocument = new Map<string, OpenApiClaim>()
  for (const claim of claims) {
    const previous = byDocument.get(claim.document)
    if (previous) {
      throw new Error(
        `Selected graph OpenAPI document "${claim.document}" is claimed by both "${previous.route.id}" and "${claim.route.id}".`,
      )
    }
    byDocument.set(claim.document, claim)
  }
}

function routeClaimsMethod(claim: OpenApiClaim, method: string): boolean {
  return (
    !claim.route.methods ||
    claim.route.methods.includes(method.toUpperCase() as VoyantGraphRouteMethod)
  )
}

function isWithinMount(path: string, mount: string): boolean {
  return mount === "/" || path === mount || path.startsWith(`${mount}/`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
