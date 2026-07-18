import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { describe, expect, it } from "vitest"

import type { IdentityAccessRuntimeProvider } from "./identity-access-runtime-port.js"
import { identityAccessRuntimePort } from "./identity-access-runtime-port.js"
import { createAuthRuntimePortContribution } from "./runtime-contributor.js"

describe("auth runtime contributor", () => {
  it("derives auth mode from deployment provider authority", () => {
    const contribution = createAuthRuntimePortContribution(hostWithAuthProvider("better-auth"))
    const runtime = contribution[identityAccessRuntimePort.id] as IdentityAccessRuntimeProvider

    expect(
      runtime.resolveDeployment({
        APP_URL: "https://operator.example",
        VOYANT_ADMIN_AUTH_MODE: "voyant-cloud",
      }),
    ).toMatchObject({
      appUrl: "https://operator.example",
      authMode: "local",
    })
  })

  it("fails closed when auth provider authority is absent", () => {
    const contribution = createAuthRuntimePortContribution(hostWithAuthProvider(undefined))
    const runtime = contribution[identityAccessRuntimePort.id] as IdentityAccessRuntimeProvider

    expect(() => runtime.resolveDeployment({})).toThrow(/deployment\.providers\.adminAuth/)
  })
})

function hostWithAuthProvider(provider: "better-auth" | "voyant-cloud" | undefined): {
  primitives: VoyantRuntimeHostPrimitives
} {
  return {
    primitives: {
      env: (bindings) => bindings as Readonly<Record<string, unknown>>,
      database: {} as VoyantRuntimeHostPrimitives["database"],
      storage: {} as VoyantRuntimeHostPrimitives["storage"],
      events: {} as VoyantRuntimeHostPrimitives["events"],
      config: {
        read: (_bindings, key) => (key === "deployment.providers.adminAuth" ? provider : undefined),
      },
    },
  }
}
