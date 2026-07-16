import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  CustomFieldsUiMessagesProvider,
  getCustomFieldsUiI18n,
  resolveCustomFieldsUiMessages,
  useCustomFieldsUiMessagesOrDefault,
} from "./i18n/index.js"

describe("custom-fields i18n", () => {
  it("resolves localized package messages with fallback and overrides", () => {
    const result = resolveCustomFieldsUiMessages({
      locale: "ro-RO",
      overrides: {
        locales: {
          ro: {
            page: { title: "Campuri configurabile" },
          },
        },
      },
    })

    expect(result.page.title).toBe("Campuri configurabile")
    expect(result.sheet.fieldTypeLabels.text).toBe("Text lung")
  })

  it("returns locale-aware formatters from the package helper", () => {
    const result = getCustomFieldsUiI18n({ locale: "ro-RO" })

    expect(result.locale).toBe("ro-RO")
    expect(result.formatNumber(1200)).toBe(new Intl.NumberFormat("ro-RO").format(1200))
  })

  it("renders English copy without a provider", () => {
    const html = renderToStaticMarkup(<CustomFieldsMessageProbe />)

    expect(html).toContain("Custom fields")
    expect(html).toContain("Add field")
    expect(html).toContain("Short text")
  })

  it("renders Romanian copy with the package provider", () => {
    const html = renderToStaticMarkup(
      <CustomFieldsUiMessagesProvider locale="ro-RO">
        <CustomFieldsMessageProbe />
      </CustomFieldsUiMessagesProvider>,
    )

    expect(html).toContain("Campuri personalizate")
    expect(html).toContain("Adauga camp")
    expect(html).toContain("Text scurt")
  })
})

function CustomFieldsMessageProbe() {
  const messages = useCustomFieldsUiMessagesOrDefault()

  return (
    <div>
      <span>{messages.page.title}</span>
      <span>{messages.page.addField}</span>
      <span>{messages.sheet.fieldTypeLabels.varchar}</span>
    </div>
  )
}
