import {
  type ActionLedgerRequestContextValues,
  buildCreatedTargetIdempotencyScope,
  type ExecuteCreatedTargetCommandHandlers,
  type ExecuteCreatedTargetCommandInput,
  type ExecuteCreatedTargetCommandResult,
  executeCreatedTargetCommand,
  mapActionLedgerRequestContext,
} from "@voyant-travel/action-ledger"
import { executeAdmittedCreatedTargetCommand } from "@voyant-travel/action-ledger/created-command"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  defineToolContextContribution,
  ToolError,
  type ToolHandlerActionPolicyContext,
} from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import {
  buildDistributionCreatedTargetFingerprint,
  DISTRIBUTION_CREATED_TARGET_POLICIES,
} from "./created-target-policy.js"
import { externalRefsService } from "./external-refs/service.js"
import { distributionService } from "./service.js"
import { suppliersService } from "./suppliers/service.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["distribution"],
  contribute: ({ request, context }) => {
    const c = request as Context<{
      Variables: ActionLedgerRequestContextValues
    }>
    const db = context.db as Parameters<typeof suppliersService.listSuppliers>[0]
    const requestContext = distributionActionLedgerContext(c)
    return {
      distribution: {
        listSuppliers: (query: Parameters<typeof suppliersService.listSuppliers>[1]) =>
          suppliersService.listSuppliers(db, query),
        getSupplierById: (id: string) => suppliersService.getSupplierById(db, id),
        getSupplierAggregates: (
          query: Parameters<typeof suppliersService.getSupplierAggregates>[1],
        ) => suppliersService.getSupplierAggregates(db, query),
        async createSupplier(
          input: Parameters<import("./tools.js").DistributionToolServices["createSupplier"]>[0],
          admitted: ToolHandlerActionPolicyContext,
        ) {
          const { idempotencyKey: legacyIdempotencyKey, ...commandInput } = input
          const policy = DISTRIBUTION_CREATED_TARGET_POLICIES.supplier
          const result = await executeDistributionCreate(
            db,
            requestContext,
            policy,
            legacyIdempotencyKey,
            commandInput,
            admitted,
            async (tx) => {
              const row = await suppliersService.createSupplier(
                tx,
                commandInput as Parameters<typeof suppliersService.createSupplier>[1],
              )
              return { id: row.id }
            },
          )
          return { status: "created" as const, supplier: result.value, replayed: result.replayed }
        },
        updateSupplier: ({
          id,
          ...input
        }: Parameters<import("./tools.js").DistributionToolServices["updateSupplier"]>[0]) =>
          suppliersService.updateSupplier(db, id, input),
        listChannels: (query: Parameters<typeof distributionService.listChannels>[1]) =>
          distributionService.listChannels(db, query),
        getChannelById: (id: string) => distributionService.getChannelById(db, id),
        async createChannel(
          input: Parameters<import("./tools.js").DistributionToolServices["createChannel"]>[0],
          admitted: ToolHandlerActionPolicyContext,
        ) {
          const { idempotencyKey: legacyIdempotencyKey, ...commandInput } = input
          const policy = DISTRIBUTION_CREATED_TARGET_POLICIES.channel
          const result = await executeDistributionCreate(
            db,
            requestContext,
            policy,
            legacyIdempotencyKey,
            commandInput,
            admitted,
            async (tx) => {
              const row = await distributionService.createChannel(
                tx,
                commandInput as Parameters<typeof distributionService.createChannel>[1],
              )
              if (!row) throw new Error("Distribution channel creation returned no row")
              return { id: row.id }
            },
          )
          return { status: "created" as const, channel: result.value, replayed: result.replayed }
        },
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
  c: Context<{ Variables: ActionLedgerRequestContextValues }>,
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
        context: distributionActionLedgerContext(c),
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

type DistributionPolicy =
  (typeof DISTRIBUTION_CREATED_TARGET_POLICIES)[keyof typeof DISTRIBUTION_CREATED_TARGET_POLICIES]

type DistributionCreatedCommandExecutor = (
  db: PostgresJsDatabase,
  input: ExecuteCreatedTargetCommandInput & { resultReferenceType: string },
  handlers: ExecuteCreatedTargetCommandHandlers<{ id: string }, string>,
) => Promise<ExecuteCreatedTargetCommandResult<{ id: string }, string>>

export async function executeDistributionCreate(
  db: PostgresJsDatabase,
  context: ActionLedgerRequestContextValues,
  policy: DistributionPolicy,
  legacyIdempotencyKey: string | undefined,
  commandInput: unknown,
  admitted: ToolHandlerActionPolicyContext,
  create: (tx: PostgresJsDatabase) => Promise<{ id: string }>,
  executor: DistributionCreatedCommandExecutor = executeCreatedTargetCommand,
) {
  const principal = mapActionLedgerRequestContext(context)
  if (principal.principalId === "unknown_request") {
    throw new TypeError("Distribution created-target commands require a concrete principal")
  }
  if (
    admitted.capabilityId !== policy.toolCapabilityId ||
    admitted.actionPolicy.capabilityId !== policy.capabilityId ||
    admitted.actionPolicy.version !== policy.actionVersion
  ) {
    throw new TypeError("Distribution created-target command Tool identity drifted after admission")
  }
  const idempotencyKey = admittedCreatedCommandIdempotencyKey(admitted, legacyIdempotencyKey)
  const fingerprint = await buildDistributionCreatedTargetFingerprint(
    policy,
    admitted.actionPolicy,
    idempotencyKey,
    commandInput,
  )
  const scope = await buildCreatedTargetIdempotencyScope({
    actionName: admitted.actionPolicy.capabilityId,
    actionVersion: admitted.actionPolicy.version,
    principalType: principal.principalType,
    principalId: principal.principalId,
    organizationId: principal.organizationId,
  })
  return executor(
    db,
    {
      context,
      actionName: admitted.actionPolicy.capabilityId,
      actionVersion: admitted.actionPolicy.version,
      actionKind: "create",
      evaluatedRisk: policy.evaluatedRisk,
      commandTarget: { type: policy.commandTargetType, id: idempotencyKey },
      canonicalTargetType: policy.canonicalTargetType,
      resultReferenceType: policy.resultReferenceType,
      capabilityId: admitted.actionPolicy.capabilityId,
      capabilityVersion: admitted.actionPolicy.version,
      approvalPolicy: policy.approvalPolicy,
      approvalReasonCode: policy.approvalReasonCode,
      commandInput,
      routeOrToolName: admitted.capabilityId,
      authorizationSource: "selected_graph_mcp_handler",
      idempotency: {
        scope,
        key: idempotencyKey,
        fingerprint,
      },
    },
    {
      async create(tx) {
        const value = await create(tx as PostgresJsDatabase)
        return { value, targetId: value.id }
      },
      async replay(_tx, result) {
        return { id: result.reference.id }
      },
    },
  )
}

function admittedCreatedCommandIdempotencyKey(
  admitted: ToolHandlerActionPolicyContext,
  legacyIdempotencyKey: string | undefined,
): string {
  const idempotencyKey = admitted.invocation.idempotencyKey?.trim()
  if (!idempotencyKey) {
    throw new ToolError(
      "Created-target command idempotency must come from the admitted Tool invocation.",
      "ACTION_POLICY_REQUIRED",
    )
  }
  if (legacyIdempotencyKey !== undefined && legacyIdempotencyKey !== idempotencyKey) {
    throw new ToolError(
      "The legacy top-level idempotency key does not match the admitted Tool invocation.",
      "INVALID_INPUT",
    )
  }
  return idempotencyKey
}

function distributionActionLedgerContext(
  c: Context<{ Variables: ActionLedgerRequestContextValues }>,
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
