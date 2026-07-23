import {
  buildCreatedTargetCommandFingerprint,
  buildCreatedTargetIdempotencyScope,
  executeCreatedTargetCommand,
} from "@voyant-travel/action-ledger/created-command"
import {
  type ActionLedgerRequestContextValues,
  mapActionLedgerRequestContext,
} from "@voyant-travel/action-ledger/request-context"
import {
  type CatalogContentRuntime,
  catalogContentRuntimePort,
} from "@voyant-travel/catalog/runtime-port"
import type { EventBus } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { insertOutboxEvents } from "@voyant-travel/db/outbox"
import {
  defineToolContextContribution,
  ToolError,
  type ToolHandlerActionPolicyContext,
} from "@voyant-travel/tools"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import type { z } from "zod"
import { AuthoringValidationError } from "./authoring/errors.js"
import { composeProductInTransaction } from "./authoring/service.js"
import { validateProductGraph } from "./authoring/validate.js"
import { emitProductContentChanged } from "./events.js"
import { inventoryExtrasService } from "./extras/service.js"
import { productsService } from "./service.js"
import { getProductContent } from "./service-content.js"
import type {
  InventoryAuthoringToolServices,
  InventoryContentToolServices,
  InventoryToolServices,
} from "./tools.js"
import { insertProductSchema } from "./validation.js"

export * from "./tools.js"

type InventoryMcpEnv = { Variables: { eventBus?: EventBus; userId?: string } }
type LedgerHttpContext = Pick<Context, "req"> & { var: object }

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["inventory", "inventoryContent", "inventoryExtras", "inventoryAuthoring"],
  contribute: ({ request, context, resources }) => {
    const c = request as Context<InventoryMcpEnv>
    const db = context.db as Parameters<typeof productsService.listProducts>[0]
    const eventBus = c.get("eventBus")
    const inventoryContent: InventoryContentToolServices = {
      async getProductContent(input) {
        const runtime = await optionalContentRuntime(resources[catalogContentRuntimePort.id])
        if (!runtime) {
          throw new ToolError(
            "Product content requires the selected catalog.content-runtime port.",
            "MISSING_SERVICE",
            { service: catalogContentRuntimePort.id },
          )
        }
        const result = await getProductContent(
          db,
          input.id,
          {
            preferredLocales: input.preferredLocales ?? [context.resolverScope.locale],
            audience: "staff",
            ...(input.market ? { market: input.market } : {}),
            ...(input.currency ? { currency: input.currency } : {}),
            acceptMachineTranslated: input.acceptMachineTranslated,
          },
          {
            registry: runtime.resolveRegistry(request),
            ...(input.forceFresh ? { forceFresh: true } : {}),
          },
        )
        return result
          ? {
              content: result.content,
              provenance: result.provenance,
              served_locale: result.resolution.served_locale,
              match_kind: result.resolution.match_kind,
              source: result.source,
              served_stale: result.served_stale,
              synthesized: result.synthesized,
              machine_translated: result.machine_translated,
            }
          : null
      },
    }
    const inventory: InventoryToolServices = {
      listProducts: (query) => productsService.listProducts(db, query),
      getProductById: (id) => productsService.getProductById(db, id),
      getProductAggregates: (query) => productsService.getProductAggregates(db, query),
      async createProduct({ idempotencyKey, ...input }, admitted) {
        const draft = insertProductSchema.parse({
          ...input,
          status: "draft",
          visibility: "private",
          activated: false,
        })
        const result = await executeProductCreateCommand({
          c,
          db: db as unknown as AnyDrizzleDb,
          idempotencyKey,
          input: draft,
          admitted,
        })
        return result.value
      },
      async updateProduct(id, input) {
        const row = await productsService.updateProduct(db, id, input)
        if (row) {
          await eventBus?.emit("product.updated", { id: row.id })
          await emitProductContentChanged(eventBus, { id: row.id, axis: "product" })
        }
        return row
      },
    }
    const inventoryAuthoring: InventoryAuthoringToolServices = {
      async composeProduct(input, admitted) {
        const issues = validateProductGraph(input.spec)
        if (issues.length) return { status: "invalid" as const, issues }
        let result: Awaited<ReturnType<typeof executeProductComposeCommand>>
        try {
          result = await executeProductComposeCommand({
            c,
            db: db as unknown as AnyDrizzleDb,
            idempotencyKey: input.idempotencyKey,
            spec: input.spec,
            admitted,
          })
        } catch (error) {
          if (error instanceof AuthoringValidationError) {
            return { status: "invalid" as const, issues: error.issues }
          }
          throw error
        }
        return {
          status: "created" as const,
          productId: result.value.productId,
          reused: result.replayed,
        }
      },
    }
    return {
      inventory,
      inventoryContent,
      inventoryAuthoring,
      inventoryExtras: {
        listProductExtras: (
          input: Parameters<typeof inventoryExtrasService.listProductExtras>[1],
        ) => inventoryExtrasService.listProductExtras(db, input),
        getProductExtraById: (id: string) => inventoryExtrasService.getProductExtraById(db, id),
        createProductExtra: (
          input: Parameters<typeof inventoryExtrasService.createProductExtra>[1],
        ) => inventoryExtrasService.createProductExtra(db, input),
        updateProductExtra: ({ id, ...input }: { id: string; [key: string]: unknown }) =>
          inventoryExtrasService.updateProductExtra(
            db,
            id,
            input as Parameters<typeof inventoryExtrasService.updateProductExtra>[2],
          ),
        listOptionExtraConfigs: (
          input: Parameters<typeof inventoryExtrasService.listOptionExtraConfigs>[1],
        ) => inventoryExtrasService.listOptionExtraConfigs(db, input),
        getOptionExtraConfigById: (id: string) =>
          inventoryExtrasService.getOptionExtraConfigById(db, id),
        createOptionExtraConfig: (
          input: Parameters<typeof inventoryExtrasService.createOptionExtraConfig>[1],
        ) => inventoryExtrasService.createOptionExtraConfig(db, input),
        updateOptionExtraConfig: ({ id, ...input }: { id: string; [key: string]: unknown }) =>
          inventoryExtrasService.updateOptionExtraConfig(
            db,
            id,
            input as Parameters<typeof inventoryExtrasService.updateOptionExtraConfig>[2],
          ),
      },
    }
  },
})

