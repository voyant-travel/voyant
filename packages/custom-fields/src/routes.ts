import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  customFieldDefinitionInputSchema,
  customFieldDefinitionListQuerySchema,
  customFieldTypeSchema,
  updateCustomFieldDefinitionSchema,
} from "./contracts.js"
import { createCustomFieldsService } from "./service.js"
import type { CustomFieldTarget } from "./targets.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
  }
}

const definitionSchema = customFieldDefinitionInputSchema.extend({
  id: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})

const idParamSchema = z.object({ id: z.string() })
const errorSchema = z.object({ error: z.string() })
const successSchema = z.object({ success: z.literal(true) })
const targetSchema = z.object({
  id: z.string(),
  label: z.string(),
  fieldTypes: z.array(customFieldTypeSchema),
  capabilities: z.array(z.enum(["read", "write", "search", "export", "invoice", "presentation"])),
  ownerUnitId: z.string(),
})

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { "application/json": { schema } },
})

const requiredJsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: {
    required: true,
    content: { "application/json": { schema } },
  },
})

export function createCustomFieldRoutes(
  targets: ReadonlyMap<string, CustomFieldTarget>,
  options: { includeTargets?: boolean } = {},
) {
  const service = createCustomFieldsService(targets)
  const routes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })

  if (options.includeTargets !== false) {
    routes.openapi(
      createRoute({
        method: "get",
        path: "/targets",
        responses: {
          200: {
            description: "Selected custom-field target registry",
            ...jsonContent(z.object({ data: z.array(targetSchema) })),
          },
        },
      }),
      async (c) =>
        c.json(
          {
            data: [...targets.values()].map((target) => ({
              ...target,
              fieldTypes: [...target.fieldTypes],
              capabilities: [...target.capabilities],
            })),
          },
          200,
        ),
    )
  }

  routes.openapi(
    createRoute({
      method: "get",
      path: "/",
      request: { query: customFieldDefinitionListQuerySchema },
      responses: {
        200: {
          description: "Selected-target custom-field definitions",
          ...jsonContent(
            z.object({
              data: z.array(definitionSchema),
              total: z.number(),
              limit: z.number(),
              offset: z.number(),
            }),
          ),
        },
      },
    }),
    async (c) => c.json(await service.list(c.get("db"), c.req.valid("query")), 200),
  )

  routes.openapi(
    createRoute({
      method: "post",
      path: "/",
      request: requiredJsonBody(customFieldDefinitionInputSchema),
      responses: {
        201: {
          description: "Created custom-field definition",
          ...jsonContent(z.object({ data: definitionSchema })),
        },
        400: {
          description: "Unsupported target or field type",
          ...jsonContent(errorSchema),
        },
        409: {
          description: "Duplicate custom-field key",
          ...jsonContent(errorSchema),
        },
      },
    }),
    async (c) => c.json({ data: await service.create(c.get("db"), c.req.valid("json")) }, 201),
  )

  routes.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      request: { params: idParamSchema },
      responses: {
        200: {
          description: "Custom-field definition",
          ...jsonContent(z.object({ data: definitionSchema })),
        },
        404: {
          description: "Custom-field definition not found",
          ...jsonContent(errorSchema),
        },
      },
    }),
    async (c) => {
      const row = await service.get(c.get("db"), c.req.valid("param").id)
      return row ? c.json({ data: row }, 200) : c.json({ error: "Custom field not found" }, 404)
    },
  )

  routes.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      request: {
        params: idParamSchema,
        ...requiredJsonBody(updateCustomFieldDefinitionSchema),
      },
      responses: {
        200: {
          description: "Updated custom-field definition",
          ...jsonContent(z.object({ data: definitionSchema })),
        },
        404: {
          description: "Custom-field definition not found",
          ...jsonContent(errorSchema),
        },
      },
    }),
    async (c) => {
      const row = await service.update(c.get("db"), c.req.valid("param").id, c.req.valid("json"))
      return row ? c.json({ data: row }, 200) : c.json({ error: "Custom field not found" }, 404)
    },
  )

  routes.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      request: { params: idParamSchema },
      responses: {
        200: {
          description: "Deleted custom-field definition",
          ...jsonContent(successSchema),
        },
        404: {
          description: "Custom-field definition not found",
          ...jsonContent(errorSchema),
        },
      },
    }),
    async (c) => {
      const row = await service.remove(c.get("db"), c.req.valid("param").id)
      return row
        ? c.json({ success: true } as const, 200)
        : c.json({ error: "Custom field not found" }, 404)
    },
  )

  return routes
}
