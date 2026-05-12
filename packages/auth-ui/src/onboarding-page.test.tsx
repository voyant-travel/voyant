import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { VoyantAuthProvider, type VoyantFetcher } from "@voyantjs/auth-react"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { OnboardingPage } from "./components/onboarding-page.js"

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

describe("OnboardingPage", () => {
  it("renders the reusable profile completion surface", () => {
    const markup = renderWithProviders(
      <OnboardingPage
        initialProfile={{
          firstName: "Ana",
          lastName: "Pop",
          locale: "ro",
          timezone: "Europe/Bucharest",
        }}
      />,
    )

    expect(markup).toContain("Complete your profile")
    expect(markup).toContain("auth-onboarding-first-name")
    expect(markup).toContain("auth-onboarding-last-name")
    expect(markup).toContain("auth-onboarding-locale")
    expect(markup).toContain("auth-onboarding-timezone")
    expect(markup).toContain("Europe/Bucharest")
  })

  it("supports message overrides, optional fields, and app slots", () => {
    const markup = renderWithProviders(
      <OnboardingPage
        showLocale={false}
        showTimezone={false}
        messages={{ title: "Set up your account", submit: "Finish" }}
        slots={{ beforeFields: <div data-testid="workspace-slot">Workspace setup</div> }}
      />,
    )

    expect(markup).toContain("Set up your account")
    expect(markup).toContain("Finish")
    expect(markup).toContain("Workspace setup")
    expect(markup).not.toContain("auth-onboarding-locale")
    expect(markup).not.toContain("auth-onboarding-timezone")
  })
})
