import { workflow } from "@voyant-travel/workflows"
import { createHmacSigner, createHmacVerifier } from "@voyant-travel/workflows/auth"
import { createStepHandler } from "@voyant-travel/workflows/handler"
import { describe, expect, it } from "vitest"
import { createServiceBindingDispatcher, type ServiceBindingLike } from "../index.js"
import { tenantMeta } from "./adapter-test-support.js"

describe("HMAC auth end-to-end", () => {
  const SECRET = "shared-dev-secret-rotate-in-prod"

  /**
   * Dispatcher that routes requests into a fetch-style tenant step
   * handler wired with `createHmacVerifier`. This lets us exercise the
   * full signer/verifier pair over a Request round-trip.
   */
  function signingBinding(tenantHandler: (req: Request) => Promise<Response>): ServiceBindingLike {
    return {
      async fetch(req: Request): Promise<Response> {
        return tenantHandler(req)
      },
    }
  }

  it("signed requests verify and the workflow runs to completion", async () => {
    workflow({
      id: "wf",
      async run() {
        return { ok: true }
      },
    })
    const sign = await createHmacSigner(SECRET)
    const verify = await createHmacVerifier(SECRET)
    const tenantFetch = createStepHandler({ verifyRequest: verify })

    const handler = createServiceBindingDispatcher({
      binding: signingBinding(tenantFetch),
      sign,
    })({})

    const out = await handler({
      protocolVersion: 1,
      runId: "run_auth",
      workflowId: "wf",
      workflowVersion: "v1",
      invocationCount: 1,
      input: null,
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(out.status).toBe(200)
    if (out.status === 200) {
      expect("output" in out.body && out.body.output).toEqual({ ok: true })
    }
  })

  it("a mismatched key fails verification with HTTP 401 from the tenant", async () => {
    workflow({
      id: "wf",
      async run() {
        return 1
      },
    })
    const sign = await createHmacSigner("secret-A")
    const verify = await createHmacVerifier("secret-B")
    const tenantFetch = createStepHandler({ verifyRequest: verify })

    const handler = createServiceBindingDispatcher({
      binding: signingBinding(tenantFetch),
      sign,
    })({})

    const out = await handler({
      protocolVersion: 1,
      runId: "run_bad_auth",
      workflowId: "wf",
      workflowVersion: "v1",
      invocationCount: 1,
      input: null,
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(out.status).toBe(401)
    expect("error" in out.body && out.body.error).toBe("unauthorized")
  })

  it("unsigned requests fail when the tenant has a verifier", async () => {
    workflow({
      id: "wf",
      async run() {
        return 1
      },
    })
    const verify = await createHmacVerifier(SECRET)
    const tenantFetch = createStepHandler({ verifyRequest: verify })

    // No signer on the orchestrator side.
    const handler = createServiceBindingDispatcher({
      binding: signingBinding(tenantFetch),
    })({})

    const out = await handler({
      protocolVersion: 1,
      runId: "run_no_sig",
      workflowId: "wf",
      workflowVersion: "v1",
      invocationCount: 1,
      input: null,
      journal: {
        stepResults: {},
        waitpointsResolved: {},
        compensationsRun: {},
        metadataState: {},
        streamsCompleted: {},
      },
      environment: "development",
      deadline: Number.MAX_SAFE_INTEGER,
      tenantMeta,
      runMeta: { number: 1, attempt: 1, triggeredBy: { kind: "api" }, tags: [], startedAt: 0 },
    })
    expect(out.status).toBe(401)
    if ("message" in out.body) {
      expect(out.body.message).toMatch(/missing .* header/)
    }
  })
})
