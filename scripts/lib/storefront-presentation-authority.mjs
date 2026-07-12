export const STOREFRONT_ROUTE_HOSTS = {
  "route.tsx": "layout",
  "shop.tsx": "shop",
  "shop_.account.tsx": "account",
  "shop_.account.sign-in.tsx": "accountSignIn",
  "shop_.account.sign-up.tsx": "accountSignUp",
  "shop_.account.verify-email.tsx": "accountVerifyEmail",
  "shop_.book.$entityModule.$entityId.tsx": "booking",
  "shop_.composer.tsx": "composer",
  "shop_.confirmation.$bookingId.tsx": "confirmation",
  "shop_.products.$entityModule.$entityId.tsx": "productDetail",
}

export function checkStorefrontPresentationAuthority({
  routeHosts,
  hostAdapter,
  messageAdapter,
  intakeAdapter,
  packagePresentation,
  packageIntake,
  graphDeclaration,
}) {
  const failures = []
  let hostLines = 0

  for (const [file, routeKey] of Object.entries(STOREFRONT_ROUTE_HOSTS)) {
    const source = routeHosts[file]
    if (source === undefined) {
      failures.push(`${file} is required as a Storefront route host`)
      continue
    }
    hostLines += source.split("\n").length
    for (const token of [
      "createFileRoute",
      "storefrontPresentationContribution",
      `routes.${routeKey}`,
    ]) {
      if (!source.includes(token)) failures.push(`${file} must contain ${token}`)
    }
    for (const token of [
      "function ",
      "useNavigate",
      "useSearch",
      "z.object",
      "redirect(",
      "authClient",
    ]) {
      if (source.includes(token)) failures.push(`${file} must not own ${token.trim()}`)
    }
  }

  if (hostLines > 80)
    failures.push(`Storefront route hosts grew to ${hostLines} lines; ratchet is 80`)

  for (const token of [
    "createStorefrontPresentationContribution",
    "StorefrontBookingPage",
    "StorefrontComposerPage",
    "CruiseDetailPage",
    "ProductDetailPageProducts",
    "AccommodationDetailPage",
    "authClient.useSession()",
    "useLocale().resolvedLocale",
  ]) {
    if (!hostAdapter.includes(token)) failures.push(`Storefront host adapter must contain ${token}`)
  }
  for (const token of ["z.object", "redirect(", "createFileRoute", "CustomerAccountPage"]) {
    if (hostAdapter.includes(token)) failures.push(`Storefront host adapter must not own ${token}`)
  }

  for (const token of [
    'id: "@voyant-travel/storefront#presentation.customer"',
    "accountSignInSearchSchema",
    "confirmationSearchSchema",
    "getStorefrontCustomerProductDetailRoute",
    "CustomerAccountPage",
    "StorefrontMessagesProvider",
    "createStorefrontMessagesProvider",
  ]) {
    if (!packagePresentation.includes(token)) {
      failures.push(`package presentation contribution must contain ${token}`)
    }
  }
  if (packagePresentation.includes('from "@/')) {
    failures.push("package presentation contribution must not import Operator aliases")
  }

  if (!messageAdapter.includes("createStorefrontMessagesProvider")) {
    failures.push("Storefront message adapter must use the package-owned provider factory")
  }
  if (messageAdapter.includes("function OperatorStorefrontMessagesProvider")) {
    failures.push("Storefront message adapter must not implement the provider")
  }

  if (
    !intakeAdapter.includes('import("@voyant-travel/storefront/relationships-intake")') ||
    intakeAdapter.includes('import("./storefront-intake-runtime")')
  ) {
    failures.push("Storefront intake host must call package authority directly")
  }
  for (const token of [
    "createRelationshipsStorefrontIntakePersistence",
    "relationshipsService.createPerson",
    "customerSignals",
    "requireStorefrontDb",
  ]) {
    if (!packageIntake.includes(token))
      failures.push(`package intake adapter must contain ${token}`)
  }

  for (const token of [
    'id: "@voyant-travel/storefront#presentation.customer"',
    'entry: "@voyant-travel/storefront-react/storefront"',
    'export: "createStorefrontPresentationContribution"',
  ]) {
    if (!graphDeclaration.includes(token)) {
      failures.push(`Storefront selected graph declaration must contain ${token}`)
    }
  }

  return { failures, hostLines }
}