export async function executeProductCreateCommand(input: {
  c: LedgerHttpContext
  db: AnyDrizzleDb
  idempotencyKey: string
  input: z.output<typeof insertProductSchema>
  admitted: ToolHandlerActionPolicyContext
  /** Test-only failure seam after the domain insert and before outbox/result append. */
  testHooks?: { afterDomainCreate?: (tx: AnyDrizzleDb, productId: string) => Promise<void> }
}) {
  const context = actionLedgerContext(input.c)
  const principal = mapActionLedgerRequestContext(context)
  const command = {
    actionName: input.admitted.actionPolicy.capabilityId,
    actionVersion: input.admitted.actionPolicy.version,
    commandTarget: { type: "product-create-command", id: input.idempotencyKey },
    canonicalTargetType: "product",
    resultReferenceType: "product" as const,
    commandInput: input.input,
    capabilityId: input.admitted.actionPolicy.capabilityId,
    capabilityVersion: input.admitted.actionPolicy.version,
    evaluatedRisk: "medium" as const,
    approvalPolicy: "none" as const,
    approvalReasonCode: null,
  }
  const fingerprint = await buildCreatedTargetCommandFingerprint(command)
  const scope = await buildCreatedTargetIdempotencyScope({
    actionName: command.actionName,
    actionVersion: command.actionVersion,
    principalType: principal.principalType,
    principalId: principal.principalId,
    organizationId: principal.organizationId,
  })
  return executeCreatedTargetCommand(
    input.db,
    {
      context,
      ...command,
      routeOrToolName: input.admitted.capabilityId,
      authorizationSource: "selected_graph_mcp_handler",
      idempotency: {
        scope,
        key: input.idempotencyKey,
        fingerprint,
      },
    },
    {
      async create(tx) {
        const product = await productsService.createProduct(
          tx as unknown as PostgresJsDatabase,
          input.input,
        )
        await input.testHooks?.afterDomainCreate?.(tx, product.id)
        await insertOutboxEvents(tx, [
          {
            name: "product.created",
            data: { id: product.id },
            metadata: {
              eventId: productCreatedEventId(fingerprint),
            },
          },
        ])
        return { value: { productId: product.id }, targetId: product.id }
      },
      async replay(_tx, completed) {
        return { productId: completed.reference.id }
      },
    },
  )
}

