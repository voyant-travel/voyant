import type { ActionLedgerRequestContextValues } from "@voyant-travel/action-ledger"
import { executeAdmittedCreatedTargetCommand } from "@voyant-travel/action-ledger/created-command"
import {
  type CatalogContentRuntime,
  catalogContentRuntimePort,
} from "@voyant-travel/catalog/runtime-port"
import type { EventBus } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { ToolHandlerActionPolicyContext } from "@voyant-travel/tools"
import { defineToolContextContribution, ToolError } from "@voyant-travel/tools"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { recordProductAuthoring } from "./authoring/audit.js"
import { composeProduct } from "./authoring/service.js"
import { emitProductContentChanged } from "./events.js"
import { productExtras } from "./extras/schema.js"
import { inventoryExtrasService } from "./extras/service.js"
import type { InventoryExtrasToolServices } from "./extras-tools.js"
import { productOptions, products } from "./schema.js"
import { productsService } from "./service.js"
import { getProductContent } from "./service-content.js"
import type {
  InventoryAuthoringToolServices,
  InventoryContentToolServices,
  InventoryToolServices,
} from "./tools.js"

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
      async createProduct(input) {
        const row = await productsService.createProduct(db, input)
        await eventBus?.emit("product.created", { id: row.id })
        return row
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
      async composeProduct(input) {
        const outcome = await composeProduct(db, input.spec, {
          userId: c.get("userId"),
          idempotencyKey: input.idempotencyKey,
        })
        if (outcome.status === "invalid") return outcome
        if (!outcome.reused) {
          await recordProductAuthoring(c, "create", outcome.result.productId)
        }
        return {
          status: "created" as const,
          productId: outcome.result.productId,
          options: outcome.result.options,
          reused: outcome.reused,
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
          input: Parameters<InventoryExtrasToolServices["createProductExtra"]>[0],
          admitted: ToolHandlerActionPolicyContext,
        ) => {
          const { idempotencyKey, ...data } = input
          return executeInventoryGeneratedChild({
            c,
            db: db as unknown as AnyDrizzleDb,
            admitted,
            idempotencyKey,
            commandTargetType: "product-extra-create-command",
            canonicalTargetType: "product_extra",
            resultReferenceType: "product_extra",
            commandInput: data,
            async create(tx) {
              const [parent] = await (tx as unknown as PostgresJsDatabase)
                .select({ id: products.id })
                .from(products)
                .where(eq(products.id, data.productId))
                .limit(1)
              if (!parent) {
                throw new ToolError(
                  "Product extra parent product was not found.",
                  "INVALID_INPUT",
                  {
                    productId: data.productId,
                  },
                )
              }
              const row = await inventoryExtrasService.createProductExtra(
                tx as unknown as PostgresJsDatabase,
                data,
              )
              if (!row) throw new Error("Product extra insert did not return a row")
              return { value: { id: row.id, replayed: false }, targetId: row.id }
            },
          })
        },
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
          input: Parameters<InventoryExtrasToolServices["createOptionExtraConfig"]>[0],
          admitted: ToolHandlerActionPolicyContext,
        ) => {
          const { idempotencyKey, ...data } = input
          return executeInventoryGeneratedChild({
            c,
            db: db as unknown as AnyDrizzleDb,
            admitted,
            idempotencyKey,
            commandTargetType: "option-extra-config-create-command",
            canonicalTargetType: "option_extra_config",
            resultReferenceType: "option_extra_config",
            commandInput: data,
            async create(tx) {
              const [anchor] = await (tx as unknown as PostgresJsDatabase)
                .select({ productId: productExtras.productId })
                .from(productExtras)
                .innerJoin(
                  productOptions,
                  and(
                    eq(productOptions.id, data.optionId),
                    eq(productOptions.productId, productExtras.productId),
                  ),
                )
                .where(eq(productExtras.id, data.productExtraId))
                .limit(1)
              if (!anchor) {
                throw new ToolError(
                  "Option must belong to the product owning the anchored product extra.",
                  "INVALID_INPUT",
                  { productExtraId: data.productExtraId, optionId: data.optionId },
                )
              }
              const row = await inventoryExtrasService.createOptionExtraConfig(
                tx as unknown as PostgresJsDatabase,
                data,
              )
              if (!row) throw new Error("Option extra config insert did not return a row")
              return { value: { id: row.id, replayed: false }, targetId: row.id }
            },
          })
        },
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

async function executeInventoryGeneratedChild<TReferenceType extends string>(input: {
  c: LedgerHttpContext
  db: AnyDrizzleDb
  admitted: ToolHandlerActionPolicyContext
  idempotencyKey?: string
  commandTargetType: string
  canonicalTargetType: string
  resultReferenceType: TReferenceType
  commandInput: unknown
  create: Parameters<
    typeof executeAdmittedCreatedTargetCommand<{ id: string; replayed: boolean }, TReferenceType>
  >[1]["create"]
}) {
  return (
    await executeAdmittedCreatedTargetCommand(
      {
        db: input.db,
        context: inventoryActionLedgerContext(input.c),
        admitted: input.admitted,
        idempotencyKey: input.idempotencyKey,
        commandTargetType: input.commandTargetType,
        canonicalTargetType: input.canonicalTargetType,
        resultReferenceType: input.resultReferenceType,
        commandInput: input.commandInput,
        evaluatedRisk: "high",
      },
      {
        create: input.create,
        async replay(_tx, completed) {
          return { id: completed.reference.id, replayed: true }
        },
      },
    )
  ).value
}

function inventoryActionLedgerContext(c: LedgerHttpContext): ActionLedgerRequestContextValues {
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

async function optionalContentRuntime(value: unknown): Promise<CatalogContentRuntime | undefined> {
  const resolved = await Promise.resolve(value)
  if (resolved === undefined) return undefined
  await catalogContentRuntimePort.test(resolved as CatalogContentRuntime)
  return resolved as CatalogContentRuntime
}
