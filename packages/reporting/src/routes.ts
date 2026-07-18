import { OpenAPIHono } from "@hono/zod-openapi"
import {
  ForbiddenApiError,
  openApiValidationHook,
  parseJsonBody,
  parseQuery,
  RequestValidationError,
} from "@voyant-travel/hono"
import {
  createReportDefinitionSchema,
  createReportVersionSchema,
  executeReportVersionSchema,
  instantiateReportTemplateSchema,
  listReportDefinitionsQuerySchema,
  parseReportQuery,
  parseReportQuerySourceSchema,
  previewReportQuerySchema,
  ReportQuerySyntaxError,
  updateReportDefinitionSchema,
} from "@voyant-travel/reporting-contracts"
import { hasApiKeyPermission, permissionStringsToPermissions } from "@voyant-travel/types/api-keys"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import type { ReportingRegistry } from "./registry.js"
import {
  createReportingService,
  ReportDefinitionRevisionConflictError,
  ReportingRecordNotFoundError,
} from "./service.js"

type Env = {
  Variables: { db: PostgresJsDatabase; userId?: string; scopes?: string[] }
}

export function createReportingRoutes(registry: ReportingRegistry) {
  const routes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  const service = createReportingService(registry)

  routes.get("/catalog", (c) => {
    requireReportsPermission(c.get("scopes"), "read")
    return c.json({ data: registry.catalog() })
  })

  routes.post("/queries/parse", async (c) => {
    requireReportsPermission(c.get("scopes"), "read")
    const input = await parseJsonBody(c, parseReportQuerySourceSchema)
    try {
      return c.json({ data: parseReportQuery(input.source) })
    } catch (error) {
      if (error instanceof ReportQuerySyntaxError) throw new RequestValidationError(error.message)
      throw error
    }
  })

  routes.post("/queries/preview", async (c) => {
    requireReportsPermission(c.get("scopes"), "read")
    const input = await parseJsonBody(c, previewReportQuerySchema)
    const data = await registry.executeQuery({
      db: c.get("db"),
      actorId: c.get("userId"),
      grantedScopes: c.get("scopes") ?? [],
      query: input.query,
      parameters: input.parameters,
    })
    return c.json({ data })
  })

  routes.get("/reports", async (c) => {
    requireReportsPermission(c.get("scopes"), "read")
    const query = parseQuery(c, listReportDefinitionsQuerySchema)
    return c.json(await service.list(c.get("db"), query))
  })

  routes.post("/reports", async (c) => {
    requireReportsPermission(c.get("scopes"), "write")
    const input = await parseJsonBody(c, createReportDefinitionSchema)
    return c.json({ data: await service.create(c.get("db"), input, c.get("userId")) }, 201)
  })

  routes.get("/reports/:id", async (c) => {
    requireReportsPermission(c.get("scopes"), "read")
    const report = await service.get(c.get("db"), c.req.param("id"))
    return report ? c.json({ data: report }) : c.json({ error: "report_not_found" }, 404)
  })

  routes.patch("/reports/:id", async (c) => {
    requireReportsPermission(c.get("scopes"), "write")
    const input = await parseJsonBody(c, updateReportDefinitionSchema)
    try {
      const report = await service.update(c.get("db"), c.req.param("id"), input, c.get("userId"))
      return c.json({ data: report })
    } catch (error) {
      return reportingErrorResponse(c, error)
    }
  })

  routes.delete("/reports/:id", async (c) => {
    requireReportsPermission(c.get("scopes"), "write")
    return (await service.remove(c.get("db"), c.req.param("id")))
      ? c.json({ success: true })
      : c.json({ error: "report_not_found" }, 404)
  })

  routes.post("/templates/:id/instantiate", async (c) => {
    requireReportsPermission(c.get("scopes"), "write")
    const input = await parseJsonBody(c, instantiateReportTemplateSchema)
    try {
      const report = await service.instantiateTemplate(
        c.get("db"),
        { templateId: c.req.param("id"), ...input },
        c.get("userId"),
      )
      return c.json({ data: report }, 201)
    } catch (error) {
      return reportingErrorResponse(c, error)
    }
  })

  routes.post("/reports/:id/versions", async (c) => {
    requireReportsPermission(c.get("scopes"), "write")
    const input = await parseJsonBody(c, createReportVersionSchema)
    try {
      const version = await service.createVersion(
        c.get("db"),
        c.req.param("id"),
        input.expectedRevision,
        c.get("userId"),
      )
      return c.json({ data: version }, 201)
    } catch (error) {
      return reportingErrorResponse(c, error)
    }
  })

  routes.post("/versions/:id/runs", async (c) => {
    requireReportsPermission(c.get("scopes"), "export")
    const input = await parseJsonBody(c, executeReportVersionSchema)
    try {
      const run = await service.runVersion(c.get("db"), c.req.param("id"), input.parameters, {
        actorId: c.get("userId"),
        grantedScopes: c.get("scopes") ?? [],
      })
      return c.json({ data: run }, 201)
    } catch (error) {
      return reportingErrorResponse(c, error)
    }
  })

  routes.get("/runs/:id", async (c) => {
    requireReportsPermission(c.get("scopes"), "read")
    const run = await service.getRun(c.get("db"), c.req.param("id"))
    return run ? c.json({ data: run }) : c.json({ error: "report_run_not_found" }, 404)
  })

  return routes
}

function requireReportsPermission(
  scopes: string[] | undefined,
  action: "read" | "write" | "export",
): void {
  if (!hasApiKeyPermission(permissionStringsToPermissions(scopes ?? []), "reports", action)) {
    throw new ForbiddenApiError()
  }
}

function reportingErrorResponse(c: Context, error: unknown) {
  if (error instanceof ReportingRecordNotFoundError) return c.json({ error: "not_found" }, 404)
  if (error instanceof ReportDefinitionRevisionConflictError) {
    return c.json({ error: "revision_conflict" }, 409)
  }
  throw error
}
