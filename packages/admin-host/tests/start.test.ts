import { csrfSymbol } from "@tanstack/react-start"
import { describe, expect, it } from "vitest"

import { standardOperatorStart } from "../src/start"

describe("standardOperatorStart", () => {
  it("uses TanStack Start's recognized CSRF middleware", async () => {
    const options = await standardOperatorStart.getOptions()
    const middleware = options.requestMiddleware?.[0]

    expect(middleware).toBeDefined()
    expect(middleware && csrfSymbol in middleware).toBe(true)
  })
})
