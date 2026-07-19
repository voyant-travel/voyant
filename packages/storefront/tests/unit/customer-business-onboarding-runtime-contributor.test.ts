import { customerBusinessAccountOnboardingRuntimePort } from "@voyant-travel/auth/customer-business-onboarding-runtime-port"
import { describe, expect, it, vi } from "vitest"

import { createStorefrontRuntimePortContribution } from "../../src/runtime-contributor.js"

function primitives() {
  return {
    env: vi.fn(() => ({})),
    database: {
      resolve: vi.fn(),
      fromContext: vi.fn(),
      transaction: vi.fn(),
    },
    storage: {
      resolve: vi.fn(),
      read: vi.fn(),
      downloadUrl: vi.fn(),
    },
    events: { deliver: vi.fn() },
    config: { read: vi.fn() },
  }
}

describe("storefront customer business onboarding runtime contribution", () => {
  it("provides the standard implementation when the host has no override", () => {
    const ports = createStorefrontRuntimePortContribution({ primitives: primitives() })
    expect(ports[customerBusinessAccountOnboardingRuntimePort.id]).toBeDefined()
  })

  it("omits the standard implementation when a self-hoster seeded an override", () => {
    const ports = createStorefrontRuntimePortContribution({
      primitives: primitives(),
      hasRuntimePort: ({ id }) => id === customerBusinessAccountOnboardingRuntimePort.id,
    })
    expect(ports).not.toHaveProperty(customerBusinessAccountOnboardingRuntimePort.id)
  })
})
