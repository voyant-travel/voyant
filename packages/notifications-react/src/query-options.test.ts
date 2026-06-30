import { describe, expect, it } from "vitest"

import { getNotificationTemplateQueryOptions } from "./query-options.js"

describe("getNotificationTemplateQueryOptions", () => {
  it("keeps detail templates keyed by id without overriding app refetch defaults", () => {
    const options = getNotificationTemplateQueryOptions(
      { baseUrl: "", fetcher: fetch },
      "notification_template_123",
    )

    expect(options.queryKey).toEqual(["notifications", "templates", "notification_template_123"])
    expect(options.staleTime).toBeUndefined()
    expect(options.refetchOnWindowFocus).toBeUndefined()
  })
})
