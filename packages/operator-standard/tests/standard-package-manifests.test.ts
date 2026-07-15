import { bookingsVoyantModule } from "@voyant-travel/bookings/voyant"
import { financeVoyantModule } from "@voyant-travel/finance/voyant"
import navigationPreferencesVoyantModule from "@voyant-travel/navigation-preferences/voyant"
import { storefrontVoyantModule } from "@voyant-travel/storefront/voyant"
import { describe, expect, it } from "vitest"
import {
  defineProject,
  resolveDeploymentGraph,
  validateGraphUnitManifest,
} from "../../framework/src/deployment-graph.js"
import {
  STANDARD_OPERATOR_DEPLOYMENT,
  STANDARD_OPERATOR_DISTRIBUTION_POLICY,
} from "../src/index.js"

describe("standard package manifests", () => {
  it("selects durable Postgres outbound webhook enqueueing explicitly", () => {
    expect(STANDARD_OPERATOR_DEPLOYMENT.providers?.outboundWebhooks).toBe("postgres")
  })

  it("resolves a package-owned module manifest without starter synthesis", async () => {
    expect(validateGraphUnitManifest(bookingsVoyantModule, "module")).toEqual([])

    const graph = await resolveDeploymentGraph({
      project: defineProject({ modules: [bookingsVoyantModule] }),
      target: "node",
      mode: "self-hosted",
    })

    expect(graph.modules[0]).toMatchObject({
      id: "@voyant-travel/bookings",
      api: [
        {
          id: "@voyant-travel/bookings#api.admin",
          runtime: { entry: "@voyant-travel/bookings", export: "createBookingsHonoModule" },
        },
        {
          id: "@voyant-travel/bookings#api.public",
          runtime: { entry: "@voyant-travel/bookings", export: "createBookingsHonoModule" },
        },
      ],
      schema: [{ id: "@voyant-travel/bookings#schema" }],
      migrations: [{ id: "@voyant-travel/bookings#migrations" }],
      links: [{ id: "@voyant-travel/bookings#linkable.booking" }],
    })
  })

  it("keeps the Storefront presentation as selected graph authority", async () => {
    expect(validateGraphUnitManifest(storefrontVoyantModule)).toEqual([])
    expect(validateGraphUnitManifest(financeVoyantModule)).toEqual([])
    expect(storefrontVoyantModule.meta).not.toHaveProperty("presentation")

    const graph = await resolveDeploymentGraph({
      project: defineProject({ modules: [storefrontVoyantModule] }),
      target: "node",
      mode: "self-hosted",
      packageRecords: [
        { packageName: "@voyant-travel/storefront", source: { kind: "workspace" } },
        { packageName: "@voyant-travel/storefront-react", source: { kind: "workspace" } },
      ],
    })
    expect(graph.modules[0]?.presentations).toEqual([
      {
        id: "@voyant-travel/storefront#presentation.customer",
        runtime: {
          entry: "@voyant-travel/storefront-react/storefront",
          export: "createStorefrontPresentationContribution",
        },
      },
    ])
  })

  it("selects durable self-hosted workflow execution by default", () => {
    expect(STANDARD_OPERATOR_DEPLOYMENT).toMatchObject({
      mode: "self-hosted",
      providers: { workflows: "self-hosted" },
    })
  })

  it("requires navigation preferences in the standard operator graph", () => {
    expect(validateGraphUnitManifest(navigationPreferencesVoyantModule, "module")).toEqual([])
    expect(
      STANDARD_OPERATOR_DISTRIBUTION_POLICY.modules.find(
        (selection) => selection.resolve === "@voyant-travel/navigation-preferences",
      ),
    ).toEqual({ resolve: "@voyant-travel/navigation-preferences", required: true })
    expect(
      STANDARD_OPERATOR_DISTRIBUTION_POLICY.modules.find(
        (selection) => selection.resolve === "@voyant-travel/setup",
      ),
    ).toEqual({ resolve: "@voyant-travel/setup", required: true })
  })
})
