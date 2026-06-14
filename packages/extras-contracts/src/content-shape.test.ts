import { describe, expect, it } from "vitest"

import {
  EXTRAS_CONTENT_SCHEMA_VERSION,
  type ExtraContent,
  extraContentSchema,
  validateExtraContent,
} from "./index.js"

describe("@voyant-travel/extras-contracts content shape", () => {
  it("validates the extras/v1 rich content payload", () => {
    const content = extraContentSchema.parse({
      extra: { id: "prx_abc", name: "Airport Transfer", category: "transfer" },
      options: [{ id: "opt_private", name: "Private Vehicle" }],
      media: [{ url: "https://cdn.example.com/transfer.jpg" }],
      policies: [{ kind: "cancellation", body: "Free up to 24h before." }],
    }) satisfies ExtraContent

    expect(EXTRAS_CONTENT_SCHEMA_VERSION).toBe("extras/v1")
    expect(validateExtraContent(content)).toMatchObject({ valid: true })
    expect(content.options).toHaveLength(1)
    expect(content.media[0]?.type).toBe("image")
  })

  it("defaults the options, media, and policies arrays to empty", () => {
    const content = extraContentSchema.parse({
      extra: { id: "prx_abc", name: "Spa Day Pass" },
    }) satisfies ExtraContent

    expect(content.options).toEqual([])
    expect(content.media).toEqual([])
    expect(content.policies).toEqual([])
  })

  it("rejects payloads missing the required extra summary", () => {
    expect(validateExtraContent({ options: [] })).toMatchObject({ valid: false })
    expect(validateExtraContent({ extra: { id: "x" } })).toMatchObject({ valid: false })
  })

  it("rejects unknown policy kinds and media types", () => {
    expect(
      validateExtraContent({
        extra: { id: "prx_abc", name: "Airport Transfer" },
        policies: [{ kind: "loyalty", body: "x" }],
      }),
    ).toMatchObject({ valid: false })
    expect(
      validateExtraContent({
        extra: { id: "prx_abc", name: "Airport Transfer" },
        media: [{ url: "https://cdn.example.com/x.bin", type: "audio" }],
      }),
    ).toMatchObject({ valid: false })
  })
})
