import type {
  CommercialAdapterHandle,
  CommercialAvailabilityFact,
  CommercialChannelRef,
  CommercialDecision,
  CommercialDecisionErrorCode,
  CommercialDecisionEvaluationContext,
  CommercialDecisionEvaluator,
  CommercialDecisionInput,
  CommercialDecisionReason,
  CommercialDecisionStatus,
  CommercialDecisionTrace,
  CommercialDecisionTraceOutcome,
  CommercialFxFact,
  CommercialJson,
  CommercialMarketRef,
  CommercialPriceAvailabilityAdapter,
  CommercialPriceAvailabilityResult,
  CommercialPricingFacts,
  CommercialPromotionFacts,
  CommercialProviderHandle,
  CommercialSellabilityFact,
  CommercialSnapshotRecord,
  CommercialSnapshotRepository,
  CommercialSnapshotTarget,
} from "./types.js"

export class CommercialDecisionError extends Error {
  constructor(
    message: string,
    readonly code: CommercialDecisionErrorCode,
  ) {
    super(message)
    this.name = "CommercialDecisionError"
  }
}

export function createCommerceAdapterRegistry(adapters: CommercialPriceAvailabilityAdapter[] = []) {
  const registrations = new Map<string, CommercialPriceAvailabilityAdapter>()

  function registerPriceAvailabilityAdapter(adapter: CommercialPriceAvailabilityAdapter) {
    if (registrations.has(adapter.id)) {
      throw new CommercialDecisionError(
        `Commercial adapter "${adapter.id}" is already registered.`,
        "duplicate_adapter",
      )
    }
    registrations.set(adapter.id, adapter)
  }

  async function resolveAdapter(input: CommercialDecisionInput) {
    if (input.item.adapterHint) {
      const hinted = registrations.get(input.item.adapterHint)
      if (!hinted) {
        return null
      }
      return (await hinted.supports(input)) ? hinted : null
    }

    const matches: CommercialPriceAvailabilityAdapter[] = []
    for (const adapter of registrations.values()) {
      if (await adapter.supports(input)) {
        matches.push(adapter)
      }
    }

    if (matches.length > 1) {
      throw new CommercialDecisionError(
        `More than one commercial adapter supports item "${input.item.id}".`,
        "adapter_ambiguous",
      )
    }

    return matches[0] ?? null
  }

  for (const adapter of adapters) {
    registerPriceAvailabilityAdapter(adapter)
  }

  return {
    listAdapters: () => Array.from(registrations.values()),
    registerPriceAvailabilityAdapter,
    resolveAdapter,
  }
}

export async function evaluateCommercialDecision(
  input: CommercialDecisionInput,
  context: CommercialDecisionEvaluationContext & {
    registry?: ReturnType<typeof createCommerceAdapterRegistry>
  } = {},
): Promise<CommercialDecision> {
  const registry = context.registry ?? createCommerceAdapterRegistry()
  const evaluatedAt = input.requestedAt ?? context.now?.toISOString() ?? new Date().toISOString()

  let adapter: CommercialPriceAvailabilityAdapter | null
  try {
    adapter = await registry.resolveAdapter(input)
  } catch (error) {
    if (error instanceof CommercialDecisionError && error.code === "adapter_ambiguous") {
      return buildDecision(input, evaluatedAt, {
        status: "error",
        reason: {
          code: "adapter_ambiguous",
          message: error.message,
        },
        traces: [
          commerceTrace("adapter_ambiguous", "error", {
            message: error.message,
          }),
        ],
      })
    }
    throw error
  }

  if (!adapter) {
    return buildDecision(input, evaluatedAt, {
      status: "unbuyable",
      reason: {
        code: "unsupported_item",
        message: "No price-availability adapter supports this item.",
      },
      traces: [
        commerceTrace("adapter_not_found", "blocked", {
          message: "No price-availability adapter supports this item.",
          refs: { itemId: input.item.id },
        }),
      ],
    })
  }

  const adapterHandle: CommercialAdapterHandle = {
    adapterId: adapter.id,
    adapterKind: adapter.kind,
  }

  let result: CommercialPriceAvailabilityResult
  try {
    result = await adapter.evaluate(input, context)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adapter execution failed."
    return buildDecision(input, evaluatedAt, {
      status: "error",
      reason: {
        code: "adapter_failed",
        message,
      },
      handles: [adapterHandle],
      traces: [
        commerceTrace("adapter_selected", "applied", {
          refs: { adapterId: adapter.id },
        }),
        commerceTrace("adapter_failed", "error", {
          message,
          refs: { adapterId: adapter.id },
        }),
      ],
    })
  }

  if (result.status === "available" && !result.pricing) {
    return buildDecision(input, evaluatedAt, {
      status: "error",
      reason: {
        code: "adapter_invalid_result",
        message: "A buyable commercial decision requires pricing facts.",
      },
      handles: [adapterHandle, ...toAdapterHandles(adapter, result.handles)],
      traces: [
        commerceTrace("adapter_selected", "applied", {
          refs: { adapterId: adapter.id },
        }),
        ...(result.traces ?? []),
        commerceTrace("adapter_invalid_result", "error", {
          message: "A buyable commercial decision requires pricing facts.",
          refs: { adapterId: adapter.id },
        }),
      ],
    })
  }

  const status = result.status === "available" ? "buyable" : "unbuyable"

  return buildDecision(input, evaluatedAt, {
    status,
    validFrom: result.validFrom,
    validUntil: result.validUntil,
    reason:
      result.reason ??
      (status === "buyable"
        ? { code: "buyable", message: "Adapter returned an available price." }
        : { code: "unavailable", message: "Adapter returned unavailable." }),
    pricing: result.pricing,
    fx: result.fx ?? result.pricing?.fx,
    promotions: result.promotions,
    availability: result.availability,
    sellability: result.sellability,
    market: result.market ?? input.market,
    channel: result.channel ?? input.channel,
    handles: [adapterHandle, ...toAdapterHandles(adapter, result.handles)],
    traces: [
      commerceTrace("adapter_selected", "applied", {
        refs: { adapterId: adapter.id },
      }),
      ...(result.traces ?? []),
    ],
  })
}

