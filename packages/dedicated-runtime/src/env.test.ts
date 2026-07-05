import { describe, expect, it } from "vitest"

import { buildDedicatedEnv } from "./env.js"
import type { KvNamespaceShim } from "./kv.js"
import type { R2BucketShim } from "./r2.js"

const fakeKv = {} as KvNamespaceShim
const fakeR2 = {} as R2BucketShim

describe("buildDedicatedEnv", () => {
  it("spreads defined string vars and drops undefined", () => {
    const env = buildDedicatedEnv({ DATABASE_URL: "postgres://x", MISSING: undefined })
    expect(env.DATABASE_URL).toBe("postgres://x")
    expect("MISSING" in env).toBe(false)
  })

  it("attaches KV and R2 shims under their binding names", () => {
    const env = buildDedicatedEnv(
      { FOO: "bar" },
      { kv: { CACHE: fakeKv }, r2: { DOCUMENTS_BUCKET: fakeR2 } },
    )
    expect(env.FOO).toBe("bar")
    expect(env.CACHE).toBe(fakeKv)
    expect(env.DOCUMENTS_BUCKET).toBe(fakeR2)
  })

  it("lets a binding shim win over a same-named string var", () => {
    const env = buildDedicatedEnv({ CACHE: "should-be-overwritten" }, { kv: { CACHE: fakeKv } })
    expect(env.CACHE).toBe(fakeKv)
  })
})
