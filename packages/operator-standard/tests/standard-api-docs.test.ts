import { describe, expect, it } from "vitest"

import { withOperatorApiServer } from "../src/standard-api-docs"

describe("withOperatorApiServer", () => {
  it("points package-owned documents at the operator API mount", () => {
    expect(
      withOperatorApiServer({ openapi: "3.1.0", servers: [{ url: "https://old.test" }] }, "/api/"),
    ).toEqual({
      openapi: "3.1.0",
      servers: [{ url: "/api", description: "Operator API" }],
    })
  })
})
