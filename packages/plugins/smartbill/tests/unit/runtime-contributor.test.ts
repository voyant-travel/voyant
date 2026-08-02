import { describe, expect, it } from "vitest"

import { createSmartbillRuntimePortContribution } from "../../src/runtime-contributor.js"

describe("SmartBill runtime contributor", () => {
  it("registers the deployment host under the package-owned runtime port", () => {
    const host = {
      resolveDatabase: () => ({}) as never,
      resolveConfig: () => null,
    }

    expect(createSmartbillRuntimePortContribution({ host })).toEqual({
      "smartbill.runtime-host": host,
    })
  })
})
