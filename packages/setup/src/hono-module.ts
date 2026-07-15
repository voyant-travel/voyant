import { OpenAPIHono } from "@hono/zod-openapi"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { HonoModule } from "@voyant-travel/hono/module"

export const SETUP_ROUTE_PATHS = ["/v1/admin/setup", "/v1/admin/setup/*"] as const

export interface SetupHonoModuleOptions {
  prefill?: Readonly<Record<string, unknown>>
}

export function createSetupHonoModule(options: SetupHonoModuleOptions = {}): HonoModule {
  return {
    module: { name: "setup" },
    lazyRoutes: {
      paths: SETUP_ROUTE_PATHS,
      load: () =>
        import("./routes.js").then((module) => {
          const app = new OpenAPIHono({ defaultHook: openApiValidationHook })
          app.route("/", module.createSetupRoutes({ prefill: options.prefill }))
          return app
        }),
    },
  }
}

export const createSetupVoyantRuntime = defineGraphRuntimeFactory(({ projectConfig }) =>
  createSetupHonoModule({ prefill: readSetupPrefill(projectConfig.prefill) }),
)

export function readSetupPrefill(value: unknown): Readonly<Record<string, unknown>> {
  if (value === undefined) return {}
  if (!isPlainRecord(value))
    throw new TypeError("setup.prefill must be a JSON object keyed by step id.")
  assertNoSecretLikeKeys(value)
  return value
}

function assertNoSecretLikeKeys(value: unknown, path = "prefill"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertNoSecretLikeKeys(entry, `${path}[${index}]`)
    })
    return
  }
  if (!isPlainRecord(value)) return
  for (const [key, entry] of Object.entries(value)) {
    if (/(secret|password|token|credential|api.?key)/i.test(key)) {
      throw new TypeError(
        `setup.${path}.${key} is secret-like; use the graph secrets facet instead.`,
      )
    }
    assertNoSecretLikeKeys(entry, `${path}.${key}`)
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
