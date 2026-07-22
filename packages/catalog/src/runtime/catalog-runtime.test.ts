import { describe, expect, it } from "vitest"
import { createFieldPolicyRegistry, defineFieldPolicy } from "../contract.js"
import {
  CATALOG_VERTICALS,
  createReferencedSubjectDocumentBuilderContext,
  loadCatalogSlices,
} from "./catalog-runtime.js"
import { configureCatalogRuntimeHost } from "./host.js"

function createRuntimeDb(
  markets: readonly { id: string; defaultLanguageTag: string }[],
  locales: readonly { marketId: string; languageTag: string }[],
  channelIds: readonly string[],
) {
  const db = {} as never
  configureCatalogRuntimeHost(
    {} as never,
    {
      commerce: { loadSliceInputs: async () => ({ markets, locales }) },
      distribution: { loadActiveChannelIds: async () => channelIds },
    } as never,
  )
  return db
}

describe("loadCatalogSlices", () => {
  it("materializes channelled default-market customer slices for active channels", async () => {
    const slices = await loadCatalogSlices(createRuntimeDb([], [], ["chan_website"]))

    for (const vertical of CATALOG_VERTICALS) {
      expect(slices).toContainEqual({
        vertical,
        locale: "en-GB",
        audience: "customer",
        market: "default",
      })
      expect(slices).toContainEqual({
        vertical,
        locale: "en-GB",
        audience: "customer",
        market: "default",
        channel: "chan_website",
      })
    }
  })

  it("preserves legacy unchannelled customer slices when active channels exist", async () => {
    const slices = await loadCatalogSlices(
      createRuntimeDb(
        [
          {
            id: "mkt_uk",
            defaultLanguageTag: "en-GB",
          },
        ],
        [
          {
            marketId: "mkt_uk",
            languageTag: "fr-FR",
          },
        ],
        ["chan_website", "chan_b2b"],
      ),
    )
    const productCustomerSlices = slices.filter(
      (slice) =>
        slice.vertical === "products" && slice.audience === "customer" && slice.market === "mkt_uk",
    )

    expect(productCustomerSlices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locale: "en-GB", channel: undefined }),
        expect.objectContaining({ locale: "en-GB", channel: "chan_website" }),
        expect.objectContaining({ locale: "en-GB", channel: "chan_b2b" }),
        expect.objectContaining({ locale: "fr-FR", channel: undefined }),
        expect.objectContaining({ locale: "fr-FR", channel: "chan_website" }),
        expect.objectContaining({ locale: "fr-FR", channel: "chan_b2b" }),
      ]),
    )
  })
})

describe("referenced subject document context", () => {
  it("resolves the canonical sourced projection with slice-scoped overlays", async () => {
    const source = {
      entity_module: "cruise-ships",
      entity_id: "crsh_1",
      status: "active",
      projection: { name: "Provider name" },
    }
    const overlays = [
      {
        field_path: "name",
        node_kind: "root",
        node_key: "root",
        locale: "ro-RO",
        audience: "customer",
        market: "RO",
        value: "Nume operator",
        version: 1,
        id: "overlay_1",
      },
    ]
    const db = {
      select(selection?: unknown) {
        return {
          from() {
            return {
              where() {
                return selection
                  ? Promise.resolve(overlays)
                  : { limit: async () => [source] }
              },
            }
          },
        }
      },
    }
    const registry = createFieldPolicyRegistry(
      defineFieldPolicy([
        {
          path: "name",
          class: "merchandisable",
          merge: "replace",
          editRole: "marketing",
          visibility: ["staff", "customer"],
          overrideFriction: "none",
          snapshot: "on-book",
          localized: true,
        },
      ]),
    )
    const context = createReferencedSubjectDocumentBuilderContext(
      db as never,
      { locale: "ro-RO", audience: "customer", market: "RO" },
      new Map([["cruise-ships", registry]]),
    )

    const resolved = await context.resolveReferencedSubject({
      entityModule: "cruise-ships",
      entityId: "crsh_1",
    })

    expect(resolved?.values.get("name")).toBe("Nume operator")
    expect(resolved?.scope).toEqual({ locale: "ro-RO", audience: "customer", market: "RO" })
  })

  it("applies overlays to caller-supplied owned subject values", async () => {
    const overlays = [
      {
        field_path: "name",
        locale: "ro-RO",
        audience: "customer",
        market: "RO",
        value: "Hotel operator",
      },
    ]
    const db = {
      select(selection?: unknown) {
        return {
          from() {
            return {
              where() {
                return selection ? Promise.resolve(overlays) : { limit: async () => [] }
              },
            }
          },
        }
      },
    }
    const registry = createFieldPolicyRegistry(
      defineFieldPolicy([
        {
          path: "name",
          class: "merchandisable",
          merge: "replace",
          editRole: "marketing",
          visibility: ["staff", "customer"],
          overrideFriction: "none",
          snapshot: "on-book",
          localized: true,
        },
      ]),
    )
    const context = createReferencedSubjectDocumentBuilderContext(
      db as never,
      { locale: "ro-RO", audience: "customer", market: "RO" },
      new Map([["accommodation-properties", registry]]),
    )

    const resolved = await context.resolveReferencedSubject({
      entityModule: "accommodation-properties",
      entityId: "prop_1",
      sourceValues: new Map([["name", "Source hotel"]]),
    })

    expect(resolved?.values.get("name")).toBe("Hotel operator")
  })
})
