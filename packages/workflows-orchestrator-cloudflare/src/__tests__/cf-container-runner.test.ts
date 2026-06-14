import type { StepJournalEntry } from "@voyant-travel/workflows/handler"
import { describe, expect, it, vi } from "vitest"

import { type ContainerNamespaceLike, createCfContainerStepRunner } from "../cf-container-runner.js"

/** Minimal in-memory stub of the CF Container DO namespace. */
function stubNamespace(handler: (req: Request) => Promise<Response> | Response): {
  namespace: ContainerNamespaceLike
  calls: { id: string; request: Request }[]
} {
  const calls: { id: string; request: Request }[] = []
  const namespace: ContainerNamespaceLike = {
    idFromName(name: string) {
      return { toString: () => `id_${name}` }
    },
    get(id) {
      return {
        async fetch(request: Request) {
          calls.push({ id: id.toString(), request })
          return handler(request)
        },
      }
    },
  }
  return { namespace, calls }
}

function baseArgs(
  overrides: Partial<Parameters<ReturnType<typeof createCfContainerStepRunner>>[0]> = {},
) {
  const abortCtrl = new AbortController()
  return {
    stepId: "hash-source",
    attempt: 1,
    input: { bytes: 32_768 },
    fn: async () => {
      throw new Error("should not be called by a dispatching runner")
    },
    stepCtx: {
      signal: abortCtrl.signal,
      attempt: 1,
      log: () => {},
    },
    runId: "run_42",
    workflowId: "process-upload",
    workflowVersion: "v1",
    projectId: "prj_42",
    organizationId: "org_42",
    options: { runtime: "node" as const },
    ...overrides,
  }
}

