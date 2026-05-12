import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { VoyantAuthProvider, type VoyantFetcher } from "@voyantjs/auth-react"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SignInPage } from "./components/sign-in-page.js"
import { VerifyEmailPage } from "./components/verify-email-page.js"

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

describe("SignInPage", () => {
  it("renders the reusable email/password sign-in surface", () => {
    const markup = renderWithProviders(
      <SignInPage forgotPasswordHref="/forgot-password" signUpHref="/sign-up" />,
    )

    expect(markup).toContain("Sign in")
    expect(markup).toContain("auth-sign-in-email")
    expect(markup).toContain("auth-sign-in-password")
    expect(markup).toContain("/forgot-password")
    expect(markup).toContain("/sign-up")
  })
})

describe("VerifyEmailPage", () => {
  it("renders the reusable email verification surface", () => {
    const markup = renderWithProviders(
      <VerifyEmailPage
        email="ana@example.com"
        signInHref="/sign-in"
        onResendVerification={async () => undefined}
      />,
    )

    expect(markup).toContain("Verify your email")
    expect(markup).toContain("ana@example.com")
    expect(markup).toContain("auth-verify-email-code")
    expect(markup).toContain("Resend code")
  })

  it("renders token verification when a token is supplied", () => {
    const emailLinkFixture = "email-link-fixture"
    const markup = renderWithProviders(<VerifyEmailPage token={emailLinkFixture} />)

    expect(markup).toContain("Verification token")
    expect(markup).toContain(emailLinkFixture)
    expect(markup).toContain("auth-verify-email-token")
  })
})
