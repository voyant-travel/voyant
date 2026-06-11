import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ForgotPasswordPage, ResetPasswordPage } from "./components/password-reset-pages.js"
import { VoyantAuthProvider, type VoyantFetcher } from "./index.js"

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

describe("password reset pages", () => {
  it("renders the reusable forgot-password surface", () => {
    const markup = renderWithProviders(
      <ForgotPasswordPage redirectTo="/reset-password" signInHref="/sign-in" />,
    )

    expect(markup).toContain("Forgot password")
    expect(markup).toContain("auth-forgot-password-email")
    expect(markup).toContain("Send reset link")
  })

  it("renders the reusable reset-password surface", () => {
    const fixtureResetToken = ["reset", "fixture"].join("-")
    const markup = renderWithProviders(
      <ResetPasswordPage
        token={fixtureResetToken}
        signInHref="/sign-in"
        forgotPasswordHref="/forgot-password"
      />,
    )

    expect(markup).toContain("Reset password")
    expect(markup).toContain("auth-reset-password-new")
    expect(markup).toContain("auth-reset-password-confirm")
  })

  it("renders a router-agnostic missing-token state", () => {
    const markup = renderWithProviders(<ResetPasswordPage forgotPasswordHref="/forgot-password" />)

    expect(markup).toContain("missing or invalid")
    expect(markup).toContain("/forgot-password")
  })
})
