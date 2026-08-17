import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ConversationsAttachmentRuntime } from "./attachment-runtime.js"
import {
  ConversationAttachmentConflictError,
  ConversationAttachmentNotFoundError,
  ConversationAttachmentUnavailableError,
  createAttachmentUploadTicket,
  downloadConversationAttachment,
  finalizeAttachmentUpload,
  requestAttachmentRedaction,
} from "./attachment-service.js"
import { ConversationAttachmentPolicyError } from "./content-security.js"
import type {
  ConversationsPersonDirectory,
  ConversationsRenderedMessageAdmission,
  ConversationsStaffDirectory,
} from "./runtime-port.js"
import type { Conversation, ConversationNote, ConversationPart } from "./schema.js"
import {
  addConversationNote,
  assertConversationInboxMembership,
  ConversationAccessDeniedError,
  type ConversationActor,
  ConversationConflictError,
  ConversationIngressDriftError,
  ConversationInvalidStateError,
  ConversationNotFoundError,
  claimDefaultConversationInbox,
  createConversationInbox,
  getConversation,
  listAssignableStaff,
  listConversationInboxes,
  listConversations,
  markConversationRead,
  replyToConversation,
  setConversationInboxMembership,
  startConversation,
  updateConversationState,
} from "./service.js"

interface Env {
  Variables: { userId?: string }
}

// biome-ignore lint/suspicious/noExplicitAny: OpenAPIHono loses spread response maps in handler inference.
type RouteContext = any

export interface ConversationsRoutesOptions {
  resolveDb(bindings: unknown): PostgresJsDatabase
  admission?: ConversationsRenderedMessageAdmission
  personDirectory?: ConversationsPersonDirectory
  staffDirectory: ConversationsStaffDirectory
  attachments?: ConversationsAttachmentRuntime
}

const timestamp = z.string().datetime()
const priority = z.enum(["low", "normal", "high", "urgent"])
const conversationSchema = z.object({
  id: z.string(),
  channel: z.string(),
  inboxId: z.string(),
  assignedToUserId: z.string().nullable(),
  priority,
  revision: z.number().int().positive(),
  status: z.enum(["open", "closed", "snoozed"]),
  subject: z.string().nullable(),
  suggestedSubject: z.string().nullable(),
  replyAlias: z.string(),
  customerAddress: z.string(),
  personRef: z.string().nullable(),
  contactPointRef: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
  snoozedUntil: timestamp.nullable(),
  lastPartAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
})
const partSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  sequence: z.number().int().positive(),
  direction: z.enum(["inbound", "outbound"]),
  senderAddress: z.string(),
  recipientAddresses: z.array(z.string()),
  subject: z.string().nullable(),
  textBody: z.string().nullable(),
  htmlBody: z.string().nullable(),
  contentStatus: z.enum(["safe", "quarantined", "redacted"]),
  legacyAttachmentCount: z.number().int().nonnegative(),
  classification: z.enum([
    "message",
    "automatic_reply",
    "delivery_status",
    "complaint",
    "suspicious",
  ]),
  replyable: z.boolean(),
  attachments: z.array(
    z.object({
      id: z.string(),
      filename: z.string(),
      contentType: z.string(),
      sizeBytes: z.number().int().nonnegative(),
      disposition: z.enum(["attachment", "inline"]),
      inlineContentId: z.string().nullable(),
      scanStatus: z.enum(["pending", "clean", "blocked", "failed"]),
      availability: z.enum(["active", "quarantined", "redaction_pending", "redacted"]),
      createdAt: timestamp,
    }),
  ),
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
const noteSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  authorUserId: z.string(),
  body: z.string(),
  createdAt: timestamp,
})
const inboxSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
const staffSchema = z.object({ userId: z.string(), displayName: z.string() })
const timelineItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("part"), occurredAt: timestamp, id: z.string(), part: partSchema }),
  z.object({ kind: z.literal("note"), occurredAt: timestamp, id: z.string(), note: noteSchema }),
  z.object({
    kind: z.literal("system"),
    occurredAt: timestamp,
    id: z.string(),
    event: z.object({
      id: z.string(),
      conversationId: z.string(),
      type: z.string(),
      actorUserId: z.string().nullable(),
      correlationId: z.string().nullable(),
      revision: z.number().int().positive(),
      payload: z.record(z.string(), z.unknown()),
      occurredAt: timestamp,
    }),
  }),
])
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
const standardErrors = {
  400: json(errorSchema, "Invalid conversation operation"),
  401: json(errorSchema, "Authenticated staff required"),
  403: json(errorSchema, "Inbox membership required"),
  404: json(errorSchema, "Conversation resource not found"),
  409: json(errorSchema, "Revision or idempotency conflict"),
} as const

