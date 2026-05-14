import { beforeEach, describe, expect, it, vi } from "vitest"

const crmMocks = vi.hoisted(() => ({
  createCustomerSignal: vi.fn(),
  createPerson: vi.fn(),
  deleteCustomerSignal: vi.fn(),
  deletePerson: vi.fn(),
  updateCustomerSignal: vi.fn(),
}))

vi.mock("@voyantjs/crm", () => ({
  crmService: crmMocks,
}))

import { subscribeStorefrontNewsletter } from "../../src/service-intake.js"
import type { StorefrontNewsletterSubscribeInput } from "../../src/validation.js"

function createDbWithoutExistingSignals() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
  }
}

function createSignalRow(data: Record<string, unknown>) {
  return {
    id: "csig_newsletter",
    personId: data.personId,
    kind: data.kind,
    source: data.source,
    status: data.status,
    productId: null,
    optionUnitId: null,
    sourceSubmissionId: data.sourceSubmissionId,
    metadata: data.metadata,
  }
}

describe("subscribeStorefrontNewsletter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    crmMocks.createPerson.mockResolvedValue({ id: "pers_newsletter" })
    crmMocks.createCustomerSignal.mockImplementation(async (_db, data) => createSignalRow(data))
    crmMocks.updateCustomerSignal.mockImplementation(async (_db, _id, data) => ({
      ...createSignalRow({}),
      metadata: data.metadata,
    }))
    crmMocks.deleteCustomerSignal.mockResolvedValue({ id: "csig_newsletter" })
    crmMocks.deletePerson.mockResolvedValue({ id: "pers_newsletter" })
  })

  it("does not persist requested double opt-in until the hook succeeds", async () => {
    const db = createDbWithoutExistingSignals()
    const eventBus = { emit: vi.fn() }
    const requestDoubleOptIn = vi
      .fn()
      .mockRejectedValueOnce(new Error("mail provider down"))
      .mockResolvedValueOnce(undefined)
    const body = {
      email: "News@Example.com",
      sourceSubmissionId: "newsletter_homepage_news@example.com",
      tags: [],
      payload: {},
      consent: {
        newsletter: true,
        gdpr: true,
      },
    } satisfies StorefrontNewsletterSubscribeInput

    await expect(
      subscribeStorefrontNewsletter({
        body,
        context: { db: db as never, eventBus },
        requestDoubleOptIn,
      }),
    ).rejects.toThrow("mail provider down")

    expect(crmMocks.createCustomerSignal.mock.calls[0]?.[1].metadata.newsletter).toEqual({
      email: "news@example.com",
      doubleOptIn: "not_configured",
    })
    expect(crmMocks.updateCustomerSignal).not.toHaveBeenCalled()
    expect(crmMocks.deleteCustomerSignal).toHaveBeenCalledWith(db, "csig_newsletter")
    expect(crmMocks.deletePerson).toHaveBeenCalledWith(db, "pers_newsletter")
    expect(eventBus.emit).not.toHaveBeenCalled()

    const result = await subscribeStorefrontNewsletter({
      body,
      context: { db: db as never, eventBus },
      requestDoubleOptIn,
    })

    expect(requestDoubleOptIn).toHaveBeenCalledTimes(2)
    expect(crmMocks.createCustomerSignal.mock.calls[1]?.[1].metadata.newsletter).toEqual({
      email: "news@example.com",
      doubleOptIn: "not_configured",
    })
    expect(crmMocks.updateCustomerSignal.mock.calls[0]?.[2].metadata.newsletter).toEqual({
      email: "news@example.com",
      doubleOptIn: "requested",
    })
    expect(result.doubleOptIn).toBe("requested")
    expect(eventBus.emit).toHaveBeenCalledTimes(1)
  })
})
