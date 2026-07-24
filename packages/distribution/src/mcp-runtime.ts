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

import { externalRefsService } from "./external-refs/service.js"
import { distributionService } from "./service.js"
import { suppliersService } from "./suppliers/service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["distribution"],
  contribute: ({ request, context }) => {
    const c = request as Context
    const db = context.db as Parameters<typeof suppliersService.listSuppliers>[0]
    return {
      distribution: {
        listSuppliers: (query: Parameters<typeof suppliersService.listSuppliers>[1]) =>
          suppliersService.listSuppliers(db, query),
        getSupplierById: (id: string) => suppliersService.getSupplierById(db, id),
        getSupplierAggregates: (
          query: Parameters<typeof suppliersService.getSupplierAggregates>[1],
        ) => suppliersService.getSupplierAggregates(db, query),
        createSupplier: (input: Parameters<typeof suppliersService.createSupplier>[1]) =>
          suppliersService.createSupplier(db, input),
        updateSupplier: ({
          id,
          ...input
        }: Parameters<import("./tools.js").DistributionToolServices["updateSupplier"]>[0]) =>
          suppliersService.updateSupplier(db, id, input),
        listChannels: (query: Parameters<typeof distributionService.listChannels>[1]) =>
          distributionService.listChannels(db, query),
        getChannelById: (id: string) => distributionService.getChannelById(db, id),
        createChannel: (input: Parameters<typeof distributionService.createChannel>[1]) =>
          distributionService.createChannel(db, input),
        updateChannel: ({
          id,
          ...input
        }: Parameters<import("./tools.js").DistributionToolServices["updateChannel"]>[0]) =>
          distributionService.updateChannel(db, id, input),
        listExternalRefs: (query: Parameters<typeof externalRefsService.listExternalRefs>[1]) =>
          externalRefsService.listExternalRefs(db, query),
        getExternalRefById: (id: string) => externalRefsService.getExternalRefById(db, id),
        createExternalRef: (
          input: Parameters<import("./tools.js").DistributionToolServices["createExternalRef"]>[0],
          admitted: ToolHandlerActionPolicyContext,
        ) => executeExternalReferenceCreate(c, db as unknown as AnyDrizzleDb, input, admitted),
        updateExternalRef: ({
          id,
          ...input
        }: Parameters<import("./tools.js").DistributionToolServices["updateExternalRef"]>[0]) =>
          externalRefsService.updateExternalRef(db, id, input),
      },
    }
  },
})

async function executeExternalReferenceCreate(
  c: Context,
  db: AnyDrizzleDb,
  input: Parameters<import("./tools.js").DistributionToolServices["createExternalRef"]>[0],
  admitted: ToolHandlerActionPolicyContext,
) {
  const { idempotencyKey, ...data } = input
  if (!data.entityType.trim() || !data.entityId.trim()) {
    throw new ToolError(
      "External reference creation requires an explicit entityType and entityId parent anchor.",
      "INVALID_INPUT",
    )
  }
  return (
    await executeAdmittedCreatedTargetCommand(
      {
        db,
        context: actionLedgerContext(c),
        admitted,
        idempotencyKey,
        commandTargetType: "external-reference-create-command",
        canonicalTargetType: "external-reference",
        resultReferenceType: "external_reference",
        commandInput: data,
        evaluatedRisk: "medium",
      },
      {
        async create(tx) {
          const row = await externalRefsService.createExternalRef(
            tx as unknown as PostgresJsDatabase,
            data,
          )
          if (!row) throw new Error("External reference insert did not return a row")
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
