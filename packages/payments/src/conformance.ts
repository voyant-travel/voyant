import type {
  PaymentAdapter,
  PaymentAdapterRuntimeContext,
  PaymentCallbackRequest,
  PaymentInitiationInput,
  PaymentOperationInput,
} from "./index.js"
import { paymentAdapterRuntimePort } from "./index.js"

export interface PaymentAdapterConformanceHarness {
  adapter: PaymentAdapter
  context: PaymentAdapterRuntimeContext
  initiation: PaymentInitiationInput
  duplicateInitiation?: PaymentInitiationInput
  signedCallback: PaymentCallbackRequest
  duplicateCallback: PaymentCallbackRequest
  replayCallback?: PaymentCallbackRequest
  unsignedCallback: PaymentCallbackRequest
  capture?: PaymentOperationInput
  refund?: PaymentOperationInput
}

export interface PaymentAdapterConformanceResult {
  name: string
  passed: boolean
  error?: unknown
}

type ConformanceCase = {
  name: string
  run(): Promise<void>
}

export async function runPaymentAdapterConformance(
  harness: PaymentAdapterConformanceHarness,
): Promise<PaymentAdapterConformanceResult[]> {
  const cases = buildCases(harness)
  const results: PaymentAdapterConformanceResult[] = []
  for (const testCase of cases) {
    try {
      await testCase.run()
      results.push({ name: testCase.name, passed: true })
    } catch (error) {
      results.push({ name: testCase.name, passed: false, error })
    }
  }
  return results
}

function buildCases(harness: PaymentAdapterConformanceHarness): ConformanceCase[] {
  return [
    {
      name: "declares a valid adapter port",
      run: () => Promise.resolve(paymentAdapterRuntimePort.test(harness.adapter)),
    },
    { name: "uses valid minor-unit money", run: () => assertMoney(harness.initiation.money) },
    { name: "initiates idempotently", run: () => assertInitiation(harness) },
    {
      name: "maps a signed callback to a canonical state",
      run: () => assertSignedCallback(harness),
    },
    {
      name: "handles duplicate callbacks with the same idempotency key",
      run: () => assertDuplicateCallback(harness),
    },
    { name: "rejects unsigned callbacks", run: () => assertUnsignedCallback(harness) },
    { name: "reports health diagnostics", run: () => assertHealth(harness) },
    {
      name: "honors declared capture capability",
      run: () => assertOptionalOperation(harness, "capture"),
    },
    {
      name: "honors declared refund capability",
      run: () => assertOptionalOperation(harness, "refund"),
    },
  ]
}

async function assertMoney(money: { amountMinor: number; currency: string }) {
  if (!Number.isInteger(money.amountMinor) || money.amountMinor <= 0) {
    throw new Error("Money amounts must be positive integer minor units.")
  }
  if (!/^[A-Z]{3}$/.test(money.currency)) {
    throw new Error("Money currency must be an ISO 4217 uppercase code.")
  }
}

async function assertInitiation(harness: PaymentAdapterConformanceHarness) {
  const first = await harness.adapter.initiate(harness.context, harness.initiation)
  const duplicate = await harness.adapter.initiate(
    harness.context,
    harness.duplicateInitiation ?? harness.initiation,
  )
  if (first.idempotencyKey !== harness.initiation.idempotencyKey) {
    throw new Error("Initiation result must echo the canonical idempotency key.")
  }
  if (duplicate.idempotencyKey !== first.idempotencyKey) {
    throw new Error("Duplicate initiation must preserve idempotency identity.")
  }
  if (first.checkout && !/^https?:\/\//.test(first.checkout.url)) {
    throw new Error("Hosted checkout redirects must be absolute HTTP(S) URLs.")
  }
}

async function assertSignedCallback(harness: PaymentAdapterConformanceHarness) {
  const result = await harness.adapter.verifyCallback(harness.context, harness.signedCallback)
  if (!result.verified) throw new Error(`Signed callback rejected: ${result.reason}`)
  if (!result.event.paymentSessionId)
    throw new Error("Callback event must identify a payment session.")
  if (!result.event.idempotencyKey)
    throw new Error("Callback event must provide an idempotency key.")
}

async function assertDuplicateCallback(harness: PaymentAdapterConformanceHarness) {
  const first = await harness.adapter.verifyCallback(harness.context, harness.signedCallback)
  const duplicate = await harness.adapter.verifyCallback(harness.context, harness.duplicateCallback)
  if (!first.verified || !duplicate.verified) {
    throw new Error("Duplicate callback replay should verify and map to the same canonical event.")
  }
  if (first.event.idempotencyKey !== duplicate.event.idempotencyKey) {
    throw new Error("Duplicate callbacks must preserve event idempotency.")
  }
  if (harness.replayCallback) {
    const replay = await harness.adapter.verifyCallback(harness.context, harness.replayCallback)
    if (replay.verified) throw new Error("Stale replay callback must not verify as a new event.")
  }
}

async function assertUnsignedCallback(harness: PaymentAdapterConformanceHarness) {
  const result = await harness.adapter.verifyCallback(harness.context, harness.unsignedCallback)
  if (result.verified || result.reason !== "missing_signature") {
    throw new Error("Unsigned callbacks must fail with missing_signature.")
  }
}

async function assertHealth(harness: PaymentAdapterConformanceHarness) {
  const health = await harness.adapter.health(harness.context)
  if (!["ok", "degraded", "down"].includes(health.status)) {
    throw new Error("Health status must be ok, degraded, or down.")
  }
  if (Number.isNaN(Date.parse(health.checkedAt))) {
    throw new Error("Health diagnostics must include an ISO checkedAt timestamp.")
  }
}

async function assertOptionalOperation(
  harness: PaymentAdapterConformanceHarness,
  operation: "capture" | "refund",
) {
  const input = harness[operation]
  if (!harness.adapter.capabilities[operation]) return
  if (!input || typeof harness.adapter[operation] !== "function") {
    throw new Error(`Adapter declares ${operation} but no conformance input/method was supplied.`)
  }
  const result = await harness.adapter[operation](harness.context, input)
  if (!["accepted", "declined", "pending", "failed"].includes(result.status)) {
    throw new Error(`${operation} returned an invalid operation status.`)
  }
}
