import assert from "node:assert/strict"
import { test } from "node:test"
import {
  checkStorefrontPresentationAuthority,
  STOREFRONT_ROUTE_HOSTS,
} from "../lib/storefront-presentation-authority.mjs"

const routeHosts = Object.fromEntries(
  Object.entries(STOREFRONT_ROUTE_HOSTS).map(([file, routeKey]) => [
    file,
    `import { createFileRoute } from "@tanstack/react-router"\nimport { storefrontPresentationContribution } from "adapter"\nexport const Route = createFileRoute("/fixture")(storefrontPresentationContribution.routes.${routeKey})\n`,
  ]),
)
const hostAdapter = [
  "createStorefrontPresentationContribution",
  "StorefrontBookingPage",
  "StorefrontComposerPage",
  "CruiseDetailPage",
  "ProductDetailPageProducts",
  "AccommodationDetailPage",
  "authClient.useSession()",
  "useLocale().resolvedLocale",
].join("\n")
const packagePresentation = [
  'id: "@voyant-travel/storefront#presentation.customer"',
  "accountSignInSearchSchema",
  "confirmationSearchSchema",
  "getStorefrontCustomerProductDetailRoute",
  "CustomerAccountPage",
  "StorefrontMessagesProvider",
  "createStorefrontMessagesProvider",
].join("\n")
const packageIntake = [
  "createRelationshipsStorefrontIntakePersistence",
  "relationshipsService.createPerson",
  "customerSignals",
  "requireStorefrontDb",
].join("\n")
const graphDeclaration = [
  'id: "@voyant-travel/storefront#presentation.customer"',
  'entry: "@voyant-travel/storefront-react/storefront"',
  'export: "createStorefrontPresentationContribution"',
].join("\n")

function fixture(overrides = {}) {
  return {
    routeHosts,
    hostAdapter,
    messageAdapter: "createStorefrontMessagesProvider",
    intakeAdapter: 'import("@voyant-travel/storefront/relationships-intake")',
    packagePresentation,
    packageIntake,
    graphDeclaration,
    ...overrides,
  }
}

test("accepts selected package presentation with declarative route hosts", () => {
  assert.deepEqual(checkStorefrontPresentationAuthority(fixture()).failures, [])
})

test("rejects route policy and intake authority returning to the starter", () => {
  const result = checkStorefrontPresentationAuthority(
    fixture({
      routeHosts: {
        ...routeHosts,
        "shop.tsx": `${routeHosts["shop.tsx"]}\nfunction ShopPage() { useNavigate() }`,
      },
      intakeAdapter: "function createRelationshipsStorefrontIntakePersistence() {}",
    }),
  )
  assert(result.failures.some((failure) => failure.includes("shop.tsx must not own function")))
  assert(result.failures.includes("Storefront intake host must call package authority directly"))
})
