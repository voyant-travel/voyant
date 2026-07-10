import * as canonical from "@voyant-travel/public-document-delivery"
import { describe, expect, it } from "vitest"

import * as compatibility from "../../src/public-document-delivery.js"

describe("public document delivery compatibility export", () => {
  it("re-exports the canonical package implementation", () => {
    expect(compatibility.createPublicDocumentDeliveryGrant).toBe(
      canonical.createPublicDocumentDeliveryGrant,
    )
    expect(compatibility.createPublicDocumentDeliveryHonoModule).toBe(
      canonical.createPublicDocumentDeliveryHonoModule,
    )
  })
})
