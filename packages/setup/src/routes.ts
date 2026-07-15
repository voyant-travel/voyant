import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  openApiValidationHook,
  parseJsonBody,
  requireUserId,
  type VoyantDb,
} from "@voyant-travel/hono"

import {
  initializeSetupInputSchema,
  initializeSetupResponseSchema,
  setupStateResponseSchema,
  setupStepIdSchema,
  setupStepResponseSchema,
} from "./contracts.js"
import {
  completeSetupStep,
  createDrizzleSetupStore,
  getSetupState,
  initializeSetup,
  type SetupStore,
  skipSetupStep,
} from "./service.js"

const apiId = "@voyant-travel/setup#api.admin"
type Env = { Bindings: Record<string, unknown>; Variables: { db: VoyantDb; userId?: string } }

export interface CreateSetupRoutesOptions {
  prefill?: Readonly<Record<string, unknown>>
  createStore?: (db: VoyantDb) => SetupStore
}

const jsonContent = <T extends z.ZodTypeAny>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
})
const errorResponse = z.object({ error: z.unknown() })
const errors = {
  400: jsonContent(errorResponse, "Invalid request"),
  401: jsonContent(errorResponse, "Authentication required"),
} as const

const getStateRoute = createRoute({
  method: "get",
  path: "/v1/admin/setup",
  operationId: "getSetupState",
  "x-voyant-api-id": apiId,
  responses: { 200: jsonContent(setupStateResponseSchema, "Setup state"), 401: errors[401] },
})
const initializeRoute = createRoute({
  method: "post",
  path: "/v1/admin/setup/initialize",
  operationId: "initializeSetup",
  "x-voyant-api-id": apiId,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: initializeSetupInputSchema } },
    },
  },
  responses: {
    200: jsonContent(initializeSetupResponseSchema, "Initialized setup state"),
    ...errors,
  },
})
const stepParams = z.object({
  stepId: setupStepIdSchema.openapi({ param: { name: "stepId", in: "path" } }),
})
const completeRoute = createRoute({
  method: "post",
  path: "/v1/admin/setup/steps/{stepId}/complete",
  operationId: "completeSetupStep",
  "x-voyant-api-id": apiId,
  request: { params: stepParams },
  responses: { 200: jsonContent(setupStepResponseSchema, "Completed setup step"), ...errors },
})
const skipRoute = createRoute({
  method: "post",
  path: "/v1/admin/setup/steps/{stepId}/skip",
  operationId: "skipSetupStep",
  "x-voyant-api-id": apiId,
  request: { params: stepParams },
  responses: { 200: jsonContent(setupStepResponseSchema, "Skipped setup step"), ...errors },
})

export function createSetupRoutes(options: CreateSetupRoutesOptions = {}) {
  const app = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  const store = (db: VoyantDb) => (options.createStore ?? createDrizzleSetupStore)(db)
  const prefill = options.prefill ?? {}

  app.openapi(getStateRoute, async (c) => {
    requireUserId(c)
    return c.json({ data: await getSetupState(store(c.get("db")), prefill) }, 200)
  })
  app.openapi(initializeRoute, async (c) => {
    requireUserId(c)
    const input = await parseJsonBody(c, initializeSetupInputSchema)
    return c.json({ data: await initializeSetup(store(c.get("db")), input, prefill) }, 200)
  })
  app.openapi(completeRoute, async (c) => {
    requireUserId(c)
    return c.json(
      { data: await completeSetupStep(store(c.get("db")), c.req.valid("param").stepId) },
      200,
    )
  })
  app.openapi(skipRoute, async (c) => {
    requireUserId(c)
    return c.json(
      { data: await skipSetupStep(store(c.get("db")), c.req.valid("param").stepId) },
      200,
    )
  })
  return app
}
