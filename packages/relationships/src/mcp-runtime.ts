import type { ActionLedgerRequestContextValues } from "@voyant-travel/action-ledger"
import type { EventBus } from "@voyant-travel/core"
import {
  defineToolContextContribution,
  ToolError,
  type ToolHandlerActionPolicyContext,
} from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { emitOrganizationChanged, emitPersonChanged } from "./events.js"
import { executeOrganizationCreateCommand } from "./organization-created-command.js"
import { relationshipsService } from "./service/index.js"
import {
  personListQuerySchema,
  updateOrganizationSchema,
  updatePersonSchema,
} from "./validation.js"

export * from "./tools.js"

type RelationshipsMcpEnv = {
  Variables: ActionLedgerRequestContextValues & {
    apiKeyId?: string
    eventBus?: EventBus
  }
}

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["relationships"],
  contribute: ({ request, context }) => {
    const c = request as Context<RelationshipsMcpEnv>
    const db = context.db as PostgresJsDatabase
    const eventBus = c.get("eventBus")
    const requestContext = relationshipsActionLedgerContext(c)
    const authorId = () => {
      const id = c.get("userId") ?? c.get("apiTokenId") ?? c.get("apiKeyId")
      if (!id) {
        throw new ToolError(
          "CRM note writes require an authenticated user or API credential id for authorship.",
          "AUTHORIZATION_DENIED",
        )
      }
      return id
    }

    return {
      relationships: {
        listPeople: (query: Parameters<typeof relationshipsService.listPeople>[1]) =>
          relationshipsService.listPeople(db, query),
        getPersonById: (id: string) => relationshipsService.getPersonById(db, id),
        async createPerson(input: {
          allowDuplicateName: boolean
          firstName: string
          lastName: string
          email?: string | null
          phone?: string | null
          organizationId?: string | null
          [key: string]: unknown
        }) {
          const { allowDuplicateName, ...data } = input
          if (!allowDuplicateName) {
            const result = await relationshipsService.listPeople(
              db,
              personListQuerySchema.parse({ search: data.lastName, limit: 25 }),
            )
            const existing = result.data.find((row) => isCompatibleSameName(row, data))
            if (existing) return { person: existing, alreadyExists: true }
          }
          const person = await relationshipsService.createPerson(
            db,
            data as Parameters<typeof relationshipsService.createPerson>[1],
          )
          if (!person) throw new ToolError("CRM person creation returned no row.", "PROVIDER_ERROR")
          await emitPersonChanged(eventBus, { id: person.id, action: "created" }, "service")
          return { person, alreadyExists: false }
        },
        async updatePerson(input: { id: string; [key: string]: unknown }) {
          const { id, ...patch } = input
          const person = await relationshipsService.updatePerson(
            db,
            id,
            updatePersonSchema.parse(patch),
          )
          if (person) {
            await emitPersonChanged(eventBus, { id: person.id, action: "updated" }, "service")
          }
          return person
        },
        listOrganizations: (query: Parameters<typeof relationshipsService.listOrganizations>[1]) =>
          relationshipsService.listOrganizations(db, query),
        getOrganizationById: (id: string) => relationshipsService.getOrganizationById(db, id),
        async createOrganization(
          input: {
            taxId?: string | null
            vatNumber?: string
            billingAddress?: Record<string, unknown>
            idempotencyKey?: string
            [key: string]: unknown
          },
          admitted: ToolHandlerActionPolicyContext,
        ) {
          const { idempotencyKey, vatNumber, billingAddress, ...rawOrganization } = input
          const organizationData = {
            ...rawOrganization,
            taxId: rawOrganization.taxId ?? vatNumber,
          } as Parameters<typeof relationshipsService.createOrganization>[1]
          const result = await executeOrganizationCreateCommand({
            db,
            context: requestContext,
            commandInput: {
              organization: organizationData,
              billingAddress: billingAddress
                ? (billingAddress as Parameters<typeof relationshipsService.createAddress>[3])
                : null,
            },
            admitted,
            legacyIdempotencyKey: idempotencyKey,
          })
          return {
            status: "created" as const,
            organization: result.value,
            replayed: result.replayed,
          }
        },
        async updateOrganization(input: {
          id: string
          vatNumber?: string
          [key: string]: unknown
        }) {
          const { id, vatNumber, ...rawPatch } = input
          const patch = updateOrganizationSchema.parse({
            ...rawPatch,
            taxId: rawPatch.taxId ?? vatNumber,
          })
          const organization = await relationshipsService.updateOrganization(db, id, patch)
          if (organization) {
            await emitOrganizationChanged(
              eventBus,
              { id: organization.id, action: "updated" },
              "service",
            )
          }
          return organization
        },
        listNotes: ({
          entityType,
          entityId,
        }: {
          entityType: "person" | "organization"
          entityId: string
        }) =>
          entityType === "person"
            ? relationshipsService.listPersonNotes(db, entityId)
            : relationshipsService.listOrganizationNotes(db, entityId),
        addNote: ({
          entityType,
          entityId,
          content,
        }: {
          entityType: "person" | "organization"
          entityId: string
          content: string
        }) =>
          entityType === "person"
            ? relationshipsService.createPersonNote(db, entityId, authorId(), { content })
            : relationshipsService.createOrganizationNote(db, entityId, authorId(), { content }),
        updateNote: ({
          entityType,
          id,
          content,
        }: {
          entityType: "person" | "organization"
          id: string
          content: string
        }) =>
          entityType === "person"
            ? relationshipsService.updatePersonNote(db, id, content)
            : relationshipsService.updateOrganizationNote(db, id, content),
        listContactMethods: ({
          entityType,
          entityId,
        }: {
          entityType: "person" | "organization"
          entityId: string
        }) => relationshipsService.listContactMethods(db, entityType, entityId),
        addContactMethod: ({
          entityType,
          entityId,
          ...data
        }: {
          entityType: "person" | "organization"
          entityId: string
          [key: string]: unknown
        }) =>
          relationshipsService.createContactMethod(
            db,
            entityType,
            entityId,
            data as Parameters<typeof relationshipsService.createContactMethod>[3],
          ),
        updateContactMethod: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
          relationshipsService.updateContactMethod(
            db,
            id,
            data as Parameters<typeof relationshipsService.updateContactMethod>[2],
          ),
        listAddresses: ({
          entityType,
          entityId,
        }: {
          entityType: "person" | "organization"
          entityId: string
        }) => relationshipsService.listAddresses(db, entityType, entityId),
        addAddress: ({
          entityType,
          entityId,
          ...data
        }: {
          entityType: "person" | "organization"
          entityId: string
          [key: string]: unknown
        }) =>
          relationshipsService.createAddress(
            db,
            entityType,
            entityId,
            data as Parameters<typeof relationshipsService.createAddress>[3],
          ),
        updateAddress: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
          relationshipsService.updateAddress(
            db,
            id,
            data as Parameters<typeof relationshipsService.updateAddress>[2],
          ),
      },
    }
  },
})

