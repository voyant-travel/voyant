import { readFileSync } from "node:fs"
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
    expect(legalVoyantModule.events).toContainEqual({
      id: "@voyant-travel/legal#event.booking.contract.generated",
      eventType: "booking.contract.generated",
      version: "1.0.0",
      payloadSchema: { type: "object", additionalProperties: true },
      visibility: "internal",
      audit: { sourceModule: "legal", category: "domain" },
    })
  })

  it("owns the contract-document bridge", () => {
    expect(legalContractDocumentVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/legal#contract-document",
      packageName: "@voyant-travel/legal",
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
      runtime: {
        entry: "./booking-contract-subscriber",
        export: "createLegalBookingContractVoyantRuntime",
      },
      runtimePorts: [{ id: "legal.booking-contract-subscriber-runtime" }],
      subscribers: [
        {
          id: "@voyant-travel/legal#subscriber.booking-contract-confirmed",
          eventType: "booking.confirmed",
          source: "@voyant-travel/legal/booking-contract-subscriber",
          runtime: {
            entry: "./booking-contract-subscriber",
            export: "legalBookingContractConfirmedSubscriber",
          },
        },
      ],
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
