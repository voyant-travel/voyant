import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  AuthUiMessagesProvider,
  getAuthUiI18n,
  resolveAuthUiMessages,
  useAuthUiMessagesOrDefault,
} from "./i18n/index.js"

describe("auth-ui i18n", () => {
  it("resolves romanian messages with fallback", () => {
    const messages = getAuthUiI18n({ locale: "ro-RO" }).messages

    expect(messages.serviceApiKeysPage.title).toBe("Tokenuri API")
    expect(messages.serviceApiKeysPage.create.submit).toBe("Creeaza token")
  })

  it("applies overrides", () => {
    const messages = resolveAuthUiMessages({
      locale: "ro",
      overrides: {
        locales: {
          ro: {
            serviceApiKeysPage: {
              list: {
                refresh: "Actualizeaza",
              },
            },
          },
        },
      },
    })

    expect(messages.serviceApiKeysPage.list.refresh).toBe("Actualizeaza")
  })

  it("falls back to english outside a provider", () => {
    expect(renderToStaticMarkup(<MessageProbe />)).toContain("API tokens")
  })

  it("provides romanian messages through the provider", () => {
    const html = renderToStaticMarkup(
      <AuthUiMessagesProvider locale="ro-RO">
        <MessageProbe />
      </AuthUiMessagesProvider>,
    )

    expect(html).toContain("Tokenuri API")
  })
})

function MessageProbe() {
  const messages = useAuthUiMessagesOrDefault()
  return <span>{messages.serviceApiKeysPage.title}</span>
}