describe("createCfContainerStepRunner", () => {
  it("dispatches to the namespace with a deterministic id and returns the container's journal entry", async () => {
    const entry: StepJournalEntry = {
      attempt: 1,
      status: "ok",
      output: { hash: "sha256:abc" },
      startedAt: 100,
      finishedAt: 250,
    }
    const { namespace, calls } = stubNamespace(
      () => new Response(JSON.stringify(entry), { status: 200 }),
    )

    const runner = createCfContainerStepRunner({ namespace })
    const result = await runner(baseArgs())

    expect(result).toEqual(entry)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.id).toBe("id_run_42:1:hash-source")
    expect(calls[0]!.request.method).toBe("POST")
    expect(new URL(calls[0]!.request.url).pathname).toBe("/step")
  })

  it("sends workflow + step + options in the body", async () => {
    const captured: { body?: unknown; auth?: string | null } = {}
    const { namespace } = stubNamespace(async (req) => {
      captured.body = await req.json()
      captured.auth = req.headers.get("x-voyant-step-auth")
      const body = JSON.stringify({
        attempt: 1,
        status: "ok",
        output: null,
        startedAt: 0,
        finishedAt: 1,
      })
      return new Response(body, {
        status: 200,
        headers: { "x-voyant-step-response-auth": `sig:${body.length}` },
      })
    })

    const runner = createCfContainerStepRunner({
      namespace,
      sign: (body) => `sig:${body.length}`,
    })
    await runner(
      baseArgs({
        options: { runtime: "node", machine: "standard-2", timeout: "30s" },
      }),
    )

    expect(captured.body).toMatchObject({
      runId: "run_42",
      workflowId: "process-upload",
      workflowVersion: "v1",
      stepId: "hash-source",
      attempt: 1,
      input: { bytes: 32_768 },
      options: { machine: "standard-2", timeout: "30s" },
    })
    expect(captured.auth).toMatch(/^sig:\d+$/)
  })

  it("rejects unsigned container responses when dispatch signing is enabled", async () => {
    const entry: StepJournalEntry = {
      attempt: 1,
      status: "ok",
      output: { hash: "sha256:abc" },
      startedAt: 100,
      finishedAt: 250,
    }
    const { namespace } = stubNamespace(() => new Response(JSON.stringify(entry), { status: 200 }))

    const runner = createCfContainerStepRunner({
      namespace,
      sign: (body) => `sig:${body.length}`,
    })
    const result = await runner(baseArgs())

    expect(result.status).toBe("err")
    expect(result.error?.code).toBe("CONTAINER_RESPONSE_SIGNATURE_INVALID")
  })

  it("returns a failed StepJournalEntry when the namespace fetch throws", async () => {
    const { namespace } = stubNamespace(() => {
      throw new Error("network down")
    })
    const runner = createCfContainerStepRunner({ namespace })
    const result = await runner(baseArgs())
    expect(result.status).toBe("err")
    expect(result.error?.code).toBe("CONTAINER_DISPATCH_FAILED")
    expect(result.error?.message).toMatch(/network down/)
  })

  it("returns a failed StepJournalEntry on non-200 response", async () => {
    const { namespace } = stubNamespace(() => new Response("boom", { status: 500 }))
    const runner = createCfContainerStepRunner({ namespace })
    const result = await runner(baseArgs())
    expect(result.status).toBe("err")
    expect(result.error?.code).toBe("CONTAINER_HTTP_ERROR")
    expect(result.error?.message).toMatch(/HTTP 500/)
  })

  it("returns a failed StepJournalEntry when the container body is not JSON", async () => {
    const { namespace } = stubNamespace(() => new Response("<html>oops</html>", { status: 200 }))
    const runner = createCfContainerStepRunner({ namespace })
    const result = await runner(baseArgs())
    expect(result.status).toBe("err")
    expect(result.error?.code).toBe("CONTAINER_INVALID_RESPONSE")
  })

  it("supports a custom containerId strategy", async () => {
    const { namespace, calls } = stubNamespace(
      () =>
        new Response(JSON.stringify({ attempt: 1, status: "ok", startedAt: 0, finishedAt: 1 }), {
          status: 200,
        }),
    )
    const runner = createCfContainerStepRunner({
      namespace,
      containerId: ({ workflowId, workflowVersion }) => `${workflowId}@${workflowVersion}`,
    })
    await runner(baseArgs())
    expect(calls[0]!.id).toBe("id_process-upload@v1")
  })

  it("logs via the provided logger hook", async () => {
    const { namespace } = stubNamespace(
      () =>
        new Response(JSON.stringify({ attempt: 1, status: "ok", startedAt: 0, finishedAt: 1 }), {
          status: 200,
        }),
    )
    const logger = vi.fn()
    const runner = createCfContainerStepRunner({ namespace, logger })
    await runner(baseArgs())
    expect(logger).toHaveBeenCalledWith(
      "info",
      "cf-container: dispatching step",
      expect.objectContaining({ runId: "run_42", stepId: "hash-source" }),
    )
  })

  it("calls resolveBundle with tenant identity and includes the result in the payload", async () => {
    let capturedBody: unknown
    const { namespace } = stubNamespace(async (req) => {
      capturedBody = await req.json()
      return new Response(
        JSON.stringify({ attempt: 1, status: "ok", startedAt: 0, finishedAt: 1 }),
        { status: 200 },
      )
    })
    const resolveBundle = vi.fn().mockResolvedValue({
      url: "https://r2.example.com/prj_42/v1/container.mjs?sig=...",
      hash: "sha256:abc123",
    })

    const runner = createCfContainerStepRunner({ namespace, resolveBundle })
    await runner(baseArgs())

    expect(resolveBundle).toHaveBeenCalledWith({
      runId: "run_42",
      workflowId: "process-upload",
      workflowVersion: "v1",
      projectId: "prj_42",
      organizationId: "org_42",
    })
    expect(capturedBody).toMatchObject({
      bundle: {
        url: "https://r2.example.com/prj_42/v1/container.mjs?sig=...",
        hash: "sha256:abc123",
      },
    })
  })

  it("returns BUNDLE_RESOLVE_FAILED when resolveBundle throws", async () => {
    const { namespace } = stubNamespace(
      () =>
        new Response(JSON.stringify({ attempt: 1, status: "ok", startedAt: 0, finishedAt: 1 }), {
          status: 200,
        }),
    )
    const runner = createCfContainerStepRunner({
      namespace,
      resolveBundle: () => {
        throw new Error("R2 key not found")
      },
    })
    const result = await runner(baseArgs())
    expect(result.status).toBe("err")
    expect(result.error?.code).toBe("BUNDLE_RESOLVE_FAILED")
    expect(result.error?.message).toMatch(/R2 key not found/)
  })

  it("omits bundle from the payload when resolveBundle is not wired", async () => {
    let capturedBody: Record<string, unknown> | undefined
    const { namespace } = stubNamespace(async (req) => {
      capturedBody = (await req.json()) as Record<string, unknown>
      return new Response(
        JSON.stringify({ attempt: 1, status: "ok", startedAt: 0, finishedAt: 1 }),
        { status: 200 },
      )
    })
    const runner = createCfContainerStepRunner({ namespace })
    await runner(baseArgs())
    expect(capturedBody).toBeDefined()
    expect(capturedBody!.bundle).toBeUndefined()
  })
})
