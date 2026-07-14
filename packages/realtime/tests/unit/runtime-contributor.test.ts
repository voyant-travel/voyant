import { describe, expect, it, vi } from "vitest"

import { createRealtimeRuntimePortContribution } from "../../src/runtime-contributor.js"
import { realtimeRuntimePort, realtimeTransportRuntimePort } from "../../src/runtime-port.js"
import type { RealtimeProvider } from "../../src/types.js"

function runtimeOptions(contribution: Readonly<Record<string, unknown>>) {
  return contribution[realtimeRuntimePort.id] as {
    resolveProviders(bindings: Record<string, unknown>): readonly RealtimeProvider[]
  }
}

function provider(name = "selected"): RealtimeProvider {
  return {
    name,
    publish: vi.fn(async () => undefined),
    mintClientToken: vi.fn(async () => ({ token: "token", expiresAt: "2099-01-01" })),
  }
}

describe("realtime runtime contributor", () => {
  it("keeps realtime inert when deployment selection supplies no transport", () => {
    const contribution = createRealtimeRuntimePortContribution({
      primitives: {} as never,
      hasRuntimePort: () => false,
      getRuntimePort: () => {
        throw new Error("unexpected transport lookup")
      },
    })

    expect(runtimeOptions(contribution).resolveProviders({})).toEqual([])
  })

  it("resolves exactly the selected or explicitly hosted transport", () => {
    const selected = provider()
    const getRuntimePort = vi.fn(() => selected)
    const contribution = createRealtimeRuntimePortContribution({
      primitives: {} as never,
      hasRuntimePort: (port) => port.id === realtimeTransportRuntimePort.id,
      getRuntimePort,
    })

    expect(runtimeOptions(contribution).resolveProviders({ ignored: true })).toEqual([selected])
    expect(getRuntimePort).toHaveBeenCalledWith(realtimeTransportRuntimePort)
  })
})
