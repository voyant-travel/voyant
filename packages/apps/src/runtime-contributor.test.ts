import { describe, expect, it } from "vitest"
import { createAppsRuntimePortContribution } from "./runtime-contributor.js"
import { appsManagedAuthRuntimePort } from "./runtime-port.js"

function host(values: Readonly<Record<string, unknown>>) {
  return {
    hasRuntimePort: () => false,
    primitives: {
      config: { read: (_bindings: unknown, key: string) => values[key] },
    },
  }
}

describe("createAppsRuntimePortContribution", () => {
  it("stays off unless both managed-auth inputs are present", () => {
    expect(createAppsRuntimePortContribution(host({}))).toEqual({})
    expect(
      createAppsRuntimePortContribution(host({ VOYANT_APP_RUNTIME_AUDIENCE: "deployment-1" })),
    ).toEqual({})
  })

  it("contributes validated provider-neutral managed-auth configuration", () => {
    const contribution = createAppsRuntimePortContribution(
      host({
        VOYANT_APP_RUNTIME_AUDIENCE: "  deployment-1  ",
        VOYANT_APP_SESSION_TOKEN_SIGNING_SECRET: "s".repeat(32),
        VOYANT_APP_SESSION_TOKEN_TTL_SECONDS: "180",
      }),
    )

    expect(contribution).toEqual({
      [appsManagedAuthRuntimePort.id]: {
        runtimeAudience: "deployment-1",
        sessionTokenSigningSecret: "s".repeat(32),
        sessionTokenTtlSeconds: 180,
      },
    })
  })

  it("does not replace an explicitly host-provided managed-auth port", () => {
    const contribution = createAppsRuntimePortContribution({
      ...host({
        VOYANT_APP_RUNTIME_AUDIENCE: "deployment-from-env",
        VOYANT_APP_SESSION_TOKEN_SIGNING_SECRET: "s".repeat(32),
      }),
      hasRuntimePort: (port) => port.id === appsManagedAuthRuntimePort.id,
    })

    expect(contribution).toEqual({})
  })

  it("rejects weak signing material and long-lived session tokens", () => {
    expect(() =>
      createAppsRuntimePortContribution(
        host({
          VOYANT_APP_RUNTIME_AUDIENCE: "deployment-1",
          VOYANT_APP_SESSION_TOKEN_SIGNING_SECRET: "test-secret",
        }),
      ),
    ).toThrow(/at least 32 characters/)

    expect(() =>
      createAppsRuntimePortContribution(
        host({
          VOYANT_APP_RUNTIME_AUDIENCE: "deployment-1",
          VOYANT_APP_SESSION_TOKEN_SIGNING_SECRET: "s".repeat(32),
          VOYANT_APP_SESSION_TOKEN_TTL_SECONDS: "301",
        }),
      ),
    ).toThrow(/1 through 300/)
  })
})
