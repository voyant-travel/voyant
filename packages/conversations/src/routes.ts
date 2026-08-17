import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  ConversationsPersonDirectory,
  ConversationsRenderedMessageAdmission,
} from "./runtime-port.js"
import type { Conversation, ConversationPart } from "./schema.js"
import {
  ConversationConflictError,
  ConversationIngressDriftError,
  ConversationNotFoundError,
  getConversation,
  listConversations,
  markConversationRead,
  replyToConversation,
  startConversation,
  updateConversationState,
} from "./service.js"

export interface ConversationsRoutesOptions {
  resolveDb(bindings: unknown): PostgresJsDatabase
  admission?: ConversationsRenderedMessageAdmission
  personDirectory?: ConversationsPersonDirectory
}

const timestamp = z.string().datetime()
const conversationSchema = z.object({
  id: z.string(),
  channel: z.string(),
  status: z.enum(["open", "closed", "snoozed"]),
  subject: z.string().nullable(),
  suggestedSubject: z.string().nullable(),
  replyAlias: z.string(),
  customerAddress: z.string(),
  personRef: z.string().nullable(),
  contactPointRef: z.string().nullable(),
  unreadCount: z.number().int(),
  snoozedUntil: timestamp.nullable(),
  lastPartAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
})
const partSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  senderAddress: z.string(),
  recipientAddresses: z.array(z.string()),
  subject: z.string().nullable(),
  textBody: z.string().nullable(),
  htmlBody: z.string().nullable(),
  attachments: z.array(z.record(z.string(), z.unknown())),
  externalMessageId: z.string().nullable(),
  messageId: z.string().nullable(),
  inReplyTo: z.string().nullable(),
  references: z.array(z.string()),
  deliveryStatus: z.enum([
    "received",
    "pending",
    "accepted",
    "delivered",
    "failed",
    "bounced",
    "complained",
    "suppressed",
    "cancelled",
  ]),
  occurredAt: timestamp,
  createdAt: timestamp,
})
const errorSchema = z.object({ error: z.string() })
const data = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })
const json = <T extends z.ZodTypeAny>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
})
const body = <T extends z.ZodTypeAny>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
})

const listRoute = createRoute({
  method: "get",
  path: "/v1/admin/conversations",
  request: {
    query: z.object({
      status: z.enum(["open", "closed", "snoozed"]).optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    }),
  },
  responses: { 200: json(data(z.array(conversationSchema)), "Inbox conversations") },
})
const detailRoute = createRoute({
  method: "get",
  path: "/v1/admin/conversations/{id}",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: json(
      data(z.object({ conversation: conversationSchema, parts: z.array(partSchema) })),
      "Conversation thread",
    ),
    404: json(errorSchema, "Conversation not found"),
  },
})
const replyInput = z.object({
  channelAccountId: z.string().min(1),
  text: z.string().trim().min(1),
  html: z.string().nullable().optional(),
  idempotencyKey: z.string().min(1),
})
const replyRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversations/{id}/replies",
  request: { params: z.object({ id: z.string() }), body: body(replyInput) },
  responses: {
    201: json(data(partSchema), "Atomically admitted reply"),
    404: json(errorSchema, "Conversation not found"),
    409: json(errorSchema, "Delivery admission or idempotency conflict"),
  },
})
const startInput = z.object({
  personRef: z.string().min(1),
  contactPointRef: z.string().min(1),
  channelAccountId: z.string().min(1),
  fromAddress: z.string().email(),
  subject: z.string().nullable(),
  text: z.string().trim().min(1),
  idempotencyKey: z.string().min(1),
})
const startRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversations",
  request: { body: body(startInput) },
  responses: {
    201: json(
      data(z.object({ conversation: conversationSchema, parts: z.array(partSchema) })),
      "Started conversation",
    ),
    404: json(errorSchema, "Person contact point not found"),
    409: json(errorSchema, "Required runtime, admission, or idempotency conflict"),
  },
})
const stateInput = z.object({
  status: z.enum(["open", "closed", "snoozed"]),
  snoozedUntil: timestamp.nullable().optional(),
})
const stateRoute = createRoute({
  method: "patch",
  path: "/v1/admin/conversations/{id}",
  request: { params: z.object({ id: z.string() }), body: body(stateInput) },
  responses: {
    200: json(data(conversationSchema), "Updated conversation state"),
    404: json(errorSchema, "Conversation not found"),
  },
})
const readRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversations/{id}/read",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: json(data(conversationSchema), "Acknowledged Inbox conversation"),
    404: json(errorSchema, "Conversation not found"),
  },
})

