// agent-quality: file-size exception -- owner: bookings; this vocabulary-only migration preserves the existing booking-requirements route surface until a dedicated split can preserve its child-route ordering and OpenAPI output.
/**
 * Admin routes for booking requirements — mounted (legacy surface) at
 * `/v1/booking-requirements` by the framework composition's
 * `createBookingRequirementsApiModule`. Covers eight resource sub-chains:
 * contact-requirements, product booking questions, option booking questions,
 * question options, unit/option/extra triggers, and answers.
 *
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2114).
 * Request schemas reuse the existing `validation.ts` schemas the handlers
 * already parse; list responses use the framework's canonical
 * `listResponseSchema(...)` envelope; response row schemas are authored from
 * the Drizzle `$inferSelect` shapes (§17: timestamp columns serialize to ISO
 * strings over the wire). The business logic + service wiring are unchanged.
 *
 * The routes are split into per-resource child `OpenAPIHono` sub-chains
 * (`.route("/", child)`) rather than one long flat `.openapi()` chain to keep
 * the tsc inference cost linear.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import { listResponseSchema } from "@voyant-travel/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { bookingRequirementsService } from "./service.js"
import {
  bookingAnswerListQuerySchema,
  bookingAnswerTargetSchema,
  bookingQuestionExtraTriggerListQuerySchema,
  bookingQuestionFieldTypeSchema,
  bookingQuestionOptionListQuerySchema,
  bookingQuestionOptionTriggerListQuerySchema,
  bookingQuestionTargetSchema,
  bookingQuestionTriggerModeSchema,
  bookingQuestionUnitTriggerListQuerySchema,
  contactRequirementFieldSchema,
  contactRequirementScopeSchema,
  insertBookingAnswerSchema,
  insertBookingQuestionExtraTriggerSchema,
  insertBookingQuestionOptionSchema,
  insertBookingQuestionOptionTriggerSchema,
  insertBookingQuestionUnitTriggerSchema,
  insertOptionBookingQuestionSchema,
  insertProductBookingQuestionSchema,
  insertProductContactRequirementSchema,
  optionBookingQuestionListQuerySchema,
  productBookingQuestionListQuerySchema,
  productContactRequirementListQuerySchema,
  updateBookingAnswerSchema,
  updateBookingQuestionExtraTriggerSchema,
  updateBookingQuestionOptionSchema,
  updateBookingQuestionOptionTriggerSchema,
  updateBookingQuestionUnitTriggerSchema,
  updateOptionBookingQuestionSchema,
  updateProductBookingQuestionSchema,
  updateProductContactRequirementSchema,
} from "./validation.js"

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

// --- shared response building blocks --------------------------------------
// Authored from the Drizzle `$inferSelect` shapes; §17: timestamp columns are
// ISO strings on the wire.

const isoTimestamp = z.string()
const errorResponseSchema = z.object({ error: z.string() })
const deleteResponseSchema = z.object({ success: z.boolean() })
const idParamSchema = z.object({ id: z.string() })

// --- row response schemas (from $inferSelect) ------------------------------

const productContactRequirementSchema = z.object({
  id: z.string(),
  productId: z.string(),
  optionId: z.string().nullable(),
  fieldKey: contactRequirementFieldSchema,
  scope: contactRequirementScopeSchema,
  isRequired: z.boolean(),
  perTraveler: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const productBookingQuestionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  code: z.string().nullable(),
  label: z.string(),
  description: z.string().nullable(),
  target: bookingQuestionTargetSchema,
  fieldType: bookingQuestionFieldTypeSchema,
  placeholder: z.string().nullable(),
  helpText: z.string().nullable(),
  isRequired: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const optionBookingQuestionSchema = z.object({
  id: z.string(),
  optionId: z.string(),
  productBookingQuestionId: z.string(),
  isRequiredOverride: z.boolean().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const bookingQuestionOptionSchema = z.object({
  id: z.string(),
  productBookingQuestionId: z.string(),
  value: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
  isDefault: z.boolean(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const bookingQuestionUnitTriggerSchema = z.object({
  id: z.string(),
  productBookingQuestionId: z.string(),
  unitId: z.string(),
  triggerMode: bookingQuestionTriggerModeSchema,
  minQuantity: z.number().int().nullable(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const bookingQuestionOptionTriggerSchema = z.object({
  id: z.string(),
  productBookingQuestionId: z.string(),
  optionId: z.string(),
  triggerMode: bookingQuestionTriggerModeSchema,
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const bookingQuestionExtraTriggerSchema = z.object({
  id: z.string(),
  productBookingQuestionId: z.string(),
  productExtraId: z.string().nullable(),
  optionExtraConfigId: z.string().nullable(),
  triggerMode: bookingQuestionTriggerModeSchema,
  minQuantity: z.number().int().nullable(),
  active: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

const bookingAnswerSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  productBookingQuestionId: z.string(),
  bookingTravelerId: z.string().nullable(),
  bookingExtraId: z.string().nullable(),
  target: bookingAnswerTargetSchema,
  valueText: z.string().nullable(),
  valueNumber: z.number().int().nullable(),
  valueBoolean: z.boolean().nullable(),
  valueJson: z.union([z.record(z.string(), z.unknown()), z.array(z.string())]).nullable(),
  notes: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

// --- helpers ---------------------------------------------------------------

function jsonBody<S extends z.ZodTypeAny>(schema: S, required: boolean, description: string) {
  return {
    required,
    description,
    content: { "application/json": { schema } },
  }
}

function dataResponse<S extends z.ZodTypeAny>(schema: S, description: string) {
  return {
    description,
    content: { "application/json": { schema: z.object({ data: schema }) } },
  }
}

function listResponse<S extends z.ZodTypeAny>(schema: S, description: string) {
  return {
    description,
    content: { "application/json": { schema: listResponseSchema(schema) } },
  }
}

function notFoundResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: errorResponseSchema } },
  }
}

function deletedResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: deleteResponseSchema } },
  }
}

const invalidRequestResponse = {
  description: "invalid_request — request input failed validation",
  content: { "application/json": { schema: errorResponseSchema } },
}

// --- contact-requirements sub-chain ---------------------------------------

const listContactRequirementsRoute = createRoute({
  method: "get",
  path: "/contact-requirements",
  request: { query: productContactRequirementListQuerySchema },
  responses: {
    200: listResponse(productContactRequirementSchema, "Paginated product contact requirements"),
    400: invalidRequestResponse,
  },
})

const createContactRequirementRoute = createRoute({
  method: "post",
  path: "/contact-requirements",
  request: {
    body: jsonBody(insertProductContactRequirementSchema, true, "Product contact requirement"),
  },
  responses: {
    201: dataResponse(productContactRequirementSchema, "The created product contact requirement"),
    400: invalidRequestResponse,
  },
})

const getContactRequirementRoute = createRoute({
  method: "get",
  path: "/contact-requirements/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(productContactRequirementSchema, "A product contact requirement by id"),
    404: notFoundResponse("Product contact requirement not found"),
  },
})

const updateContactRequirementRoute = createRoute({
  method: "patch",
  path: "/contact-requirements/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(
      updateProductContactRequirementSchema,
      false,
      "Partial product contact requirement update",
    ),
  },
  responses: {
    200: dataResponse(productContactRequirementSchema, "The updated product contact requirement"),
    400: invalidRequestResponse,
    404: notFoundResponse("Product contact requirement not found"),
  },
})

const deleteContactRequirementRoute = createRoute({
  method: "delete",
  path: "/contact-requirements/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The product contact requirement was deleted"),
    404: notFoundResponse("Product contact requirement not found"),
  },
})

const contactRequirementsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listContactRequirementsRoute, async (c) => {
    return c.json(
      await bookingRequirementsService.listProductContactRequirements(
        c.get("db"),
        c.req.valid("query"),
      ),
      200,
    )
  })
  .openapi(createContactRequirementRoute, async (c) => {
    const row = await bookingRequirementsService.createProductContactRequirement(
      c.get("db"),
      c.req.valid("json"),
    )
    if (!row) throw new Error("Failed to create product contact requirement")
    return c.json({ data: row }, 201)
  })
  .openapi(getContactRequirementRoute, async (c) => {
    const row = await bookingRequirementsService.getProductContactRequirementById(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Product contact requirement not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(updateContactRequirementRoute, async (c) => {
    const row = await bookingRequirementsService.updateProductContactRequirement(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Product contact requirement not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteContactRequirementRoute, async (c) => {
    const row = await bookingRequirementsService.deleteProductContactRequirement(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Product contact requirement not found" }, 404)
    return c.json({ success: true }, 200)
  })

// --- product booking questions sub-chain ----------------------------------

const listQuestionsRoute = createRoute({
  method: "get",
  path: "/questions",
  request: { query: productBookingQuestionListQuerySchema },
  responses: {
    200: listResponse(productBookingQuestionSchema, "Paginated product booking questions"),
    400: invalidRequestResponse,
  },
})

const createQuestionRoute = createRoute({
  method: "post",
  path: "/questions",
  request: { body: jsonBody(insertProductBookingQuestionSchema, true, "Product booking question") },
  responses: {
    201: dataResponse(productBookingQuestionSchema, "The created product booking question"),
    400: invalidRequestResponse,
  },
})

const getQuestionRoute = createRoute({
  method: "get",
  path: "/questions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(productBookingQuestionSchema, "A product booking question by id"),
    404: notFoundResponse("Product booking question not found"),
  },
})

const updateQuestionRoute = createRoute({
  method: "patch",
  path: "/questions/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(
      updateProductBookingQuestionSchema,
      false,
      "Partial product booking question update",
    ),
  },
  responses: {
    200: dataResponse(productBookingQuestionSchema, "The updated product booking question"),
    400: invalidRequestResponse,
    404: notFoundResponse("Product booking question not found"),
  },
})

const deleteQuestionRoute = createRoute({
  method: "delete",
  path: "/questions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The product booking question was deleted"),
    404: notFoundResponse("Product booking question not found"),
  },
})

const questionsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listQuestionsRoute, async (c) => {
    return c.json(
      await bookingRequirementsService.listProductBookingQuestions(
        c.get("db"),
        c.req.valid("query"),
      ),
      200,
    )
  })
  .openapi(createQuestionRoute, async (c) => {
    const row = await bookingRequirementsService.createProductBookingQuestion(
      c.get("db"),
      c.req.valid("json"),
    )
    if (!row) throw new Error("Failed to create product booking question")
    return c.json({ data: row }, 201)
  })
  .openapi(getQuestionRoute, async (c) => {
    const row = await bookingRequirementsService.getProductBookingQuestionById(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Product booking question not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(updateQuestionRoute, async (c) => {
    const row = await bookingRequirementsService.updateProductBookingQuestion(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Product booking question not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteQuestionRoute, async (c) => {
    const row = await bookingRequirementsService.deleteProductBookingQuestion(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Product booking question not found" }, 404)
    return c.json({ success: true }, 200)
  })

// --- option booking questions sub-chain -----------------------------------

const listOptionQuestionsRoute = createRoute({
  method: "get",
  path: "/option-questions",
  request: { query: optionBookingQuestionListQuerySchema },
  responses: {
    200: listResponse(optionBookingQuestionSchema, "Paginated option booking questions"),
    400: invalidRequestResponse,
  },
})

const createOptionQuestionRoute = createRoute({
  method: "post",
  path: "/option-questions",
  request: { body: jsonBody(insertOptionBookingQuestionSchema, true, "Option booking question") },
  responses: {
    201: dataResponse(optionBookingQuestionSchema, "The created option booking question"),
    400: invalidRequestResponse,
  },
})

const getOptionQuestionRoute = createRoute({
  method: "get",
  path: "/option-questions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(optionBookingQuestionSchema, "An option booking question by id"),
    404: notFoundResponse("Option booking question not found"),
  },
})

const updateOptionQuestionRoute = createRoute({
  method: "patch",
  path: "/option-questions/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(
      updateOptionBookingQuestionSchema,
      false,
      "Partial option booking question update",
    ),
  },
  responses: {
    200: dataResponse(optionBookingQuestionSchema, "The updated option booking question"),
    400: invalidRequestResponse,
    404: notFoundResponse("Option booking question not found"),
  },
})

const deleteOptionQuestionRoute = createRoute({
  method: "delete",
  path: "/option-questions/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The option booking question was deleted"),
    404: notFoundResponse("Option booking question not found"),
  },
})

const optionQuestionsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listOptionQuestionsRoute, async (c) => {
    return c.json(
      await bookingRequirementsService.listOptionBookingQuestions(
        c.get("db"),
        c.req.valid("query"),
      ),
      200,
    )
  })
  .openapi(createOptionQuestionRoute, async (c) => {
    const row = await bookingRequirementsService.createOptionBookingQuestion(
      c.get("db"),
      c.req.valid("json"),
    )
    if (!row) throw new Error("Failed to create option booking question")
    return c.json({ data: row }, 201)
  })
  .openapi(getOptionQuestionRoute, async (c) => {
    const row = await bookingRequirementsService.getOptionBookingQuestionById(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Option booking question not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(updateOptionQuestionRoute, async (c) => {
    const row = await bookingRequirementsService.updateOptionBookingQuestion(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Option booking question not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteOptionQuestionRoute, async (c) => {
    const row = await bookingRequirementsService.deleteOptionBookingQuestion(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Option booking question not found" }, 404)
    return c.json({ success: true }, 200)
  })

// --- question options sub-chain -------------------------------------------

const listQuestionOptionsRoute = createRoute({
  method: "get",
  path: "/question-options",
  request: { query: bookingQuestionOptionListQuerySchema },
  responses: {
    200: listResponse(bookingQuestionOptionSchema, "Paginated booking question options"),
    400: invalidRequestResponse,
  },
})

const createQuestionOptionRoute = createRoute({
  method: "post",
  path: "/question-options",
  request: { body: jsonBody(insertBookingQuestionOptionSchema, true, "Booking question option") },
  responses: {
    201: dataResponse(bookingQuestionOptionSchema, "The created booking question option"),
    400: invalidRequestResponse,
  },
})

const getQuestionOptionRoute = createRoute({
  method: "get",
  path: "/question-options/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(bookingQuestionOptionSchema, "A booking question option by id"),
    404: notFoundResponse("Booking question option not found"),
  },
})

const updateQuestionOptionRoute = createRoute({
  method: "patch",
  path: "/question-options/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(
      updateBookingQuestionOptionSchema,
      false,
      "Partial booking question option update",
    ),
  },
  responses: {
    200: dataResponse(bookingQuestionOptionSchema, "The updated booking question option"),
    400: invalidRequestResponse,
    404: notFoundResponse("Booking question option not found"),
  },
})

const deleteQuestionOptionRoute = createRoute({
  method: "delete",
  path: "/question-options/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The booking question option was deleted"),
    404: notFoundResponse("Booking question option not found"),
  },
})

const questionOptionsRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listQuestionOptionsRoute, async (c) => {
    return c.json(
      await bookingRequirementsService.listBookingQuestionOptions(
        c.get("db"),
        c.req.valid("query"),
      ),
      200,
    )
  })
  .openapi(createQuestionOptionRoute, async (c) => {
    const row = await bookingRequirementsService.createBookingQuestionOption(
      c.get("db"),
      c.req.valid("json"),
    )
    if (!row) throw new Error("Failed to create booking question option")
    return c.json({ data: row }, 201)
  })
  .openapi(getQuestionOptionRoute, async (c) => {
    const row = await bookingRequirementsService.getBookingQuestionOptionById(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Booking question option not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(updateQuestionOptionRoute, async (c) => {
    const row = await bookingRequirementsService.updateBookingQuestionOption(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Booking question option not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteQuestionOptionRoute, async (c) => {
    const row = await bookingRequirementsService.deleteBookingQuestionOption(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Booking question option not found" }, 404)
    return c.json({ success: true }, 200)
  })

// --- unit triggers sub-chain ----------------------------------------------

const listUnitTriggersRoute = createRoute({
  method: "get",
  path: "/unit-triggers",
  request: { query: bookingQuestionUnitTriggerListQuerySchema },
  responses: {
    200: listResponse(bookingQuestionUnitTriggerSchema, "Paginated booking question unit triggers"),
    400: invalidRequestResponse,
  },
})

const createUnitTriggerRoute = createRoute({
  method: "post",
  path: "/unit-triggers",
  request: {
    body: jsonBody(insertBookingQuestionUnitTriggerSchema, true, "Booking question unit trigger"),
  },
  responses: {
    201: dataResponse(
      bookingQuestionUnitTriggerSchema,
      "The created booking question unit trigger",
    ),
    400: invalidRequestResponse,
  },
})

const getUnitTriggerRoute = createRoute({
  method: "get",
  path: "/unit-triggers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(bookingQuestionUnitTriggerSchema, "A booking question unit trigger by id"),
    404: notFoundResponse("Booking question unit trigger not found"),
  },
})

const updateUnitTriggerRoute = createRoute({
  method: "patch",
  path: "/unit-triggers/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(
      updateBookingQuestionUnitTriggerSchema,
      false,
      "Partial booking question unit trigger update",
    ),
  },
  responses: {
    200: dataResponse(
      bookingQuestionUnitTriggerSchema,
      "The updated booking question unit trigger",
    ),
    400: invalidRequestResponse,
    404: notFoundResponse("Booking question unit trigger not found"),
  },
})

const deleteUnitTriggerRoute = createRoute({
  method: "delete",
  path: "/unit-triggers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The booking question unit trigger was deleted"),
    404: notFoundResponse("Booking question unit trigger not found"),
  },
})

const unitTriggersRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listUnitTriggersRoute, async (c) => {
    return c.json(
      await bookingRequirementsService.listBookingQuestionUnitTriggers(
        c.get("db"),
        c.req.valid("query"),
      ),
      200,
    )
  })
  .openapi(createUnitTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.createBookingQuestionUnitTrigger(
      c.get("db"),
      c.req.valid("json"),
    )
    if (!row) throw new Error("Failed to create booking question unit trigger")
    return c.json({ data: row }, 201)
  })
  .openapi(getUnitTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.getBookingQuestionUnitTriggerById(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Booking question unit trigger not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(updateUnitTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.updateBookingQuestionUnitTrigger(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Booking question unit trigger not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteUnitTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.deleteBookingQuestionUnitTrigger(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Booking question unit trigger not found" }, 404)
    return c.json({ success: true }, 200)
  })

// --- option triggers sub-chain --------------------------------------------

const listOptionTriggersRoute = createRoute({
  method: "get",
  path: "/option-triggers",
  request: { query: bookingQuestionOptionTriggerListQuerySchema },
  responses: {
    200: listResponse(
      bookingQuestionOptionTriggerSchema,
      "Paginated booking question option triggers",
    ),
    400: invalidRequestResponse,
  },
})

const createOptionTriggerRoute = createRoute({
  method: "post",
  path: "/option-triggers",
  request: {
    body: jsonBody(
      insertBookingQuestionOptionTriggerSchema,
      true,
      "Booking question option trigger",
    ),
  },
  responses: {
    201: dataResponse(
      bookingQuestionOptionTriggerSchema,
      "The created booking question option trigger",
    ),
    400: invalidRequestResponse,
  },
})

const getOptionTriggerRoute = createRoute({
  method: "get",
  path: "/option-triggers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(
      bookingQuestionOptionTriggerSchema,
      "A booking question option trigger by id",
    ),
    404: notFoundResponse("Booking question option trigger not found"),
  },
})

const updateOptionTriggerRoute = createRoute({
  method: "patch",
  path: "/option-triggers/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(
      updateBookingQuestionOptionTriggerSchema,
      false,
      "Partial booking question option trigger update",
    ),
  },
  responses: {
    200: dataResponse(
      bookingQuestionOptionTriggerSchema,
      "The updated booking question option trigger",
    ),
    400: invalidRequestResponse,
    404: notFoundResponse("Booking question option trigger not found"),
  },
})

const deleteOptionTriggerRoute = createRoute({
  method: "delete",
  path: "/option-triggers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The booking question option trigger was deleted"),
    404: notFoundResponse("Booking question option trigger not found"),
  },
})

const optionTriggersRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listOptionTriggersRoute, async (c) => {
    return c.json(
      await bookingRequirementsService.listBookingQuestionOptionTriggers(
        c.get("db"),
        c.req.valid("query"),
      ),
      200,
    )
  })
  .openapi(createOptionTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.createBookingQuestionOptionTrigger(
      c.get("db"),
      c.req.valid("json"),
    )
    if (!row) throw new Error("Failed to create booking question option trigger")
    return c.json({ data: row }, 201)
  })
  .openapi(getOptionTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.getBookingQuestionOptionTriggerById(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Booking question option trigger not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(updateOptionTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.updateBookingQuestionOptionTrigger(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Booking question option trigger not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteOptionTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.deleteBookingQuestionOptionTrigger(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Booking question option trigger not found" }, 404)
    return c.json({ success: true }, 200)
  })

// --- extra triggers sub-chain ---------------------------------------------

const listExtraTriggersRoute = createRoute({
  method: "get",
  path: "/extra-triggers",
  request: { query: bookingQuestionExtraTriggerListQuerySchema },
  responses: {
    200: listResponse(
      bookingQuestionExtraTriggerSchema,
      "Paginated booking question extra triggers",
    ),
    400: invalidRequestResponse,
  },
})

const createExtraTriggerRoute = createRoute({
  method: "post",
  path: "/extra-triggers",
  request: {
    body: jsonBody(insertBookingQuestionExtraTriggerSchema, true, "Booking question extra trigger"),
  },
  responses: {
    201: dataResponse(
      bookingQuestionExtraTriggerSchema,
      "The created booking question extra trigger",
    ),
    400: invalidRequestResponse,
  },
})

const getExtraTriggerRoute = createRoute({
  method: "get",
  path: "/extra-triggers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(bookingQuestionExtraTriggerSchema, "A booking question extra trigger by id"),
    404: notFoundResponse("Booking question extra trigger not found"),
  },
})

const updateExtraTriggerRoute = createRoute({
  method: "patch",
  path: "/extra-triggers/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(
      updateBookingQuestionExtraTriggerSchema,
      false,
      "Partial booking question extra trigger update",
    ),
  },
  responses: {
    200: dataResponse(
      bookingQuestionExtraTriggerSchema,
      "The updated booking question extra trigger",
    ),
    400: invalidRequestResponse,
    404: notFoundResponse("Booking question extra trigger not found"),
  },
})

const deleteExtraTriggerRoute = createRoute({
  method: "delete",
  path: "/extra-triggers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The booking question extra trigger was deleted"),
    404: notFoundResponse("Booking question extra trigger not found"),
  },
})

const extraTriggersRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listExtraTriggersRoute, async (c) => {
    return c.json(
      await bookingRequirementsService.listBookingQuestionExtraTriggers(
        c.get("db"),
        c.req.valid("query"),
      ),
      200,
    )
  })
  .openapi(createExtraTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.createBookingQuestionExtraTrigger(
      c.get("db"),
      c.req.valid("json"),
    )
    if (!row) throw new Error("Failed to create booking question extra trigger")
    return c.json({ data: row }, 201)
  })
  .openapi(getExtraTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.getBookingQuestionExtraTriggerById(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Booking question extra trigger not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(updateExtraTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.updateBookingQuestionExtraTrigger(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Booking question extra trigger not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteExtraTriggerRoute, async (c) => {
    const row = await bookingRequirementsService.deleteBookingQuestionExtraTrigger(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Booking question extra trigger not found" }, 404)
    return c.json({ success: true }, 200)
  })

// --- answers sub-chain -----------------------------------------------------

const listAnswersRoute = createRoute({
  method: "get",
  path: "/answers",
  request: { query: bookingAnswerListQuerySchema },
  responses: {
    200: listResponse(bookingAnswerSchema, "Paginated booking answers"),
    400: invalidRequestResponse,
  },
})

const createAnswerRoute = createRoute({
  method: "post",
  path: "/answers",
  request: { body: jsonBody(insertBookingAnswerSchema, true, "Booking answer") },
  responses: {
    201: dataResponse(bookingAnswerSchema, "The created booking answer"),
    400: invalidRequestResponse,
  },
})

const getAnswerRoute = createRoute({
  method: "get",
  path: "/answers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: dataResponse(bookingAnswerSchema, "A booking answer by id"),
    404: notFoundResponse("Booking answer not found"),
  },
})

const updateAnswerRoute = createRoute({
  method: "patch",
  path: "/answers/{id}",
  request: {
    params: idParamSchema,
    body: jsonBody(updateBookingAnswerSchema, false, "Partial booking answer update"),
  },
  responses: {
    200: dataResponse(bookingAnswerSchema, "The updated booking answer"),
    400: invalidRequestResponse,
    404: notFoundResponse("Booking answer not found"),
  },
})

const deleteAnswerRoute = createRoute({
  method: "delete",
  path: "/answers/{id}",
  request: { params: idParamSchema },
  responses: {
    200: deletedResponse("The booking answer was deleted"),
    404: notFoundResponse("Booking answer not found"),
  },
})

const answersRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  .openapi(listAnswersRoute, async (c) => {
    return c.json(
      await bookingRequirementsService.listBookingAnswers(c.get("db"), c.req.valid("query")),
      200,
    )
  })
  .openapi(createAnswerRoute, async (c) => {
    const row = await bookingRequirementsService.createBookingAnswer(
      c.get("db"),
      c.req.valid("json"),
    )
    if (!row) throw new Error("Failed to create booking answer")
    return c.json({ data: row }, 201)
  })
  .openapi(getAnswerRoute, async (c) => {
    const row = await bookingRequirementsService.getBookingAnswerById(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Booking answer not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(updateAnswerRoute, async (c) => {
    const row = await bookingRequirementsService.updateBookingAnswer(
      c.get("db"),
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    if (!row) return c.json({ error: "Booking answer not found" }, 404)
    return c.json({ data: row }, 200)
  })
  .openapi(deleteAnswerRoute, async (c) => {
    const row = await bookingRequirementsService.deleteBookingAnswer(
      c.get("db"),
      c.req.valid("param").id,
    )
    if (!row) return c.json({ error: "Booking answer not found" }, 404)
    return c.json({ success: true }, 200)
  })

export const bookingRequirementsRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})
  .route("/", contactRequirementsRoutes)
  .route("/", questionsRoutes)
  .route("/", optionQuestionsRoutes)
  .route("/", questionOptionsRoutes)
  .route("/", unitTriggersRoutes)
  .route("/", optionTriggersRoutes)
  .route("/", extraTriggersRoutes)
  .route("/", answersRoutes)

export type BookingRequirementsRoutes = typeof bookingRequirementsRoutes

export const __test__ = {
  productContactRequirementSchema,
  productBookingQuestionSchema,
  optionBookingQuestionSchema,
  bookingQuestionOptionSchema,
  bookingQuestionUnitTriggerSchema,
  bookingQuestionOptionTriggerSchema,
  bookingQuestionExtraTriggerSchema,
  bookingAnswerSchema,
}
