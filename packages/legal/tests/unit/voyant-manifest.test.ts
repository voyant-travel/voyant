import { readFileSync } from "node:fs"
import { commerceLegalRuntimePort } from "@voyant-travel/commerce/runtime-port"
import { describe, expect, it } from "vitest"
import {
  legalBookingContractVoyantExtension,
  legalContractDocumentVoyantModule,
  legalVoyantModule,
} from "../../src/voyant.js"

describe("legal deployment manifest", () => {
  it("owns the selected legal package surfaces", () => {
    expect(legalVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/legal",
      packageName: "@voyant-travel/legal",
      provides: {
        ports: [{ id: commerceLegalRuntimePort.id }, { id: "legal.runtime" }],
      },
      api: [
        {
          id: "@voyant-travel/legal#api.admin",
          surface: "admin",
          mount: "legal",
          openapi: { document: "legal" },
          transactional: true,
          runtime: {
            entry: "@voyant-travel/legal",
            export: "createLegalVoyantRuntime",
          },
        },
        {
          id: "@voyant-travel/legal#api.public",
          surface: "public",
          mount: "legal",
          openapi: { document: "legal" },
          anonymous: true,
          transactional: true,
          runtime: {
            entry: "@voyant-travel/legal",
            export: "createLegalVoyantRuntime",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/legal#schema" }],
      migrations: [{ id: "@voyant-travel/legal#migrations" }],
      runtimePorts: [{ id: "legal.runtime" }],
    })
    expect(legalVoyantModule.links?.map((link) => link.id)).toEqual([
      "@voyant-travel/legal#linkable.contract",
      "@voyant-travel/legal#linkable.contractTemplate",
      "@voyant-travel/legal#linkable.policy",
      "@voyant-travel/legal#linkable.policyVersion",
      "@voyant-travel/legal#linkable.policyAcceptance",
      "@voyant-travel/legal#linkable.term",
      "@voyant-travel/legal#link.contract-booking",
      "@voyant-travel/legal#link.contract-organization",
      "@voyant-travel/legal#link.contract-person",
      "@voyant-travel/legal#link.contract-supplier",
      "@voyant-travel/legal#link.policy-acceptance-booking",
      "@voyant-travel/legal#link.policy-product",
    ])
    expect(legalVoyantModule.links?.slice(0, 6).map((link) => link.export)).toEqual([
      "contractLinkable",
      "contractTemplateLinkable",
      "policyLinkable",
      "policyVersionLinkable",
      "policyAcceptanceLinkable",
      "legalTermLinkable",
    ])
    expect(legalVoyantModule.events?.map(({ eventType }) => eventType)).toEqual([
      "contract.issued",
      "contract.sent",
      "contract.signed",
      "contract.executed",
      "contract.voided",
      "contract.document.generated",
      "booking.contract.generated",
    ])
    expect(legalVoyantModule.tools).toHaveLength(18)
    expect(legalVoyantModule.actions?.flatMap((action) => action.from?.tools ?? [])).toEqual(
      expect.arrayContaining(legalVoyantModule.tools?.map((tool) => tool.id) ?? []),
    )
    expect(legalVoyantModule.meta?.agentTools).toBeUndefined()
  })

  it("declares concrete payloads for every emitted legal event", () => {
    const events = new Map(
      legalVoyantModule.events?.map(({ eventType, payloadSchema }) => [eventType, payloadSchema]),
    )

    for (const eventType of [
      "contract.issued",
      "contract.sent",
      "contract.signed",
      "contract.executed",
      "contract.voided",
    ]) {
      expect(events.get(eventType)).toMatchObject({
        type: "object",
        required: expect.arrayContaining([
          "contractId",
          "scope",
          "previousStage",
          "stage",
          "transition",
          "occurredAt",
          "targetKind",
        ]),
        additionalProperties: false,
      })
    }
    expect(events.get("contract.issued")).toMatchObject({
      properties: {
        previousStage: { enum: ["draft"] },
        stage: { const: "issued" },
        transition: { const: "issued" },
      },
    })
    expect(events.get("contract.document.generated")).toMatchObject({
      required: [
        "contractId",
        "contractStatus",
        "attachmentId",
        "attachmentKind",
        "attachmentName",
        "renderedBodyFormat",
        "regenerated",
      ],
      additionalProperties: false,
    })
    expect(events.get("booking.contract.generated")).toMatchObject({
      required: ["bookingId", "bookingNumber", "actorId", "contractId", "attachmentId"],
      properties: { suppressNotifications: { type: "boolean" } },
      additionalProperties: false,
    })
  })

  it("owns the contract-document bridge", () => {
    expect(legalContractDocumentVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/legal#contract-document",
      packageName: "@voyant-travel/legal",
      provides: { ports: [{ id: "legal.contract-document.runtime" }] },
      runtime: {
        entry: "@voyant-travel/legal/contract-document-routes",
        export: "createContractDocumentVoyantRuntime",
      },
      runtimePorts: [{ id: "legal.contract-document.runtime" }],
      api: [
        {
          id: "@voyant-travel/legal#contract-document.api",
          surface: "admin",
          resource: "legal",
          openapi: { document: "contract-document" },
          runtime: {
            entry: "@voyant-travel/legal/contract-document-routes",
            export: "createContractDocumentHonoModule",
          },
        },
      ],
    })
    expect(legalContractDocumentVoyantModule.tools).toHaveLength(4)
    expect(
      legalContractDocumentVoyantModule.tools?.every(
        (tool) => tool.runtime.entry === "@voyant-travel/legal/tools",
      ),
    ).toBe(true)
    expect(legalContractDocumentVoyantModule.meta?.agentTools).toBeUndefined()
  })

  it("marks every public OpenAPI operation with its graph API id", () => {
    const document = JSON.parse(
      readFileSync(new URL("../../openapi/storefront/legal.json", import.meta.url), "utf8"),
    )

    expect(publicOperationApiIds(document)).not.toHaveLength(0)
    expect(new Set(publicOperationApiIds(document))).toEqual(
      new Set(["@voyant-travel/legal#api.public"]),
    )
  })

  it("owns the executable booking-contract subscriber on its package-owned extension", () => {
    expect(legalVoyantModule.subscribers).toBeUndefined()
    expect(legalBookingContractVoyantExtension).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/legal#booking-contract-extension",
      packageName: "@voyant-travel/legal",
      provides: { ports: [{ id: "legal.booking-contract-subscriber-runtime" }] },
      runtime: {
        entry: "@voyant-travel/legal/booking-contract-subscriber",
        export: "createLegalBookingContractVoyantRuntime",
      },
      runtimePorts: [{ id: "legal.booking-contract-subscriber-runtime" }],
      subscribers: [
        {
          id: "@voyant-travel/legal#subscriber.booking-contract-confirmed",
          eventType: "booking.confirmed",
          source: "@voyant-travel/legal/booking-contract-subscriber",
          runtime: {
            entry: "@voyant-travel/legal/booking-contract-subscriber",
            export: "legalBookingContractConfirmedSubscriber",
          },
        },
      ],
    })
    expect(legalVoyantModule.provides?.ports).not.toContainEqual({
      id: "legal.booking-contract-subscriber-runtime",
    })
  })

  it("declares every route in the packaged legal admin extension", () => {
    expect(legalVoyantModule.admin?.routes?.map(({ id, path }) => [id, path])).toEqual([
      ["@voyant-travel/legal#admin.route.index", "/legal"],
      ["@voyant-travel/legal#admin.route.contracts-index", "/legal/contracts"],
      ["@voyant-travel/legal#admin.route.contracts-detail", "/legal/contracts/$id"],
      ["@voyant-travel/legal#admin.route.templates-index", "/legal/templates"],
      ["@voyant-travel/legal#admin.route.templates-detail", "/legal/templates/$id"],
      ["@voyant-travel/legal#admin.route.policies-index", "/legal/policies"],
      ["@voyant-travel/legal#admin.route.policies-detail", "/legal/policies/$id"],
      ["@voyant-travel/legal#admin.route.number-series", "/legal/number-series"],
    ])
    expect(
      legalVoyantModule.admin?.routes?.every(
        ({ runtime }) =>
          runtime.entry === "@voyant-travel/legal-react/admin" &&
          runtime.export === "createLegalAdminExtension",
      ),
    ).toBe(true)
    expect(
      legalVoyantModule.admin?.routes?.every(({ requiredScopes }) =>
        requiredScopes?.includes("legal:read"),
      ),
    ).toBe(true)
    expect(legalVoyantModule.admin?.nav).toEqual([
      {
        id: "@voyant-travel/legal#admin.nav.contracts",
        routeId: "@voyant-travel/legal#admin.route.contracts-index",
        label: { namespace: "legal.admin", key: "contractsPage.title" },
      },
      {
        id: "@voyant-travel/legal#admin.nav.templates",
        routeId: "@voyant-travel/legal#admin.route.templates-index",
        label: { namespace: "legal.admin", key: "templatesPage.title" },
      },
      {
        id: "@voyant-travel/legal#admin.nav.policies",
        routeId: "@voyant-travel/legal#admin.route.policies-index",
        label: { namespace: "legal.admin", key: "policiesPage.title" },
      },
      {
        id: "@voyant-travel/legal#admin.nav.number-series",
        routeId: "@voyant-travel/legal#admin.route.number-series",
        label: { namespace: "legal.admin", key: "numberSeriesPage.title" },
      },
    ])
  })
})

function publicOperationApiIds(document: unknown): unknown[] {
  const paths = (document as { paths?: Record<string, Record<string, unknown>> } | undefined)?.paths
  return Object.values(paths ?? {}).flatMap((path) =>
    Object.values(path).map(
      (operation) => (operation as Record<string, unknown>)["x-voyant-api-id"],
    ),
  )
}
