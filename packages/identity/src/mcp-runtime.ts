import type { ActionLedgerRequestContextValues } from "@voyant-travel/action-ledger"
import { executeAdmittedCreatedTargetCommand } from "@voyant-travel/action-ledger/created-command"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  defineToolContextContribution,
  ToolError,
  type ToolHandlerActionPolicyContext,
} from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import { identityService } from "./service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["identity"],
  contribute: ({ request, context }) => {
    const c = request as Context
    const db = context.db as Parameters<typeof identityService.listContactPoints>[0]
    return {
      identity: {
        listContactPoints: (query: Parameters<typeof identityService.listContactPoints>[1]) =>
          identityService.listContactPoints(db, query),
        getContactPointById: (id: string) => identityService.getContactPointById(db, id),
        createContactPoint: (
          input: Parameters<import("./tools.js").IdentityToolServices["createContactPoint"]>[0],
          admitted: ToolHandlerActionPolicyContext,
        ) =>
          executeIdentityChildCreate({
            c,
            db: db as unknown as AnyDrizzleDb,
            input,
            admitted,
            commandTargetType: "contact-point-create-command",
            canonicalTargetType: "identity_contact_point",
            resultReferenceType: "identity_contact_point",
            create: identityService.createContactPoint,
          }),
        updateContactPoint: ({
          id,
          ...input
        }: Parameters<import("./tools.js").IdentityToolServices["updateContactPoint"]>[0]) =>
          identityService.updateContactPoint(db, id, input),
        listAddresses: (query: Parameters<typeof identityService.listAddresses>[1]) =>
          identityService.listAddresses(db, query),
        getAddressById: (id: string) => identityService.getAddressById(db, id),
        createAddress: (
          input: Parameters<import("./tools.js").IdentityToolServices["createAddress"]>[0],
          admitted: ToolHandlerActionPolicyContext,
        ) =>
          executeIdentityChildCreate({
            c,
            db: db as unknown as AnyDrizzleDb,
            input,
            admitted,
            commandTargetType: "address-create-command",
            canonicalTargetType: "identity_address",
            resultReferenceType: "identity_address",
            create: identityService.createAddress,
          }),
        updateAddress: ({
          id,
          ...input
        }: Parameters<import("./tools.js").IdentityToolServices["updateAddress"]>[0]) =>
          identityService.updateAddress(db, id, input),
        listNamedContacts: (query: Parameters<typeof identityService.listNamedContacts>[1]) =>
          identityService.listNamedContacts(db, query),
        getNamedContactById: (id: string) => identityService.getNamedContactById(db, id),
        createNamedContact: (
          input: Parameters<import("./tools.js").IdentityToolServices["createNamedContact"]>[0],
          admitted: ToolHandlerActionPolicyContext,
        ) =>
          executeIdentityChildCreate({
            c,
            db: db as unknown as AnyDrizzleDb,
            input,
            admitted,
            commandTargetType: "named-contact-create-command",
            canonicalTargetType: "identity_named_contact",
            resultReferenceType: "identity_named_contact",
            create: identityService.createNamedContact,
          }),
        updateNamedContact: ({
          id,
          ...input
        }: Parameters<import("./tools.js").IdentityToolServices["updateNamedContact"]>[0]) =>
          identityService.updateNamedContact(db, id, input),
      },
    }
  },
})

async function executeIdentityChildCreate<TInput extends { idempotencyKey: string }>(input: {
  c: Context
  db: AnyDrizzleDb
  input: TInput
  admitted: ToolHandlerActionPolicyContext
  commandTargetType: string
  canonicalTargetType: string
  resultReferenceType: string
  create: (db: PostgresJsDatabase, data: never) => Promise<{ id: string } | null>
}) {
  const { idempotencyKey, ...data } = input.input
  const anchor = data as { entityType?: unknown; entityId?: unknown }
  if (
    typeof anchor.entityType !== "string" ||
    !anchor.entityType.trim() ||
    typeof anchor.entityId !== "string" ||
    !anchor.entityId.trim()
  ) {
    throw new ToolError(
      "Identity child creation requires an explicit entityType and entityId parent anchor.",
      "INVALID_INPUT",
    )
  }
  return (
    await executeAdmittedCreatedTargetCommand(
      {
        db: input.db,
        context: actionLedgerContext(input.c),
        admitted: input.admitted,
        idempotencyKey,
        commandTargetType: input.commandTargetType,
        canonicalTargetType: input.canonicalTargetType,
        resultReferenceType: input.resultReferenceType,
        commandInput: input.input,
        evaluatedRisk: "high",
      },
      {
        async create(tx) {
          const row = await input.create(tx as unknown as PostgresJsDatabase, data as never)
          if (!row) throw new Error("Identity child insert did not return a row")
          return { value: { id: row.id, replayed: false }, targetId: row.id }
        },
        async replay(_tx, completed) {
          return { id: completed.reference.id, replayed: true }
        },
      },
    )
  ).value
}

function actionLedgerContext(c: Context): ActionLedgerRequestContextValues {
  const vars = c.var as Record<string, unknown>
  return {
    userId: (vars.userId as string | undefined) ?? null,
    agentId: (vars.agentId as string | undefined) ?? null,
    workflowPrincipalId: (vars.workflowPrincipalId as string | undefined) ?? null,
    principalSubtype: (vars.principalSubtype as string | undefined) ?? null,
    sessionId: (vars.sessionId as string | undefined) ?? null,
    apiTokenId: ((vars.apiTokenId ?? vars.apiKeyId) as string | undefined) ?? null,
    callerType: (vars.callerType as ActionLedgerRequestContextValues["callerType"]) ?? null,
    actor: (vars.actor as ActionLedgerRequestContextValues["actor"]) ?? null,
    isInternalRequest: (vars.isInternalRequest as boolean | undefined) ?? false,
    organizationId: (vars.organizationId as string | undefined) ?? null,
    workflowRunId: (vars.workflowRunId as string | undefined) ?? null,
    workflowStepId: (vars.workflowStepId as string | undefined) ?? null,
    correlationId: c.req.header("x-correlation-id") ?? c.req.header("x-request-id") ?? null,
  }
}
