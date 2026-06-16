import type { CardPaymentStarter } from "@voyant-travel/finance/card-payment"
import { netopiaCardPaymentStarter } from "@voyant-travel/plugin-netopia"

/**
 * The card-payment processor for this deployment. Every checkout surface
 * (flights, trips checkout, payment links, catalog) routes card payments
 * through this single starter. To use a different processor, replace the
 * right-hand side with that provider's CardPaymentStarter — nothing else changes.
 */
export const cardPaymentStarter: CardPaymentStarter = netopiaCardPaymentStarter()
