import { notificationTemplateVariableCatalog } from "@voyant-travel/notifications/template-authoring"
import { describe, expect, it } from "vitest"

import {
  buildSamplePayload,
  resolvePreviewDataInput,
  resolveTemplateMutationStatus,
} from "./notification-template-dialog-utils.js"

describe("buildSamplePayload", () => {
  it("keeps built-in scalar template variables available in preview sample data", () => {
    const sample = buildSamplePayload(notificationTemplateVariableCatalog)

    expect(sample).toMatchObject({
      traveler: {
        firstName: "Arthur",
      },
      booking: {
        reference: "BKG-2026-00125",
      },
    })
  })

  it("builds structured arrays from array catalog variables and indexed descendants", () => {
    const sample = buildSamplePayload(notificationTemplateVariableCatalog)

    expect(sample).toMatchObject({
      travelers: [
        {
          firstName: "Arthur",
          lastName: "Silva",
        },
      ],
      items: [
        {
          title: "Double Room",
          quantity: 1,
        },
      ],
      documents: [
        {
          name: "Invoice 42",
          type: "invoice",
        },
      ],
    })
  })

  it("replaces array-like primitive examples when nested paths need a container", () => {
    const sample = buildSamplePayload([
      {
        variables: [
          { key: "travelers", example: '[{ firstName: "Arthur" }]', type: "string" },
          { key: "travelers[0].firstName", example: "Arthur", type: "string" },
        ],
      },
    ])

    expect(sample).toEqual({
      travelers: [
        {
          firstName: "Arthur",
        },
      ],
    })
  })
})

describe("resolvePreviewDataInput", () => {
  it("uses the built-in sample data when preview JSON has not been edited", () => {
    const fallback = '{"booking":{"reference":"BKG-2026-00125"}}'

    expect(resolvePreviewDataInput("", fallback)).toBe(fallback)
    expect(resolvePreviewDataInput("   ", fallback)).toBe(fallback)
  })

  it("keeps edited preview JSON as the render input", () => {
    const input = '{"booking":{"reference":"CUSTOM"}}'

    expect(resolvePreviewDataInput(input, "{}")).toBe(input)
  })
})

describe("resolveTemplateMutationStatus", () => {
  it("promotes the create dialog default active toggle to an active template", () => {
    expect(resolveTemplateMutationStatus({ status: "draft", active: true })).toBe("active")
  })

  it("keeps an explicit active status selected while editing a draft template", () => {
    expect(resolveTemplateMutationStatus({ status: "active", active: false })).toBe("active")
  })

  it("keeps draft and archived explicit statuses when the active toggle is off", () => {
    expect(resolveTemplateMutationStatus({ status: "draft", active: false })).toBe("draft")
    expect(resolveTemplateMutationStatus({ status: "archived", active: false })).toBe("archived")
  })
})
