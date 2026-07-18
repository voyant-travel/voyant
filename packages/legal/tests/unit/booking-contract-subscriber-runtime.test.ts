import type { EventEnvelope } from "@voyant-travel/core"
import { createContainer, createEventBus } from "@voyant-travel/core"
import { assertPortConforms } from "@voyant-travel/core/project"
import type { StorageProvider } from "@voyant-travel/storage"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import {
  createLegalBookingContractSubscriberDescriptor,
  createLegalBookingContractVoyantRuntime,
  LEGAL_BOOKING_CONTRACT_SUBSCRIBER_ID,
  LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY,
  type LegalBookingContractSubscriberRuntime,
  legalBookingContractSubscriberRuntimePort,
} from "../../src/contracts/booking-contract-subscriber-runtime.js"
import type { ResolveContractVariablesFn } from "../../src/contracts/service-auto-generate.js"
import type { ContractDocumentGenerator } from "../../src/contracts/service-documents.js"

const bookingEvent = {
  name: "booking.confirmed",
  data: {
    bookingId: "booking_1",
    bookingNumber: "BK-1",
    actorId: "user_1",
    suppressNotifications: true,
  },
  emittedAt: new Date().toISOString(),
  metadata: undefined,
} satisfies EventEnvelope

function harness(options: { enabled?: boolean } = {}) {
  const db = {} as PostgresJsDatabase
  const bindings = { DATABASE_URL: "postgres://legal" }
  const documentGenerator = vi.fn<ContractDocumentGenerator>()
  const documentStorage = { name: "documents" } as StorageProvider
  const bookingPiiService = {} as never
  const lifecycleHooks = [vi.fn()]
  const resolveVariables = vi.fn() as ResolveContractVariablesFn
  const actionLedgerContext = {
    userId: "user_1",
    actor: "staff" as const,
    callerType: "internal" as const,
    isInternalRequest: true,
  }
  const withDb = vi.fn(async (_bindings, operation) => operation(db))
  const runtime: LegalBookingContractSubscriberRuntime<typeof bindings> = {
    options: {
      enabled: options.enabled ?? true,
      templateSlug: "customer-sales-agreement",
    },
    withDb,
    documentGenerator,
    documentStorage,
    bookingPiiService,
    lifecycleHooks,
    resolveVariables,
    resolveActionLedgerContext: vi.fn(() => actionLedgerContext),
  }
  const container = createContainer()
  const eventBus = createEventBus()
  vi.spyOn(eventBus, "emit")
  container.register(LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY, runtime)
  let handler: ((event: EventEnvelope) => Promise<void> | void) | undefined
  vi.spyOn(eventBus, "subscribe").mockImplementation((_eventType, registeredHandler) => {
    handler = registeredHandler as typeof handler
    return { unsubscribe: vi.fn() }
  })
  return { bindings, db, eventBus, handler: () => handler, runtime, withDb, container }
}

