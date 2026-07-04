import { describe, expect, it } from "vitest"
import { withOperatorApiServer } from "./docs"

describe("operator API docs", () => {
  it("points OpenAPI try-it-out requests at the starter API mount", () => {
    const spec = {
      openapi: "3.1.0",
      servers: [{ url: "/", description: "This deployment (same origin)" }],
      paths: {
        "/v1/public/catalog/search": {
          post: { summary: "POST /v1/public/catalog/search" },
        },
      },
    }

    const normalized = withOperatorApiServer(spec, "http://localhost:3300/api/")

    expect(normalized).toEqual({
      ...spec,
      servers: [
        {
          url: "http://localhost:3300/api",
          description: "Operator API via this starter's /api mount",
        },
      ],
    })
    expect(spec.servers).toEqual([{ url: "/", description: "This deployment (same origin)" }])
  })
})