const listRoute = createRoute({
  method: "get",
  path: "/v1/admin/conversations",
  request: {
    query: z.object({
      status: z.enum(["open", "closed", "snoozed"]).optional(),
      inboxId: z.string().optional(),
      assignedToUserId: z.string().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    }),
  },
  responses: {
    200: json(data(z.array(conversationSchema)), "Membership-scoped Inbox"),
    ...standardErrors,
  },
})
const detailRoute = createRoute({
  method: "get",
  path: "/v1/admin/conversations/{id}",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: json(
      data(
        z.object({
          conversation: conversationSchema,
          parts: z.array(partSchema),
          notes: z.array(noteSchema),
          timeline: z.array(timelineItemSchema),
        }),
      ),
      "Conversation activity",
    ),
    ...standardErrors,
  },
})
const replyInput = z.object({
  channelAccountId: z.string().min(1),
  text: z.string().trim().min(1).nullable(),
  html: z.string().nullable().optional(),
  attachmentIds: z.array(z.string().min(1)).max(10).default([]),
  idempotencyKey: z.string().min(1),
})
const replyRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversations/{id}/replies",
  request: { params: z.object({ id: z.string() }), body: body(replyInput) },
  responses: { 201: json(data(partSchema), "Atomically admitted reply"), ...standardErrors },
})
const startInput = z.object({
  inboxId: z.string().min(1),
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
      data(
        z.object({
          conversation: conversationSchema,
          parts: z.array(partSchema),
          notes: z.array(noteSchema),
          timeline: z.array(timelineItemSchema),
        }),
      ),
      "Started conversation",
    ),
    ...standardErrors,
  },
})
const stateInput = z
  .object({
    revision: z.number().int().positive(),
    status: z.enum(["open", "closed", "snoozed"]).optional(),
    snoozedUntil: timestamp.nullable().optional(),
    priority: priority.optional(),
    assignedToUserId: z.string().nullable().optional(),
    inboxId: z.string().optional(),
  })
  .refine(
    ({ revision: _revision, ...changes }) =>
      Object.values(changes).some((value) => value !== undefined),
    "At least one change is required",
  )
