import { describe, expect, it } from "vitest"

import { composeNodeEnv } from "./env.js"
import type { KvNamespaceShim } from "./memory-kv.js"
import type { R2BucketShim } from "./r2.js"

const fakeKv = {} as KvNamespaceShim
const fakeR2 = {} as R2BucketShim

describe("composeNodeEnv", () => {
  it("spreads defined string vars and drops undefined", () => {
    const env = composeNodeEnv({ DATABASE_URL: "postgres://x", MISSING: undefined })
    expect(env.DATABASE_URL).toBe("postgres://x")
    expect("MISSING" in env).toBe(false)
  })

  it("attaches KV and R2 providers under their binding names", () => {
    const env = composeNodeEnv(
      { FOO: "bar" },
      { kv: { CACHE: fakeKv }, r2: { DOCUMENTS_BUCKET: fakeR2 } },
    )
    expect(env.FOO).toBe("bar")
    expect(env.CACHE).toBe(fakeKv)
    expect(env.DOCUMENTS_BUCKET).toBe(fakeR2)
  })

  it("lets a binding provider win over a same-named string var", () => {
    const env = composeNodeEnv({ CACHE: "should-be-overwritten" }, { kv: { CACHE: fakeKv } })
    expect(env.CACHE).toBe(fakeKv)
  })
})
