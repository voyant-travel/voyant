import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class PipelineDeleteConflictError extends Error {
    constructor(
      readonly pipelineId: string,
      readonly dependentQuoteCount: number,
    ) {
      super(
        `Pipeline ${pipelineId} cannot be deleted because it has dependent ${dependentQuoteCount} quote(s)`,
      )
      this.name = "PipelineDeleteConflictError"
    }
  }

  class QuoteVersionConflictError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "QuoteVersionConflictError"
    }
  }

  class QuoteVersionParentNotFoundError extends Error {
    constructor(quoteId: string) {
      super(`Quote not found: ${quoteId}`)
      this.name = "QuoteVersionParentNotFoundError"
    }
  }

  return {
    PipelineDeleteConflictError,
    QuoteVersionConflictError,
    QuoteVersionParentNotFoundError,
    createQuoteVersion: vi.fn(),
    deletePipeline: vi.fn(),
  }
})

vi.mock("../../src/service/index.js", () => ({
  PipelineDeleteConflictError: mocks.PipelineDeleteConflictError,
  quotesService: {
    createQuoteVersion: mocks.createQuoteVersion,
    deletePipeline: mocks.deletePipeline,
  },
}))

vi.mock("../../src/service/quote-versions.js", () => ({
  QuoteVersionConflictError: mocks.QuoteVersionConflictError,
  QuoteVersionParentNotFoundError: mocks.QuoteVersionParentNotFoundError,
}))

const { pipelineRoutes } = await import("../../src/routes/pipelines.js")
const { quoteVersionRoutes } = await import("../../src/routes/quote-versions.js")

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

function makeApp() {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db" as never, {} as never)
    c.set("userId" as never, "test-user-id")
    await next()
  })
  app.route("/", pipelineRoutes)
  app.route("/", quoteVersionRoutes)
  return app
}

describe("Quotes route errors", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 404 when creating a quote version for a missing quote", async () => {
    mocks.createQuoteVersion.mockRejectedValueOnce(
      new mocks.QuoteVersionParentNotFoundError("not_a_quote_mr073yt6"),
    )

    const res = await makeApp().request("/quotes/not_a_quote_mr073yt6/versions", {
      method: "POST",
      ...json({ currency: "USD" }),
    })

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: "Quote not found" })
  })

  it("returns 409 when deleting a pipeline with dependent records", async () => {
    mocks.deletePipeline.mockRejectedValueOnce(new mocks.PipelineDeleteConflictError("pipe_123", 1))

    const res = await makeApp().request("/pipelines/pipe_123", { method: "DELETE" })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain("dependent")
    expect(body.error).toContain("quote")
  })
})