// biome-ignore lint/suspicious/noExplicitAny: Date-bearing rows serialize to the declared ISO timestamp wire shape.
const response = (value: unknown): any => value

function toConversationDto(row: Conversation) {
  const { startIdempotencyKey: _key, startPayloadFingerprint: _fingerprint, ...dto } = row
  return dto
}

function toPartDto(row: ConversationPart) {
  const {
    externalSourceId: _source,
    payloadFingerprint: _fingerprint,
    idempotencyKey: _idempotencyKey,
    notificationDeliveryId: _deliveryId,
    ...dto
  } = row
  return dto
}

function toDetailDto(detail: Awaited<ReturnType<typeof getConversation>>) {
  if (!detail) return null
  return {
    conversation: toConversationDto(detail.conversation),
    parts: detail.parts.map(toPartDto),
  }
}

function serviceError(error: unknown): { status: 404 | 409; error: string } | null {
  if (error instanceof ConversationNotFoundError) return { status: 404, error: error.code }
  if (
    error instanceof ConversationConflictError ||
    error instanceof ConversationIngressDriftError
  ) {
    return { status: 409, error: error.code }
  }
  return null
}

export function createConversationsRoutes(options: ConversationsRoutesOptions) {
  const app = new OpenAPIHono({ defaultHook: openApiValidationHook })
  app.openapi(listRoute, async (c) =>
    c.json(
      response({
        data: (await listConversations(options.resolveDb(c.env), c.req.valid("query"))).map(
          toConversationDto,
        ),
      }),
      200,
    ),
  )
  app.openapi(detailRoute, async (c) => {
    const detail = await getConversation(options.resolveDb(c.env), c.req.valid("param").id)
    return detail
      ? c.json(response({ data: toDetailDto(detail) }), 200)
      : c.json({ error: "conversation_not_found" }, 404)
  })
  app.openapi(replyRoute, async (c) => {
    if (!options.admission) return c.json({ error: "message_admission_unavailable" }, 409)
    try {
      const part = await replyToConversation(options.resolveDb(c.env), options.admission, {
        conversationId: c.req.valid("param").id,
        ...c.req.valid("json"),
        runtimeBindings: c.env,
      })
      return c.json(response({ data: toPartDto(part) }), 201)
    } catch (error) {
      const mapped = serviceError(error)
      if (!mapped) throw error
      return c.json({ error: mapped.error }, mapped.status)
    }
  })
  app.openapi(startRoute, async (c) => {
    if (!options.admission || !options.personDirectory)
      return c.json({ error: "conversation_runtime_unavailable" }, 409)
    try {
      const detail = await startConversation(
        options.resolveDb(c.env),
        options.admission,
        options.personDirectory,
        { ...c.req.valid("json"), runtimeBindings: c.env },
      )
      return c.json(response({ data: toDetailDto(detail) }), 201)
    } catch (error) {
      const mapped = serviceError(error)
      if (!mapped) throw error
      return c.json({ error: mapped.error }, mapped.status)
    }
  })
  app.openapi(stateRoute, async (c) => {
    try {
      return c.json(
        response({
          data: toConversationDto(
            await updateConversationState(
              options.resolveDb(c.env),
              c.req.valid("param").id,
              c.req.valid("json"),
            ),
          ),
        }),
        200,
      )
    } catch (error) {
      if (!(error instanceof ConversationNotFoundError)) throw error
      return c.json({ error: error.code }, 404)
    }
  })
  app.openapi(readRoute, async (c) => {
    try {
      return c.json(
        response({
          data: toConversationDto(
            await markConversationRead(options.resolveDb(c.env), c.req.valid("param").id),
          ),
        }),
        200,
      )
    } catch (error) {
      if (!(error instanceof ConversationNotFoundError)) throw error
      return c.json({ error: error.code }, 404)
    }
  })
  return app
}
