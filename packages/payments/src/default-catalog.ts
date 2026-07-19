/**
 * First-party payment provider catalog.
 *
 * The static set of Voyant-built processors an operator can browse in
 * Settings → Payments before the managed control plane serves a live registry.
 * Phase 1 ships Netopia (`available`) and Voyant Payments (`coming_soon`).
 *
 * These descriptors are catalog *data* (served to the admin UI as JSON), not
 * in-code UI copy. Field labels are English defaults; the page chrome
 * (headings, actions, statuses) is localized through the i18n catalog.
 */

import type { PaymentAdapterCapabilities } from "./index.js"
import type { PaymentProviderDescriptor } from "./provider-catalog.js"

const redirectProcessorCapabilities: PaymentAdapterCapabilities = {
  hostedCheckout: true,
  redirectCheckout: true,
  authorize: false,
  capture: false,
  void: false,
  refund: true,
  status: true,
  callbackSignatureVerification: true,
  idempotencyKeys: true,
  retrySafeInitiation: true,
}

/** Netopia — the Romanian card processor. Its adapter already ships in-repo. */
const netopia: PaymentProviderDescriptor = {
  id: "netopia",
  displayName: "Netopia Payments",
  description: "Card payments and hosted checkout for the Romanian market.",
  logoRef: "netopia",
  capabilities: redirectProcessorCapabilities,
  availability: "available",
  modes: ["sandbox", "live"],
  regions: ["RO"],
  currencies: ["RON", "EUR", "USD"],
  credentialFieldSchema: [
    {
      key: "merchantId",
      label: "Merchant ID",
      kind: "text",
      required: true,
      placeholder: "e.g. 2X4B-1AAA-...",
      helpText: "Your Netopia merchant / seller identifier.",
      maxLength: 128,
    },
    {
      key: "apiKey",
      label: "API key",
      kind: "secret",
      required: true,
      helpText: "Netopia API key used to initiate payments.",
      maxLength: 512,
    },
    {
      key: "posSignature",
      label: "POS signature",
      kind: "secret",
      required: true,
      helpText: "The POS signature identifying your Netopia point of sale.",
      maxLength: 128,
    },
    {
      key: "ipnPublicKey",
      label: "IPN public key",
      kind: "secret",
      required: true,
      helpText: "Public key used to verify signed Netopia callbacks (IPN).",
      maxLength: 8_192,
    },
  ],
}

/** Voyant Payments — the first-party processor, announced but not yet live. */
const voyantPayments: PaymentProviderDescriptor = {
  id: "voyant-payments",
  displayName: "Voyant Payments",
  description: "The Voyant-native payment processor. Coming soon.",
  logoRef: "voyant-payments",
  capabilities: redirectProcessorCapabilities,
  availability: "coming_soon",
  modes: ["sandbox", "live"],
  credentialFieldSchema: [
    {
      key: "apiKey",
      label: "API key",
      kind: "secret",
      required: true,
      helpText: "Voyant Payments API key.",
      maxLength: 512,
    },
  ],
}

export const defaultPaymentProviderCatalog: readonly PaymentProviderDescriptor[] = [
  netopia,
  voyantPayments,
]

/** Look up a catalog entry by id. */
export function findPaymentProviderDescriptor(
  id: string,
  catalog: readonly PaymentProviderDescriptor[] = defaultPaymentProviderCatalog,
): PaymentProviderDescriptor | undefined {
  return catalog.find((provider) => provider.id === id)
}
