/**
 * Relationships "person documents" admin routes — structured identity documents
 * plus the admin PII conveniences (server-side encrypt/decrypt of the people KMS
 * envelopes, travel-snapshot pre-fill, and the audited document-number reveal).
 * Migrated to `@hono/zod-openapi` for the OpenAPI admin backfill (voyant#2276 —
 * step 3.5, stage B). Request schemas reuse the exported `validation.ts`
 * schemas; response row schemas live in `rest-openapi-schemas.ts`. Handlers read
 * `c.req.valid(...)` and still call the same `relationshipsService` methods (and
 * the request-scoped KMS + action-ledger runtime) via `c.get(...)`. Each route
 * is registered statement-style to keep type-inference cost bounded.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import {
  type ActionLedgerRequestContextValues,
  evaluateActionLedgerCapabilityAccess,
  ledgerSensitiveRead,
} from "@voyant-travel/action-ledger"
import type { ModuleContainer } from "@voyant-travel/core"
import { openApiValidationHook } from "@voyant-travel/hono"
import { encryptOptionalJsonEnvelope } from "@voyant-travel/utils"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import {
  PERSON_DOCUMENT_REVEAL_ACTION_NAME,
  PERSON_DOCUMENT_REVEAL_ACTION_VERSION,
  PERSON_DOCUMENT_REVEAL_AUTHORIZATION_SOURCE,
  PERSON_DOCUMENT_REVEAL_CAPABILITY,
  PERSON_DOCUMENT_REVEAL_DECISION_POLICY,
} from "../action-ledger-capabilities.js"
import {
  RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY,
  type RelationshipsRouteRuntime,
} from "../route-runtime.js"
import { people } from "../schema.js"
import { relationshipsService } from "../service/index.js"
import {
  insertPersonDocumentFromPlaintextSchema,
  insertPersonDocumentSchema,
  personDocumentListQuerySchema,
  updatePersonDocumentFromPlaintextSchema,
  updatePersonDocumentSchema,
  updatePersonProfilePiiSchema,
} from "../validation.js"
import {
  errorResponseSchema,
  forbiddenResponseSchema,
  idParamSchema,
  personDocumentRevealSchema,
  personDocumentSchema,
  personTravelSnapshotSchema,
  successResponseSchema,
} from "./rest-openapi-schemas.js"

type Env = {
  Variables: {
    container?: ModuleContainer
    db: PostgresJsDatabase
    userId?: string
    sessionId?: string
    organizationId?: string | null
    actor?: string
    callerType?: string
    scopes?: string[] | null
    isInternalRequest?: boolean
    apiKeyId?: string
    apiTokenId?: string
  }
}

const jsonContent = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { "application/json": { schema } },
})

const requiredJsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { required: true, content: { "application/json": { schema } } },
})

function getRelationshipsActionLedgerContext(c: Context<Env>): ActionLedgerRequestContextValues {
  return {
    userId: c.get("userId") ?? null,
    agentId: null,
    workflowPrincipalId: null,
    principalSubtype: null,
    sessionId: c.get("sessionId") ?? null,
    apiTokenId: c.get("apiTokenId") ?? c.get("apiKeyId") ?? null,
    callerType: c.get("callerType") ?? null,
    actor: c.get("actor") ?? null,
    isInternalRequest: c.get("isInternalRequest") ?? false,
    organizationId: c.get("organizationId") ?? null,
    workflowRunId: null,
    workflowStepId: null,
    correlationId: c.req.header("x-correlation-id") ?? c.req.header("x-request-id") ?? null,
  }
}

const peopleKeyRef = { keyType: "people" as const }

async function getRelationshipsKms(c: Context<Env>) {
  const runtime = c.var.container?.resolve<RelationshipsRouteRuntime>(
    RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY,
  )
  if (!runtime) return null
  return runtime.getKmsProvider()
}

function kmsRequired(c: Context<Env>) {
  return c.json(
    { error: "KMS provider not configured — admin PII routes require a wired KMS key" },
    503,
  )
}

const listPersonDocumentsRoute = createRoute({
  method: "get",
  path: "/people/{id}/documents",
  request: { params: idParamSchema, query: personDocumentListQuerySchema },
  responses: {
    200: {
      description: "Identity documents for the person",
      ...jsonContent(z.object({ data: z.array(personDocumentSchema) })),
    },
  },
})

const createPersonDocumentRoute = createRoute({
  method: "post",
  path: "/people/{id}/documents",
  request: { params: idParamSchema, ...requiredJsonBody(insertPersonDocumentSchema) },
  responses: {
    201: {
      description: "The created identity document",
      ...jsonContent(z.object({ data: personDocumentSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Person not found", ...jsonContent(errorResponseSchema) },
  },
})

const getPersonDocumentRoute = createRoute({
  method: "get",
  path: "/person-documents/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "An identity document by id",
      ...jsonContent(z.object({ data: personDocumentSchema })),
    },
    404: { description: "Document not found", ...jsonContent(errorResponseSchema) },
  },
})

const updatePersonDocumentRoute = createRoute({
  method: "patch",
  path: "/person-documents/{id}",
  request: { params: idParamSchema, ...requiredJsonBody(updatePersonDocumentSchema) },
  responses: {
    200: {
      description: "The updated identity document",
      ...jsonContent(z.object({ data: personDocumentSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Document not found", ...jsonContent(errorResponseSchema) },
  },
})

const deletePersonDocumentRoute = createRoute({
  method: "delete",
  path: "/person-documents/{id}",
  request: { params: idParamSchema },
  responses: {
    200: { description: "Document deleted", ...jsonContent(successResponseSchema) },
    404: { description: "Document not found", ...jsonContent(errorResponseSchema) },
  },
})

const setPrimaryPersonDocumentRoute = createRoute({
  method: "post",
  path: "/person-documents/{id}/set-primary",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The document promoted to primary",
      ...jsonContent(z.object({ data: personDocumentSchema })),
    },
    404: { description: "Document not found", ...jsonContent(errorResponseSchema) },
  },
})

const travelSnapshotRoute = createRoute({
  method: "get",
  path: "/people/{id}/travel-snapshot",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Decrypted travel-snapshot pre-fill for the person",
      ...jsonContent(z.object({ data: personTravelSnapshotSchema })),
    },
    404: { description: "Person not found", ...jsonContent(errorResponseSchema) },
    503: { description: "KMS provider not configured", ...jsonContent(errorResponseSchema) },
  },
})

const updateProfilePiiRoute = createRoute({
  method: "patch",
  path: "/people/{id}/profile-pii",
  request: { params: idParamSchema, ...requiredJsonBody(updatePersonProfilePiiSchema) },
  responses: {
    200: { description: "PII slots updated", ...jsonContent(successResponseSchema) },
    400: {
      description: "invalid_request or nothing to update",
      ...jsonContent(errorResponseSchema),
    },
    404: { description: "Person not found", ...jsonContent(errorResponseSchema) },
    503: { description: "KMS provider not configured", ...jsonContent(errorResponseSchema) },
  },
})

const createPersonDocumentFromPlaintextRoute = createRoute({
  method: "post",
  path: "/people/{id}/documents/from-plaintext",
  request: { params: idParamSchema, ...requiredJsonBody(insertPersonDocumentFromPlaintextSchema) },
  responses: {
    201: {
      description: "The created identity document (number encrypted server-side)",
      ...jsonContent(z.object({ data: personDocumentSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Person not found", ...jsonContent(errorResponseSchema) },
    503: { description: "KMS provider not configured", ...jsonContent(errorResponseSchema) },
  },
})

const updatePersonDocumentFromPlaintextRoute = createRoute({
  method: "patch",
  path: "/person-documents/{id}/from-plaintext",
  request: { params: idParamSchema, ...requiredJsonBody(updatePersonDocumentFromPlaintextSchema) },
  responses: {
    200: {
      description: "The updated identity document (number encrypted server-side)",
      ...jsonContent(z.object({ data: personDocumentSchema })),
    },
    400: { description: "invalid_request", ...jsonContent(errorResponseSchema) },
    404: { description: "Document not found", ...jsonContent(errorResponseSchema) },
    503: { description: "KMS provider not configured", ...jsonContent(errorResponseSchema) },
  },
})

const revealPersonDocumentRoute = createRoute({
  method: "get",
  path: "/person-documents/{id}/reveal",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "The decrypted document number (disclosure recorded in the action ledger)",
      ...jsonContent(z.object({ data: personDocumentRevealSchema })),
    },
    403: {
      description: "Caller lacks the reveal capability",
      ...jsonContent(forbiddenResponseSchema),
    },
    404: { description: "Document not found", ...jsonContent(errorResponseSchema) },
    503: { description: "KMS provider not configured", ...jsonContent(errorResponseSchema) },
  },
})

export const personDocumentRoutes = new OpenAPIHono<Env>({ defaultHook: openApiValidationHook })

personDocumentRoutes.openapi(listPersonDocumentsRoute, async (c) =>
  c.json(
    {
      data: await relationshipsService.listPersonDocuments(
        c.get("db"),
        c.req.valid("param").id,
        c.req.valid("query"),
      ),
    },
    200,
  ),
)
personDocumentRoutes.openapi(createPersonDocumentRoute, async (c) => {
  const row = await relationshipsService.createPersonDocument(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
  )
  return row ? c.json({ data: row }, 201) : c.json({ error: "Person not found" }, 404)
})
personDocumentRoutes.openapi(getPersonDocumentRoute, async (c) => {
  const row = await relationshipsService.getPersonDocument(c.get("db"), c.req.valid("param").id)
  return row ? c.json({ data: row }, 200) : c.json({ error: "Document not found" }, 404)
})
personDocumentRoutes.openapi(updatePersonDocumentRoute, async (c) => {
  const row = await relationshipsService.updatePersonDocument(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("json"),
  )
  return row ? c.json({ data: row }, 200) : c.json({ error: "Document not found" }, 404)
})
personDocumentRoutes.openapi(deletePersonDocumentRoute, async (c) => {
  const row = await relationshipsService.deletePersonDocument(c.get("db"), c.req.valid("param").id)
  return row
    ? c.json({ success: true } as const, 200)
    : c.json({ error: "Document not found" }, 404)
})
personDocumentRoutes.openapi(setPrimaryPersonDocumentRoute, async (c) => {
  const row = await relationshipsService.setPrimaryPersonDocument(
    c.get("db"),
    c.req.valid("param").id,
  )
  return row ? c.json({ data: row }, 200) : c.json({ error: "Document not found" }, 404)
})

// ── Admin PII conveniences (server-side encrypt/decrypt) ──────────────
// Operator UIs (booking-traveler dialog) need to read a person's primary
// passport + free-text PII in plaintext to pre-fill forms, and write changes
// back without round-tripping ciphertext through the browser. The routes below
// use the request-scoped Relationships runtime to access the people KMS key.

personDocumentRoutes.openapi(travelSnapshotRoute, async (c) => {
  const kms = await getRelationshipsKms(c)
  if (!kms) return kmsRequired(c)
  const snapshot = await relationshipsService.loadPersonTravelSnapshot(
    c.get("db"),
    c.req.valid("param").id,
    { kms },
  )
  return snapshot ? c.json({ data: snapshot }, 200) : c.json({ error: "Person not found" }, 404)
})

personDocumentRoutes.openapi(updateProfilePiiRoute, async (c) => {
  const kms = await getRelationshipsKms(c)
  if (!kms) return kmsRequired(c)
  const body = c.req.valid("json")

  const updates: Record<string, { enc: string } | null> = {}
  for (const [key, column] of [
    ["accessibility", "accessibilityEncrypted"],
    ["dietary", "dietaryEncrypted"],
    ["loyalty", "loyaltyEncrypted"],
    ["insurance", "insuranceEncrypted"],
  ] as const) {
    const value = body[key]
    if (value === undefined) continue
    if (value === null) {
      updates[column] = null
    } else {
      updates[column] = await encryptOptionalJsonEnvelope(kms, peopleKeyRef, { text: value })
    }
  }
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nothing to update" }, 400)
  }

  const [row] = await c
    .get("db")
    .update(people)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(people.id, c.req.valid("param").id))
    .returning({ id: people.id })
  return row ? c.json({ success: true } as const, 200) : c.json({ error: "Person not found" }, 404)
})

personDocumentRoutes.openapi(createPersonDocumentFromPlaintextRoute, async (c) => {
  const kms = await getRelationshipsKms(c)
  if (!kms) return kmsRequired(c)
  const body = c.req.valid("json")
  const { number, ...rest } = body
  const numberEncrypted =
    number == null ? null : await encryptOptionalJsonEnvelope(kms, peopleKeyRef, { number })
  const row = await relationshipsService.createPersonDocument(
    c.get("db"),
    c.req.valid("param").id,
    {
      ...rest,
      ...(numberEncrypted !== undefined ? { numberEncrypted } : {}),
    },
  )
  return row ? c.json({ data: row }, 201) : c.json({ error: "Person not found" }, 404)
})

personDocumentRoutes.openapi(updatePersonDocumentFromPlaintextRoute, async (c) => {
  const kms = await getRelationshipsKms(c)
  if (!kms) return kmsRequired(c)
  const body = c.req.valid("json")
  const { number, ...rest } = body
  const updateInput: Record<string, unknown> = { ...rest }
  if (number !== undefined) {
    updateInput.numberEncrypted =
      number === null ? null : await encryptOptionalJsonEnvelope(kms, peopleKeyRef, { number })
  }
  const row = await relationshipsService.updatePersonDocument(
    c.get("db"),
    c.req.valid("param").id,
    updateInput,
  )
  return row ? c.json({ data: row }, 200) : c.json({ error: "Document not found" }, 404)
})

/**
 * Decrypts and returns the plaintext document number for a single person
 * document. Gated by the `relationships-pii:read` action-ledger capability;
 * every successful reveal writes an action-ledger row tagged
 * `relationships.person_document.reveal` so disclosures are auditable. Returns
 * 403 when the caller lacks the grant, 404 when the document doesn't exist, 503
 * when KMS isn't wired.
 */
