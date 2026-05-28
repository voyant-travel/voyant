import { describe, expect, it } from "vitest"

import { sourceRefIdentityJson } from "../../src/service-search.js"

describe("cruisesSearchService sourceRef identity", () => {
  it("keeps connection and provider context in external search-index identity", () => {
    const first = sourceRefIdentityJson({
      externalId: "same-id",
      connectionId: "conn-a",
      provider: "line-a",
    })
    const second = sourceRefIdentityJson({
      externalId: "same-id",
      connectionId: "conn-b",
      provider: "line-a",
    })

    expect(first).not.toBe(second)
  })

  it("is deterministic for nested SourceRef metadata", () => {
    const first = sourceRefIdentityJson({
      externalId: "same-id",
      metadata: { b: 2, a: 1 },
    })
    const second = sourceRefIdentityJson({
      metadata: { a: 1, b: 2 },
      externalId: "same-id",
    })

    expect(first).toBe(second)
  })
})
