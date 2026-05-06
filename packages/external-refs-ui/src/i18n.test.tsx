import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import {
  ExternalRefsUiMessagesProvider,
  getExternalRefsUiI18n,
  resolveExternalRefsUiMessages,
  useExternalRefsUiI18nOrDefault,
} from "./i18n/index.js"

vi.mock("@voyantjs/external-refs-react", () => ({
  useExternalRefMutation() {
    return {
      create: { isPending: false, mutateAsync: vi.fn() },
      update: { isPending: false, mutateAsync: vi.fn() },
    }
  },
}))

describe("external-refs-ui i18n", () => {
  it("resolves localized package messages with fallback and overrides", () => {
    const result = resolveExternalRefsUiMessages({
      locale: "ro-RO",
      overrides: {
        locales: {
          ro: {
            externalRefDialog: {
              titles: {
                add: "Adauga legatura externa",
              },
            },
          },
        },
      },
    })

    expect(result.externalRefDialog.titles.add).toBe("Adauga legatura externa")
    expect(result.common.refStatusLabels.archived).toBe("Arhivat")
  })

  it("returns locale-aware formatters from the package helper", () => {
    const result = getExternalRefsUiI18n({ locale: "ro-RO" })

    expect(result.locale).toBe("ro-RO")
  })

  it("renders English copy without a provider", () => {
    const html = renderToStaticMarkup(<ExternalRefsProbe />)

    expect(html).toContain("Add External Ref")
    expect(html).toContain("Source system")
  })

  it("renders Romanian copy with the package provider", () => {
    const html = renderToStaticMarkup(
      <ExternalRefsUiMessagesProvider locale="ro-RO">
        <ExternalRefsProbe />
      </ExternalRefsUiMessagesProvider>,
    )

    expect(html).toContain("Adauga referinta externa")
    expect(html).toContain("Sistem sursa")
    expect(html).toContain("Anuleaza")
  })
})

function ExternalRefsProbe() {
  const { messages } = useExternalRefsUiI18nOrDefault()
  const m = messages.externalRefDialog

  return (
    <div>
      <span>{m.titles.add}</span>
      <span>{m.labels.sourceSystem}</span>
      <span>{m.actions.cancel}</span>
    </div>
  )
}