const stateRoute = createRoute({
  method: "patch",
  path: "/v1/admin/conversations/{id}",
  request: { params: z.object({ id: z.string() }), body: body(stateInput) },
  responses: { 200: json(data(conversationSchema), "Updated conversation"), ...standardErrors },
})
const readRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversations/{id}/read",
  request: {
    params: z.object({ id: z.string() }),
    body: body(z.object({ throughSequence: z.number().int().nonnegative().optional() })),
  },
  responses: {
    200: json(data(conversationSchema), "Advanced user read cursor"),
    ...standardErrors,
  },
})
const noteRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversations/{id}/notes",
  request: {
    params: z.object({ id: z.string() }),
    body: body(
      z.object({
        revision: z.number().int().positive(),
        body: z.string().trim().min(1).max(20_000),
      }),
    ),
  },
  responses: { 201: json(data(noteSchema), "Created internal note"), ...standardErrors },
})
const listInboxesRoute = createRoute({
  method: "get",
  path: "/v1/admin/conversation-inboxes",
  responses: { 200: json(data(z.array(inboxSchema)), "Accessible Inboxes"), ...standardErrors },
})
const createInboxRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversation-inboxes",
  request: {
    body: body(
      z.object({ name: z.string().trim().min(1), description: z.string().nullable().optional() }),
    ),
  },
  responses: { 201: json(data(inboxSchema), "Created Inbox"), ...standardErrors },
})
const claimDefaultInboxRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversation-inboxes/default-membership",
  responses: {
    200: json(data(inboxSchema), "Claimed an unowned default Inbox"),
    ...standardErrors,
  },
})
const membershipRoute = createRoute({
  method: "put",
  path: "/v1/admin/conversation-inboxes/{id}/members/{userId}",
  request: {
    params: z.object({ id: z.string(), userId: z.string() }),
    body: body(z.object({ role: z.enum(["member", "manager"]), active: z.boolean() })),
  },
  responses: { 204: { description: "Updated Inbox membership" }, ...standardErrors },
})
const assignableRoute = createRoute({
  method: "get",
  path: "/v1/admin/conversation-inboxes/{id}/assignable-staff",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: json(data(z.array(staffSchema)), "Active assignable staff"),
    ...standardErrors,
  },
})
const attachmentMetadataInput = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
})
const attachmentSchema = partSchema.shape.attachments.element
const ticketRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversations/{id}/attachments/tickets",
  request: {
    params: z.object({ id: z.string() }),
    body: body(attachmentMetadataInput),
  },
  responses: {
    ...standardErrors,
    201: json(
      data(
        z.object({
          token: z.string(),
          method: z.enum(["PUT", "POST"]),
          url: z.string().url(),
          headers: z.record(z.string(), z.string()).optional(),
          expiresAt: timestamp,
        }),
      ),
      "Short-lived private upload ticket",
    ),
    404: json(errorSchema, "Conversation not found"),
    409: json(errorSchema, "Private attachment upload unavailable"),
    422: json(errorSchema, "Attachment rejected by policy"),
  },
})
const finalizeRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversations/{id}/attachments/finalize",
  request: {
    params: z.object({ id: z.string() }),
    body: body(attachmentMetadataInput.extend({ token: z.string().min(1) })),
  },
  responses: {
    ...standardErrors,
    201: json(data(attachmentSchema), "Attachment finalized and scanned"),
    404: json(errorSchema, "Conversation not found"),
    409: json(errorSchema, "Upload unavailable or drifted"),
    422: json(errorSchema, "Attachment rejected by policy"),
  },
})
const downloadRoute = createRoute({
  method: "get",
  path: "/v1/admin/conversations/{id}/attachments/{attachmentId}/download",
  request: { params: z.object({ id: z.string(), attachmentId: z.string() }) },
  responses: {
    ...standardErrors,
    200: {
      description: "Private attachment stream",
      content: {
        "application/octet-stream": { schema: z.string().openapi({ format: "binary" }) },
      },
    },
    302: { description: "Short-lived private download redirect" },
    404: json(errorSchema, "Clean attachment not found"),
    409: json(errorSchema, "Private attachment runtime unavailable"),
  },
})
const redactRoute = createRoute({
  method: "post",
  path: "/v1/admin/conversations/{id}/attachments/{attachmentId}/redact",
  request: { params: z.object({ id: z.string(), attachmentId: z.string() }) },
  responses: {
    ...standardErrors,
    200: json(data(attachmentSchema), "Attachment queued for redaction"),
    404: json(errorSchema, "Attachment not found"),
  },
})

// biome-ignore lint/suspicious/noExplicitAny: Date rows serialize to the declared wire shape.
const response = (value: unknown): any => value

function toConversationDto(row: Conversation & { unreadCount?: number }) {
  const {
    startIdempotencyKey: _key,
    startPayloadFingerprint: _fingerprint,
    nextPartSequence: _sequence,
    ...dto
  } = row
  return { ...dto, unreadCount: row.unreadCount ?? 0 }
}

function toPartDto(row: ConversationPart) {
  const {
    externalSourceId: _source,
    payloadFingerprint: _fingerprint,
    idempotencyKey: _idempotencyKey,
    notificationDeliveryId: _deliveryId,
    ...dto
  } = row
  return { ...dto, attachments: [] }
}

function toAttachmentDto(row: import("./schema.js").ConversationAttachment) {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    disposition: row.disposition === "inline" ? "inline" : "attachment",
    inlineContentId: row.inlineContentId,
    scanStatus: row.scanStatus,
    availability: row.availability,
    createdAt: row.createdAt,
  }
}

function toNoteDto(row: ConversationNote) {
  return row
}

function toDetailDto(detail: Awaited<ReturnType<typeof getConversation>>) {
  if (!detail) return null
  return {
    conversation: toConversationDto(detail.conversation),
    parts: detail.parts.map((part) => ({
      ...toPartDto(part),
      attachments: detail.attachments
        .filter(({ partId }) => partId === part.id)
        .map(toAttachmentDto),
    })),
    notes: detail.notes.map(toNoteDto),
    timeline: detail.timeline.map((item) =>
      item.kind === "part"
        ? {
            ...item,
            part: {
              ...toPartDto(item.part),
              attachments: detail.attachments
                .filter(({ partId }) => partId === item.part.id)
                .map(toAttachmentDto),
            },
          }
        : item,
    ),
  }
}

