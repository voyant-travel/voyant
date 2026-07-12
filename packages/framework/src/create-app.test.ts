import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { createVoyantApp } from "./create-app.js"

describe("createVoyantApp", () => {
  it("composes only explicitly supplied local factories", () => {
    const app = createVoyantApp({
      providers: { value: "local" },
      db: {} as never,
      modules: {
        local: ({ capabilities }) => ({
          module: { name: capabilities.value },
          adminRoutes: new Hono(),
        }),
      },
      extensions: {
        notes: () => ({ extension: { name: "notes", module: "local" } }),
      },
    })

    expect(app.moduleMounts?.map(({ moduleName }) => moduleName)).toContain("local")
  })

  it("does not mount a framework-owned standard set", () => {
    const app = createVoyantApp({ providers: {}, db: {} as never })
    expect(app.moduleMounts).toEqual([])
  })
})
