import { BookOpenText } from "lucide-react"
import { describe, expect, it } from "vitest"

import {
  createEventCatalogAdminExtension,
  createSelectedEventCatalogAdminExtension,
} from "../src/admin.js"
import { eventCatalogMessageDefinitions } from "../src/i18n.js"

describe("event catalog admin extension", () => {
  it("contributes a lazy event reference route", async () => {
    const extension = createEventCatalogAdminExtension()
    const route = extension.routes?.[0]

    expect(extension.navigation?.[0]?.items[0]).toMatchObject({
      id: "event-catalog",
      title: "Event catalog",
      url: "/docs/events",
      icon: BookOpenText,
    })
    expect(route).toMatchObject({
      id: "event-catalog-index",
      path: "/docs/events",
      title: "Event catalog",
      ssr: false,
    })
    expect(typeof route?.page).toBe("function")
    expect(typeof route?.routeMessagesProvider).toBe("function")
    expect(typeof (await route?.routeMessagesProvider?.())?.default).toBe("function")
    expect(typeof (await route?.page?.())?.default).toBe("function")
  })

  it("uses the selected host navigation label", () => {
    const extension = createSelectedEventCatalogAdminExtension({
      navMessages: { eventCatalog: "Event contracts" },
    })

    expect(extension.navigation?.[0]?.items[0]?.title).toBe("Event contracts")
    expect(extension.routes?.[0]?.title).toBe("Event contracts")
  })

  it("owns navigation and complete page copy in its package definitions", () => {
    expect(eventCatalogMessageDefinitions.en).toMatchObject({
      navigation: { title: "Event catalog" },
      page: {
        title: "Event catalog",
        filterPlaceholder: "Filter events",
        redactedFields: "Redacted fields",
        payloadSchema: "Payload schema",
      },
    })
  })
})
