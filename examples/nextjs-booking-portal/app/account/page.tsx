import { isMockMode } from "../../lib/voyant-client"

import { CustomerAccountPanel } from "./portal-client"

export const dynamic = "force-dynamic"

function resolveCustomerPortalBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_VOYANT_CUSTOMER_API_URL?.replace(/\/$/, "") ??
    process.env.VOYANT_API_URL?.replace(/\/$/, "") ??
    ""
  )
}

export default function AccountPage() {
  const mock = isMockMode()
  const baseUrl = resolveCustomerPortalBaseUrl()
  const portalEnabled = !mock && Boolean(baseUrl)

  return (
    <>
      <a href="/" className="back-link">
        ← Back to tours
      </a>

      <section className="hero hero-compact">
        <h1>Customer account</h1>
        <p>
          Reference onboarding and self-service account flow built on top of Voyant&apos;s customer
          portal contract. This page demonstrates contact preflight, customer bootstrap, profile
          reads, companion management, and customer booking access.
        </p>
      </section>

      {portalEnabled ? (
        <CustomerAccountPanel baseUrl={baseUrl} />
      ) : (
        <section className="notice-panel">
          <h2>Customer portal disabled</h2>
          <p>
            This example account flow requires a live Voyant backend. Set{" "}
            <code>USE_MOCK_DATA=0</code> and configure{" "}
            <code>NEXT_PUBLIC_VOYANT_CUSTOMER_API_URL</code> to the public Voyant origin that owns
            the customer session cookie.
          </p>
          <p>
            In local development, <code>http://localhost:3300/api</code> is usually enough if you
            are running the operator template directly and signing in on the same origin.
          </p>
        </section>
      )}
    </>
  )
}
