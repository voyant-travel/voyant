import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LocaleProvider, OperatorAdminMessagesProvider } from "@voyant-travel/admin"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  AccountChangeEmailForm,
  AccountChangePasswordForm,
  AccountPage,
  AccountProfileForm,
} from "./components/account-page.js"
import { type CurrentUser, VoyantAuthProvider, type VoyantFetcher } from "./index.js"

const fixtureUser: CurrentUser = {
  id: "user_1",
  email: "ana@example.com",
  firstName: "Ana",
  lastName: "Popescu",
  locale: "ro",
  timezone: "Europe/Bucharest",
  isSuperAdmin: false,
  isSupportUser: false,
  createdAt: "2026-05-12T00:00:00.000Z",
  profilePictureUrl: null,
}

function renderWithProviders(element: ReactNode) {
  const fetcher: VoyantFetcher = async () => new Response(null, { status: 204 })

  return renderToStaticMarkup(
    <LocaleProvider localeStorageKey={null} timeZoneStorageKey={null}>
      <OperatorAdminMessagesProvider>
        <QueryClientProvider client={new QueryClient()}>
          <VoyantAuthProvider baseUrl="https://operator.example/api" fetcher={fetcher}>
            {element}
          </VoyantAuthProvider>
        </QueryClientProvider>
      </OperatorAdminMessagesProvider>
    </LocaleProvider>,
  )
}

describe("AccountPage", () => {
  it("renders the account self-service page and extension panels", () => {
    const markup = renderWithProviders(
      <AccountPage
        currentUser={fixtureUser}
        showSidebarTrigger={false}
        slots={{
          apiTokensPanel: <section>API tokens panel</section>,
        }}
      />,
    )

    expect(markup).toContain("Account")
    expect(markup).toContain("account-profile-first-name")
    expect(markup).toContain("account-new-email")
    expect(markup).toContain("account-current-password")
    expect(markup).toContain("API tokens panel")
  })

  it("renders standalone account forms", () => {
    const markup = renderWithProviders(
      <>
        <AccountProfileForm currentUser={fixtureUser} />
        <AccountChangeEmailForm currentEmail={fixtureUser.email} />
        <AccountChangePasswordForm />
      </>,
    )

    expect(markup).toContain("Save profile")
    expect(markup).toContain("Send code")
    expect(markup).toContain("Update password")
  })
})
