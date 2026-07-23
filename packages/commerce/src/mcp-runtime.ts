import {
  type ActionLedgerRequestContextValues,
  buildCreatedTargetIdempotencyScope,
  type ExecuteCreatedTargetCommandHandlers,
  type ExecuteCreatedTargetCommandInput,
  type ExecuteCreatedTargetCommandResult,
  executeCreatedTargetCommand,
  mapActionLedgerRequestContext,
} from "@voyant-travel/action-ledger"
import type { EventBus } from "@voyant-travel/core"
import {
  defineToolContextContribution,
  ToolError,
  type ToolHandlerActionPolicyContext,
} from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"

import {
  buildCommerceCreatedTargetFingerprint,
  COMMERCE_CREATED_TARGET_POLICIES,
} from "./created-target-policy.js"
import { pricingService } from "./pricing/service.js"
import { promotionsService } from "./promotions/service.js"
import { sellabilityService } from "./sellability/service.js"
import type { CommerceToolServices } from "./tools.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["commerce"],
  contribute({ request, context }) {
    const db = context.db as PostgresJsDatabase
    const c = request as Context<{ Variables: ActionLedgerRequestContextValues }>
    const requestContext = commerceActionLedgerContext(c)
    const eventBus = (c.var as { eventBus?: EventBus }).eventBus
    const mutationRuntime = { eventBus }
    const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
    const commerce: CommerceToolServices = {
      async resolveSellability(input) {
        return json(await sellabilityService.resolve(db, input))
      },
      async listCancellationPolicies(input) {
        return json(await pricingService.listCancellationPolicies(db, input))
      },
      async getCancellationPolicy(id) {
        return json(await pricingService.getCancellationPolicyById(db, id))
      },
      async createCancellationPolicy(input, admitted) {
        const { idempotencyKey, ...commandInput } = input
        assertAdmittedIdempotencyKey(admitted, idempotencyKey)
        const result = await executeCommerceCreate(
          db,
          requestContext,
          COMMERCE_CREATED_TARGET_POLICIES.cancellationPolicy,
          idempotencyKey,
          commandInput,
          admitted,
          async (tx) => {
            const row = await pricingService.createCancellationPolicy(tx, commandInput)
            if (!row) throw new Error("Cancellation policy creation returned no row")
            return { id: row.id }
          },
        )
        return json({
          status: "created" as const,
          cancellationPolicy: result.value,
          replayed: result.replayed,
        })
      },
      async updateCancellationPolicy(id, input) {
        return json(await pricingService.updateCancellationPolicy(db, id, input))
      },
      async listPriceCatalogs(input) {
        return json(await pricingService.listPriceCatalogs(db, input))
      },
      async getPriceCatalog(id) {
        return json(await pricingService.getPriceCatalogById(db, id))
      },
      async createPriceCatalog(input, admitted) {
        const { idempotencyKey, ...commandInput } = input
        assertAdmittedIdempotencyKey(admitted, idempotencyKey)
        const result = await executeCommerceCreate(
          db,
          requestContext,
          COMMERCE_CREATED_TARGET_POLICIES.priceCatalog,
          idempotencyKey,
          commandInput,
          admitted,
          async (tx) => {
            const row = await pricingService.createPriceCatalog(tx, commandInput)
            return { id: row.id }
          },
        )
        return json({
          status: "created" as const,
          priceCatalog: result.value,
          replayed: result.replayed,
        })
      },
      async updatePriceCatalog(id, input) {
        return json(await pricingService.updatePriceCatalog(db, id, input))
      },
      async listPromotions(input) {
        return json(await promotionsService.listOffers(db, input))
      },
      async getPromotion(id) {
        return json(await promotionsService.getOfferById(db, id))
      },
      async createPromotion(input) {
        return json(await promotionsService.createOffer(db, input, mutationRuntime))
      },
      async updatePromotion(id, input) {
        return json(await promotionsService.updateOffer(db, id, input, mutationRuntime))
      },
      async archivePromotion(id) {
        return json(await promotionsService.archiveOffer(db, id, mutationRuntime))
      },
    }
    return { commerce }
  },
})

type CommerceCreatedTargetPolicy =
  (typeof COMMERCE_CREATED_TARGET_POLICIES)[keyof typeof COMMERCE_CREATED_TARGET_POLICIES]

type CommerceCreatedCommandExecutor = (
  db: PostgresJsDatabase,
  input: ExecuteCreatedTargetCommandInput & { resultReferenceType: string },
  handlers: ExecuteCreatedTargetCommandHandlers<{ id: string }, string>,
) => Promise<ExecuteCreatedTargetCommandResult<{ id: string }, string>>

export async function executeCommerceCreate(
  db: PostgresJsDatabase,
  context: ActionLedgerRequestContextValues,
  policy: CommerceCreatedTargetPolicy,
  idempotencyKey: string,
  commandInput: unknown,
  admitted: ToolHandlerActionPolicyContext,
  create: (tx: PostgresJsDatabase) => Promise<{ id: string }>,
  executor: CommerceCreatedCommandExecutor = executeCreatedTargetCommand,
) {
  const principal = mapActionLedgerRequestContext(context)
  if (principal.principalId === "unknown_request") {
    throw new TypeError("Commerce created-target commands require a concrete principal")
  }
  const selectedActionName = admitted.actionPolicy.capabilityId
  const selectedActionVersion = admitted.actionPolicy.version
  const fingerprint = await buildCommerceCreatedTargetFingerprint(
    {
      ...policy,
      actionName: selectedActionName,
      actionVersion: selectedActionVersion,
      capabilityId: selectedActionName,
      capabilityVersion: selectedActionVersion,
    } as CommerceCreatedTargetPolicy,
    idempotencyKey,
    commandInput,
  )
  const scope = await buildCreatedTargetIdempotencyScope({
    actionName: selectedActionName,
    actionVersion: selectedActionVersion,
    principalType: principal.principalType,
    principalId: principal.principalId,
    organizationId: principal.organizationId,
  })
  return executor(
    db,
    {
      context,
      actionName: selectedActionName,
      actionVersion: selectedActionVersion,
      actionKind: "create",
      evaluatedRisk: policy.evaluatedRisk,
      commandTarget: { type: policy.commandTargetType, id: idempotencyKey },
      canonicalTargetType: policy.canonicalTargetType,
      resultReferenceType: policy.resultReferenceType,
      capabilityId: selectedActionName,
      capabilityVersion: selectedActionVersion,
      approvalPolicy: policy.approvalPolicy,
      approvalReasonCode: policy.approvalReasonCode,
      commandInput,
      routeOrToolName: admitted.capabilityId,
      authorizationSource: "selected_graph_mcp_handler",
      idempotency: { scope, key: idempotencyKey, fingerprint },
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

function assertAdmittedIdempotencyKey(
  admitted: ToolHandlerActionPolicyContext,
  inputKey: string,
): void {
  if (admitted.invocation.idempotencyKey !== inputKey) {
    throw new ToolError(
      "Created-target command idempotency key does not match the selected invocation.",
      "ACTION_POLICY_REQUIRED",
      { capabilityId: admitted.capabilityId },
    )
  }
}

function commerceActionLedgerContext(
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
