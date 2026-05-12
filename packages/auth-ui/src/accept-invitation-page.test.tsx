import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { VoyantAuthProvider, type VoyantFetcher } from "@voyantjs/auth-react"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AcceptInvitationPage } from "./components/accept-invitation-page.js"

function renderWithProviders(element: ReactNode) {
  const fetcher: VoyantFetcher = async () => new Response(null, { status: 204 })

  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <VoyantAuthProvider baseUrl="https://operator.example/api" fetcher={fetcher}>
        {element}
      </VoyantAuthProvider>
    </QueryClientProvider>,
  )
}

describe("AcceptInvitationPage", () => {
  it("renders the existing-user acceptance surface", () => {
    const markup = renderWithProviders(
      <AcceptInvitationPage token={["invitation", "123"].join("_")} />,
    )

    expect(markup).toContain("Accept invitation")
    expect(markup).toContain("Join the organization")
    expect(markup).toContain("Accept invitation")
    expect(markup).not.toContain("Invitation token")
  })

  it("renders token input and new-user handoff links", () => {
    const markup = renderWithProviders(
      <AcceptInvitationPage
        isAuthenticated={false}
        signInHref="/sign-in?next=/accept-invitation"
        signUpHref="/sign-up?next=/accept-invitation"
      />,
    )

    expect(markup).toContain("Sign in to accept this invitation")
    expect(markup).toContain("Invitation token")
    expect(markup).toContain("/sign-in?next=/accept-invitation")
    expect(markup).toContain("/sign-up?next=/accept-invitation")
  })
})