describe("Legal booking-contract subscriber runtime", () => {
  it("registers the package descriptor and forwards the complete Legal runtime context", async () => {
    const test = harness()
    const generateContract = vi.fn(async () => ({
      status: "ok" as const,
      contractId: "contract_1",
      attachmentId: "attachment_1",
    }))
    const descriptor = createLegalBookingContractSubscriberDescriptor({ generateContract })

    await descriptor.register({
      bindings: test.bindings,
      container: test.container,
      eventBus: test.eventBus,
    })
    expect(test.eventBus.subscribe).toHaveBeenCalledWith("booking.confirmed", expect.any(Function))
    await test.handler()?.(bookingEvent)

    expect({ id: descriptor.id, eventType: descriptor.eventType }).toEqual({
      id: LEGAL_BOOKING_CONTRACT_SUBSCRIBER_ID,
      eventType: "booking.confirmed",
    })
    expect(test.withDb).toHaveBeenCalledWith(test.bindings, expect.any(Function))
    expect(generateContract).toHaveBeenCalledWith(
      test.db,
      bookingEvent.data,
      expect.objectContaining({
        enabled: true,
        templateSlug: "customer-sales-agreement",
        resolveVariables: test.runtime.resolveVariables,
      }),
      expect.objectContaining({
        generator: test.runtime.documentGenerator,
        eventBus: test.eventBus,
        lifecycleHooks: test.runtime.lifecycleHooks,
        bookingPiiService: test.runtime.bookingPiiService,
        actionLedgerContext: expect.objectContaining({ userId: "user_1", actor: "staff" }),
        bindings: test.bindings,
      }),
    )
    expect(test.eventBus.emit).toHaveBeenCalledWith(
      "booking.contract.generated",
      {
        ...bookingEvent.data,
        contractId: "contract_1",
        attachmentId: "attachment_1",
      },
      { category: "internal", source: "service" },
    )
  })

  it("does not subscribe when the deployment host has no Legal runtime", async () => {
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")

    await createLegalBookingContractSubscriberDescriptor().register({
      bindings: {},
      container: createContainer(),
      eventBus,
    })

    expect(subscribe).not.toHaveBeenCalled()
  })

  it("registers the host runtime only through the selected graph extension", async () => {
    const test = harness()
    const createRuntime = vi.fn(() => test.runtime)
    const output = await createLegalBookingContractVoyantRuntime({
      unitId: "@voyant-travel/legal#booking-contract-extension",
      projectConfig: {},
      getUnitProjectConfig: () => undefined,
      api: [],
      graph: {
        providerSelections: {},
        accessCatalog: { resources: [], presets: [] },
        references: [],
        setupSteps: [],
        tools: [],
      },
      runtimePorts: {},
      hasPort: () => true,
      getPort: async () => ({ createRuntime }),
      getPorts: async () => [],
    })
    const container = createContainer()

    await output.extension.bootstrap?.({
      bindings: test.bindings,
      container,
      eventBus: createEventBus(),
    })

    expect(createRuntime).toHaveBeenCalledWith(test.bindings)
    expect(container.resolve(LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY)).toBe(test.runtime)
  })

  it("publishes a conformance-tested subscriber host port", async () => {
    await expect(
      assertPortConforms(legalBookingContractSubscriberRuntimePort, {
        createRuntime: () => null,
      }),
    ).resolves.toBeUndefined()
    await expect(
      assertPortConforms(legalBookingContractSubscriberRuntimePort, {} as never),
    ).rejects.toThrow(/must implement createRuntime/)
  })

  it("filters disabled generation without opening a database context", async () => {
    const test = harness({ enabled: false })
    const generateContract = vi.fn()
    const descriptor = createLegalBookingContractSubscriberDescriptor({ generateContract })
    await descriptor.register({
      bindings: test.bindings,
      container: test.container,
      eventBus: test.eventBus,
    })

    await test.handler()?.(bookingEvent)

    expect(test.withDb).not.toHaveBeenCalled()
    expect(generateContract).not.toHaveBeenCalled()
  })

  it("does not treat notification suppression as Legal contract suppression", async () => {
    const test = harness()
    const generateContract = vi.fn(async () => ({
      status: "ok" as const,
      contractId: "contract_1",
      attachmentId: "attachment_1",
    }))
    const descriptor = createLegalBookingContractSubscriberDescriptor({ generateContract })
    await descriptor.register({
      bindings: test.bindings,
      container: test.container,
      eventBus: test.eventBus,
    })

    await test.handler()?.(bookingEvent)

    expect(generateContract).toHaveBeenCalledWith(
      test.db,
      expect.objectContaining({ suppressNotifications: true }),
      expect.any(Object),
      expect.any(Object),
    )
  })

  it("keeps missing operator configuration quiet and logs thrown failures", async () => {
    const skipped = harness()
    const logger = { error: vi.fn() }
    const generateContract = vi
      .fn()
      .mockResolvedValueOnce({ status: "template_not_found" })
      .mockRejectedValueOnce(new Error("database unavailable"))
    const descriptor = createLegalBookingContractSubscriberDescriptor({
      generateContract,
      logger,
    })
    await descriptor.register({
      bindings: skipped.bindings,
      container: skipped.container,
      eventBus: skipped.eventBus,
    })

    await expect(skipped.handler()?.(bookingEvent)).resolves.toBeUndefined()
    await expect(skipped.handler()?.(bookingEvent)).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      "[legal] auto-generate contract failed for booking booking_1: database unavailable",
    )
  })
})