export function createCommercialDecisionEvaluator(
  options: { adapters?: CommercialPriceAvailabilityAdapter[] } = {},
): CommercialDecisionEvaluator {
  const registry = createCommerceAdapterRegistry(options.adapters)
  return {
    registerPriceAvailabilityAdapter: registry.registerPriceAvailabilityAdapter,
    evaluateCommercialDecision(input, context = {}) {
      return evaluateCommercialDecision(input, { ...context, registry })
    },
  }
}

export async function recordCommercialSnapshot(
  decision: CommercialDecision,
  target: CommercialSnapshotTarget,
  repository: CommercialSnapshotRepository,
): Promise<CommercialSnapshotRecord> {
  return repository.recordCommercialSnapshot({
    decision,
    target,
    idempotencyKey: target.idempotencyKey ?? decision.idempotencyKey,
  })
}

function buildDecision(
  input: CommercialDecisionInput,
  evaluatedAt: string,
  fields: {
    status: CommercialDecisionStatus
    reason: CommercialDecisionReason
    validFrom?: string
    validUntil?: string
    pricing?: CommercialPricingFacts
    fx?: CommercialFxFact
    promotions?: CommercialPromotionFacts
    availability?: CommercialAvailabilityFact
    sellability?: CommercialSellabilityFact
    market?: CommercialMarketRef
    channel?: CommercialChannelRef
    traces?: CommercialDecisionTrace[]
    handles?: CommercialAdapterHandle[]
  },
): CommercialDecision {
  return {
    decisionId: `commercial_decision_${fingerprint(
      input.idempotencyKey
        ? { idempotencyKey: input.idempotencyKey }
        : {
            evaluatedAt,
            input,
            reason: fields.reason,
            status: fields.status,
          },
    )}`,
    status: fields.status,
    buyable: fields.status === "buyable",
    input,
    evaluatedAt,
    idempotencyKey: input.idempotencyKey,
    validFrom: fields.validFrom,
    validUntil: fields.validUntil,
    reason: fields.reason,
    pricing: fields.pricing,
    fx: fields.fx,
    promotions: fields.promotions ?? {
      requestedCodes: input.promotionCodes,
      applied: [],
      rejected: [],
    },
    availability: fields.availability,
    sellability: fields.sellability,
    market: fields.market ?? input.market,
    channel: fields.channel ?? input.channel,
    traces: fields.traces ?? [],
    handles: fields.handles ?? [],
  }
}

function commerceTrace(
  code: string,
  outcome: CommercialDecisionTraceOutcome,
  options: {
    message?: string
    refs?: Record<string, string>
    facts?: Record<string, CommercialJson>
  } = {},
): CommercialDecisionTrace {
  return {
    id: `trace_${fingerprint({ code, outcome, ...options })}`,
    source: "commerce",
    outcome,
    code,
    message: options.message,
    refs: options.refs,
    facts: options.facts,
  }
}

function toAdapterHandles(
  adapter: CommercialPriceAvailabilityAdapter,
  handles: CommercialProviderHandle[] | undefined,
): CommercialAdapterHandle[] {
  return (handles ?? []).map((handle) => ({
    ...handle,
    adapterId: adapter.id,
    adapterKind: adapter.kind,
  }))
}

function fingerprint(value: unknown) {
  const text = stableStringify(value)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}
