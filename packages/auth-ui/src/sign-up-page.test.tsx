import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { VoyantAuthProvider, type VoyantFetcher } from "@voyantjs/auth-react"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SignUpPage } from "./components/sign-up-page.js"

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

describe("SignUpPage", () => {
  it("renders the reusable email/password sign-up surface", () => {
    const markup = renderWithProviders(
      <SignUpPage signInHref="/sign-in" showInvitationTokenInput />,
    )

    expect(markup).toContain("Create account")
    expect(markup).toContain("auth-sign-up-name")
    expect(markup).toContain("auth-sign-up-email")
    expect(markup).toContain("auth-sign-up-password")
    expect(markup).toContain("auth-sign-up-invitation-token")
    expect(markup).toContain("/sign-in")
  })

  it("renders social sign-up providers without owning routing", () => {
    const markup = renderWithProviders(
      <SignUpPage
        socialProviders={[
          {
            id: "google",
            label: "Continue with Google",
            onSignUp: () => undefined,
          },
        ]}
      />,
    )

    expect(markup).toContain("Continue with Google")
    expect(markup).toContain("Or")
  })

  it("accepts an app-owned email submit handler for invitation-backed sign-up", () => {
    const markup = renderWithProviders(
      <SignUpPage invitationToken="invite_123" onEmailSignUp={() => ({ accepted: true })} />,
    )

    expect(markup).toContain("Create account")
  })
})
