import { catalogSourcesRuntimeExtensionPort } from "@voyant-travel/catalog/runtime-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { insuranceProviderSourcePort } from "@voyant-travel/insurance/ports"
import { storefrontDynamicPackageSourceProviderPort } from "@voyant-travel/storefront/shopping/provider-ports"

import { createVoyantConnectCatalogSourcesExtension } from "./catalog-sources-extension.js"
import { createVoyantConnectInsuranceProviderSource } from "./insurance-source.js"
import { createVoyantConnectStorefrontPackageSourceProvider } from "./storefront-package-sources.js"

export interface VoyantConnectRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Bind Voyant Connect as the deployment's catalog inventory channel. */
export function createVoyantConnectRuntimePortContribution(
  host: VoyantConnectRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [catalogSourcesRuntimeExtensionPort.id]: createVoyantConnectCatalogSourcesExtension(),
    [storefrontDynamicPackageSourceProviderPort.id]:
      createVoyantConnectStorefrontPackageSourceProvider(host.primitives),
    // An operator that has not pointed Connect at an insurance product still
    // gets a bound source; it quotes nothing. Zero quotes is a supported,
    // silent state, and it keeps the binding out of the deployment's business.
    [insuranceProviderSourcePort.id]: createVoyantConnectInsuranceProviderSource(host.primitives),
  }
}