function relationshipsActionLedgerContext(
  c: Context<RelationshipsMcpEnv>,
): ActionLedgerRequestContextValues {
  return {
    userId: c.get("userId") ?? null,
    agentId: c.get("agentId") ?? null,
    workflowPrincipalId: c.get("workflowPrincipalId") ?? null,
    principalSubtype: c.get("principalSubtype") ?? null,
    sessionId: c.get("sessionId") ?? null,
    apiTokenId: c.get("apiTokenId") ?? c.get("apiKeyId") ?? null,
    callerType: c.get("callerType") ?? null,
    actor: c.get("actor") ?? null,
    isInternalRequest: c.get("isInternalRequest") ?? false,
    organizationId: c.get("organizationId") ?? null,
    workflowRunId: c.get("workflowRunId") ?? null,
    workflowStepId: c.get("workflowStepId") ?? null,
    correlationId: c.req.header("x-correlation-id") ?? c.req.header("x-request-id") ?? null,
  }
}

function isCompatibleSameName(
  row: Record<string, unknown>,
  candidate: {
    firstName: string
    lastName: string
    email?: string | null
    phone?: string | null
    organizationId?: string | null
  },
): boolean {
  if (nameKey(row.firstName) !== nameKey(candidate.firstName)) return false
  if (nameKey(row.lastName) !== nameKey(candidate.lastName)) return false
  const candidateEmail = emailKey(candidate.email)
  const rowEmail = emailKey(row.email)
  if (candidateEmail && rowEmail && candidateEmail !== rowEmail) return false
  const candidatePhone = phoneKey(candidate.phone)
  const rowPhone = phoneKey(row.phone)
  if (candidatePhone && rowPhone && candidatePhone !== rowPhone) return false
  const rowOrganizationId = stringValue(row.organizationId)
  if (
    candidate.organizationId &&
    rowOrganizationId &&
    candidate.organizationId !== rowOrganizationId
  ) {
    return false
  }
  return true
}

function nameKey(value: unknown): string {
  return stringValue(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function emailKey(value: unknown): string {
  return stringValue(value).toLowerCase()
}

function phoneKey(value: unknown): string {
  const digits = stringValue(value).replace(/\D/g, "")
  return digits.length > 9 ? digits.slice(-9) : digits
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