function serviceError(error: unknown): { status: 400 | 403 | 404 | 409; error: string } | null {
  if (error instanceof ConversationNotFoundError) return { status: 404, error: error.code }
  if (error instanceof ConversationAccessDeniedError) return { status: 403, error: error.code }
  if (error instanceof ConversationInvalidStateError) return { status: 400, error: error.code }
  if (error instanceof ConversationConflictError || error instanceof ConversationIngressDriftError)
    return { status: 409, error: error.code }
  if (error instanceof ConversationAttachmentNotFoundError)
    return { status: 404, error: error.code }
  if (
    error instanceof ConversationAttachmentConflictError ||
    error instanceof ConversationAttachmentUnavailableError
  ) {
    return { status: 409, error: error.code }
  }
  return null
}

async function actorFor(c: {
  get(key: "userId"): string | undefined
  req: { header(name: string): string | undefined }
  env: unknown
}): Promise<ConversationActor | null> {
  const userId = c.get("userId")
  if (!userId) return null
  const correlationId = c.req.header("x-correlation-id")
  return { userId, ...(correlationId ? { correlationId } : {}) }
}

export function createConversationsRoutes(options: ConversationsRoutesOptions) {
  const app = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })
  // OpenAPIHono's handler inference drops spread response maps. Runtime registration still
  // consumes the complete route object, including every declared error response.
  // biome-ignore lint/suspicious/noExplicitAny: isolated framework inference workaround.
  const register = app.openapi.bind(app) as (route: any, handler: any) => unknown
  const handle = async <T>(operation: () => Promise<T>) => {
    try {
      return { value: await operation() }
    } catch (error) {
      const mapped = serviceError(error)
      if (!mapped) throw error
      return { error: mapped }
    }
  }
  register(listRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const rows = await listConversations(options.resolveDb(c.env), {
      ...c.req.valid("query"),
      userId: actor.userId,
    })
    return c.json(response({ data: rows.map(toConversationDto) }), 200)
  })
  register(detailRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const detail = await getConversation(
      options.resolveDb(c.env),
      c.req.valid("param").id,
      actor.userId,
    )
    return detail
      ? c.json(response({ data: toDetailDto(detail) }), 200)
      : c.json({ error: "conversation_not_found" }, 404)
  })
  register(replyRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    if (!options.admission) return c.json({ error: "message_admission_unavailable" }, 409)
    const result = await handle(() =>
      replyToConversation(options.resolveDb(c.env), options.admission!, {
        conversationId: c.req.valid("param").id,
        actor,
        ...c.req.valid("json"),
        runtimeBindings: c.env,
      }),
    )
    if (result.error) return c.json({ error: result.error.error }, result.error.status)
    return c.json(response({ data: toPartDto(result.value!) }), 201)
  })
  register(startRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    if (!options.admission || !options.personDirectory)
      return c.json({ error: "conversation_runtime_unavailable" }, 409)
    const result = await handle(() =>
      startConversation(options.resolveDb(c.env), options.admission!, options.personDirectory!, {
        ...c.req.valid("json"),
        actor,
        runtimeBindings: c.env,
      }),
    )
    if (result.error) return c.json({ error: result.error.error }, result.error.status)
    return c.json(response({ data: toDetailDto(result.value!) }), 201)
  })
  register(stateRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const result = await handle(() =>
      updateConversationState(options.resolveDb(c.env), c.req.valid("param").id, {
        ...c.req.valid("json"),
        actor,
        staffDirectory: options.staffDirectory,
        runtimeBindings: c.env,
      }),
    )
    if (result.error) return c.json({ error: result.error.error }, result.error.status)
    return c.json(response({ data: toConversationDto(result.value!) }), 200)
  })
  register(readRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const result = await handle(() =>
      markConversationRead(
        options.resolveDb(c.env),
        c.req.valid("param").id,
        actor,
        c.req.valid("json").throughSequence,
      ),
    )
    if (result.error) return c.json({ error: result.error.error }, result.error.status)
    return c.json(response({ data: toConversationDto(result.value!) }), 200)
  })
  register(noteRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const result = await handle(() =>
      addConversationNote(options.resolveDb(c.env), {
        conversationId: c.req.valid("param").id,
        actor,
        ...c.req.valid("json"),
      }),
    )
    if (result.error) return c.json({ error: result.error.error }, result.error.status)
    return c.json(response({ data: toNoteDto(result.value!) }), 201)
  })
  register(listInboxesRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    return c.json(
      response({ data: await listConversationInboxes(options.resolveDb(c.env), actor.userId) }),
      200,
    )
  })
  register(createInboxRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const result = await handle(() =>
      createConversationInbox(options.resolveDb(c.env), { actor, ...c.req.valid("json") }),
    )
    if (result.error) return c.json({ error: result.error.error }, result.error.status)
    return c.json(response({ data: result.value }), 201)
  })
  register(claimDefaultInboxRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const result = await handle(() =>
      claimDefaultConversationInbox(options.resolveDb(c.env), actor, options.staffDirectory, c.env),
    )
    if (result.error) return c.json({ error: result.error.error }, result.error.status)
    return c.json(response({ data: result.value }), 200)
  })
  register(membershipRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const params = c.req.valid("param")
    const result = await handle(() =>
      setConversationInboxMembership(options.resolveDb(c.env), {
        actor,
        inboxId: params.id,
        userId: params.userId,
        staffDirectory: options.staffDirectory,
        runtimeBindings: c.env,
        ...c.req.valid("json"),
      }),
    )
    if (result.error) return c.json({ error: result.error.error }, result.error.status)
    return c.body(null, 204)
  })
  register(assignableRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const result = await handle(() =>
      listAssignableStaff(
        options.resolveDb(c.env),
        c.req.valid("param").id,
        actor.userId,
        options.staffDirectory,
        c.env,
      ),
    )
    if (result.error) return c.json({ error: result.error.error }, result.error.status)
    return c.json(response({ data: result.value }), 200)
  })
  register(ticketRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const db = options.resolveDb(c.env)
    const access = await handle(() =>
      assertConversationInboxMembership(db, c.req.valid("param").id, actor.userId),
    )
    if (access.error) return c.json({ error: access.error.error }, access.error.status)
    try {
      const ticket = await createAttachmentUploadTicket(
        db,
        options.attachments,
        { conversationId: c.req.valid("param").id, ...c.req.valid("json") },
      )
      return c.json(response({ data: ticket }), 201)
    } catch (error) {
      if (error instanceof ConversationAttachmentPolicyError)
        return c.json({ error: error.code }, 422)
      const mapped = serviceError(error)
      if (!mapped) throw error
      return c.json({ error: mapped.error }, mapped.status)
    }
  })
  register(finalizeRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const db = options.resolveDb(c.env)
    const access = await handle(() =>
      assertConversationInboxMembership(db, c.req.valid("param").id, actor.userId),
    )
    if (access.error) return c.json({ error: access.error.error }, access.error.status)
    try {
      const attachment = await finalizeAttachmentUpload(
        db,
        options.attachments,
        { conversationId: c.req.valid("param").id, ...c.req.valid("json") },
      )
      return c.json(response({ data: toAttachmentDto(attachment) }), 201)
    } catch (error) {
      if (error instanceof ConversationAttachmentPolicyError)
        return c.json({ error: error.code }, 422)
      const mapped = serviceError(error)
      if (!mapped) throw error
      return c.json({ error: mapped.error }, mapped.status)
    }
  })
  register(downloadRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const db = options.resolveDb(c.env)
    const access = await handle(() =>
      assertConversationInboxMembership(db, c.req.valid("param").id, actor.userId),
    )
    if (access.error) return c.json({ error: access.error.error }, access.error.status)
    try {
      const result = await downloadConversationAttachment(
        db,
        options.attachments,
        {
          conversationId: c.req.valid("param").id,
          attachmentId: c.req.valid("param").attachmentId,
        },
      )
      if (result.download.kind === "redirect") {
        c.header("cache-control", "private, no-store")
        return c.redirect(result.download.url, 302)
      }
      const headers = new Headers(result.download.response.headers)
      headers.set("cache-control", "private, no-store")
      headers.set("content-type", result.attachment.contentType)
      headers.set("x-content-type-options", "nosniff")
      headers.set(
        "content-disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(result.attachment.filename)}`,
      )
      return new Response(result.download.response.body, {
        status: result.download.response.status,
        headers,
      })
    } catch (error) {
      const mapped = serviceError(error)
      if (!mapped) throw error
      return c.json({ error: mapped.error }, mapped.status)
    }
  })
  register(redactRoute, async (c: RouteContext) => {
    const actor = await actorFor(c)
    if (!actor) return c.json({ error: "active_staff_required" }, 401)
    const db = options.resolveDb(c.env)
    const access = await handle(() =>
      assertConversationInboxMembership(db, c.req.valid("param").id, actor.userId),
    )
    if (access.error) return c.json({ error: access.error.error }, access.error.status)
    try {
      const attachment = await requestAttachmentRedaction(db, {
        conversationId: c.req.valid("param").id,
        attachmentId: c.req.valid("param").attachmentId,
      })
      return c.json(response({ data: toAttachmentDto(attachment) }), 200)
    } catch (error) {
      if (!(error instanceof ConversationAttachmentNotFoundError)) throw error
      return c.json({ error: error.code }, 404)
    }
  })
  return app
}