async function executeProductComposeCommand(input: {
  c: LedgerHttpContext
  db: AnyDrizzleDb
  idempotencyKey: string
  spec: Parameters<typeof composeProductInTransaction>[1]
  admitted: ToolHandlerActionPolicyContext
}) {
  const context = actionLedgerContext(input.c)
  const principal = mapActionLedgerRequestContext(context)
  const command = {
    actionName: input.admitted.actionPolicy.capabilityId,
    actionVersion: input.admitted.actionPolicy.version,
    commandTarget: { type: "product-compose-command", id: input.idempotencyKey },
    canonicalTargetType: "product",
    resultReferenceType: "product" as const,
    commandInput: input.spec,
    capabilityId: input.admitted.actionPolicy.capabilityId,
    capabilityVersion: input.admitted.actionPolicy.version,
    evaluatedRisk: "high" as const,
    approvalPolicy: "none" as const,
    approvalReasonCode: null,
  }
  const fingerprint = await buildCreatedTargetCommandFingerprint(command)
  const scope = await buildCreatedTargetIdempotencyScope({
    actionName: command.actionName,
    actionVersion: command.actionVersion,
    principalType: principal.principalType,
    principalId: principal.principalId,
    organizationId: principal.organizationId,
  })
  return executeCreatedTargetCommand(
    input.db,
    {
      context,
      ...command,
      routeOrToolName: input.admitted.capabilityId,
      authorizationSource: "selected_graph_mcp_handler",
      idempotency: {
        scope,
        key: input.idempotencyKey,
        fingerprint,
      },
    },
    {
      async create(tx) {
        const result = await composeProductInTransaction(
          tx as unknown as PostgresJsDatabase,
          input.spec,
          { userId: (input.c.var as { userId?: string }).userId },
        )
        await insertOutboxEvents(tx, [
          {
            name: "product.created",
            data: { id: result.productId },
            metadata: { eventId: productCreatedEventId(fingerprint) },
          },
          {
            name: "product.content.changed",
            data: { id: result.productId, axis: "product" },
            metadata: { eventId: productContentChangedEventId(fingerprint) },
          },
        ])
        return {
          value: { productId: result.productId },
          targetId: result.productId,
        }
      },
      async replay(_tx, completed) {
        return { productId: completed.reference.id }
      },
    },
  )
}

function actionLedgerContext(c: LedgerHttpContext): ActionLedgerRequestContextValues {
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

export function createdTargetPrincipalId(context: ActionLedgerRequestContextValues): string {
  return mapActionLedgerRequestContext(context).principalId
}

export function productCreatedEventId(commandFingerprint: string): string {
  return `evt_inventory_product_created_${commandFingerprint}`
}

export function productContentChangedEventId(commandFingerprint: string): string {
  return `evt_inventory_product_content_changed_${commandFingerprint}`
}

async function optionalContentRuntime(value: unknown): Promise<CatalogContentRuntime | undefined> {
  const resolved = await Promise.resolve(value)
  if (resolved === undefined) return undefined
  await catalogContentRuntimePort.test(resolved as CatalogContentRuntime)
  return resolved as CatalogContentRuntime
}
