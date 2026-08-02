import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import * as graphRuntime from "../../src/graph-runtime.js"
import * as subscriberRuntime from "../../src/subscriber-runtime.js"

describe("SmartBill runtime public exports", () => {
  it("exports package-owned factories and the narrow host key", () => {
    expect(graphRuntime.createSmartbillOwnedSubscriberRuntime).toBeTypeOf("function")
    expect(graphRuntime.createSmartbillSettlementPollers).toBeTypeOf("function")
    expect(subscriberRuntime.SMARTBILL_RUNTIME_HOST_KEY).toBe("providers.smartbill.host")
  })

  it("publishes the dedicated graph-runtime entry", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    )
    expect(packageJson.exports["./graph-runtime"]).toBe("./src/graph-runtime.ts")
    expect(packageJson.publishConfig.exports["./graph-runtime"]).toEqual({
      types: "./dist/graph-runtime.d.ts",
      import: "./dist/graph-runtime.js",
      default: "./dist/graph-runtime.js",
    })
  })
})