personDocumentRoutes.openapi(revealPersonDocumentRoute, async (c) => {
  const documentId = c.req.valid("param").id

  const access = evaluateActionLedgerCapabilityAccess({
    definition: PERSON_DOCUMENT_REVEAL_CAPABILITY,
    actor: c.get("actor") ?? null,
    callerType: c.get("callerType") ?? null,
    scopes: c.get("scopes") ?? null,
    isInternalRequest: c.get("isInternalRequest") ?? false,
  })

  if (!access.allowed) {
    return c.json({ error: "Forbidden", reason: access.reason }, 403)
  }

  const kms = await getRelationshipsKms(c)
  if (!kms) return kmsRequired(c)

  const existing = await relationshipsService.getPersonDocument(c.get("db"), documentId)
  if (!existing) return c.json({ error: "Document not found" }, 404)

  let revealed: { documentId: string; number: string | null }
  try {
    revealed = await ledgerSensitiveRead(
      c.get("db"),
      {
        context: getRelationshipsActionLedgerContext(c),
        actionName: PERSON_DOCUMENT_REVEAL_ACTION_NAME,
        actionVersion: PERSON_DOCUMENT_REVEAL_ACTION_VERSION,
        status: "succeeded",
        evaluatedRisk: access.evaluatedRisk ?? "high",
        targetType: "person_document",
        targetId: documentId,
        routeOrToolName: "relationships.person-documents.reveal",
        capabilityId: PERSON_DOCUMENT_REVEAL_CAPABILITY.id,
        capabilityVersion: PERSON_DOCUMENT_REVEAL_CAPABILITY.version,
        authorizationSource:
          access.authorizationSource ?? PERSON_DOCUMENT_REVEAL_AUTHORIZATION_SOURCE,
        reasonCode: "person_document_reveal",
        disclosedFieldSet: ["number"],
        disclosureSummary: "Person document number reveal",
        decisionPolicy: PERSON_DOCUMENT_REVEAL_DECISION_POLICY,
      },
      async () => {
        const result = await relationshipsService.revealPersonDocumentNumber(
          c.get("db"),
          documentId,
          { kms },
        )
        if (!result) throw new Error("Document not found")
        return result
      },
    )
  } catch (error) {
    if (error instanceof Error && error.message === "Document not found") {
      return c.json({ error: "Document not found" }, 404)
    }
    throw error
  }

  return c.json({ data: revealed }, 200)
})
