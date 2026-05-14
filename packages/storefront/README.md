# @voyantjs/storefront

Public storefront routes and service helpers for checkout-adjacent product, departure,
offer, and eligibility flows.

## Booking Session Bootstrap

Storefronts can bootstrap checkout with a single customer-safe public call:

- `POST /bookings/sessions/bootstrap`

When mounted through `createStorefrontHonoModule`, the route is available at
`/v1/public/bookings/sessions/bootstrap`.

The request creates a native public booking session from the supplied session
draft, validates the departure/slot and quote expiry, optionally reprices the
room/unit selection, and returns:

- the booking session plus checkout capability
- the original quote and current repricing delta
- the availability snapshot used for the reservation
- the payment plan schedules and due dates
- the response currency

Host apps can provide the payment-policy resolver used for computed schedules:

```ts
import { createStorefrontHonoModule } from "@voyantjs/storefront"

createStorefrontHonoModule({
  bookingBootstrap: {
    async resolvePaymentPolicy({ session }) {
      return {
        source: "operator_default",
        policy: await resolvePublicPaymentPolicyForSession(session),
      }
    },
  },
})
```

If finance has already persisted booking payment schedules, those schedules are
returned. Otherwise the route computes a customer-facing schedule from the
resolved policy, falling back to the finance no-deposit policy.

## Public Intake

Storefront can accept public CRM intake at the public root:

- `POST /leads`
- `POST /newsletter/subscribe`

When mounted through `createStorefrontHonoModule`, these become
`/v1/public/leads` and `/v1/public/newsletter/subscribe`.

Both routes create a CRM person and a CRM customer signal. Lead intake accepts
the CRM signal `kind`, `source`, product/option references, bounded payload
metadata, and consent metadata. Newsletter intake records a `notify` signal and
uses `sourceSubmissionId` for idempotency; when omitted, the email address is
used to derive a stable newsletter submission key.

```ts
import { createStorefrontHonoModule } from "@voyantjs/storefront"

createStorefrontHonoModule({
  intake: {
    guard({ body, context }) {
      // Install host-owned rate-limit, captcha, signature, or abuse checks.
      if (!isCaptchaValid(body, context)) {
        return { allowed: false, status: 429, error: "Captcha required" }
      }
    },
    async requestNewsletterDoubleOptIn({ email, signalId }) {
      await sendDoubleOptInEmail(email, { signalId })
    },
  },
})
```

Accepted intake emits `customer.signal.created` on the app event bus with
`metadata.category: "domain"` and an `intake` payload describing whether the
signal came from `lead` or `newsletter` intake. Notification adapters can
subscribe to that event to send CRM email, Slack, or other operator alerts.

## Transport Eligibility

Storefronts can check whether traveler document facts satisfy departure-level
transport rules before checkout confirmation.

```ts
import { createStorefrontPublicRoutes } from "@voyantjs/storefront"

createStorefrontPublicRoutes({
  transportEligibilityRules: [
    {
      id: "egypt-passport-validity",
      label: "Egypt passport validity",
      productId: "prod_123",
      destinationCountries: ["EG"],
      nationalityCountries: ["RO"],
      requiredDocumentType: "passport",
      minValidityDaysAfterReturn: 180,
      visaRequired: true,
    },
  ],
})
```

Schemas and the standalone evaluator are exported from
`@voyantjs/storefront/transport-eligibility`.

The public API is available at:

- `POST /departures/:departureId/eligibility`
- `POST /products/:productId/departures/:departureId/eligibility`

Request bodies contain only eligibility facts:

```json
{
  "travelStartsOn": "2026-08-01",
  "travelEndsOn": "2026-08-08",
  "travelers": [
    {
      "travelerRef": "traveler_1",
      "nationalityCountry": "RO",
      "dateOfBirth": "1990-01-01",
      "documents": [
        {
          "type": "passport",
          "issuingCountry": "RO",
          "expiresOn": "2027-03-01"
        }
      ],
      "hasVisa": true
    }
  ]
}
```

Responses return a top-level `eligible` flag plus traveler-specific blocking
issues and warnings. Supported rule dimensions are product, departure,
destination country, nationality country, required document type, minimum
validity after return, age range, visa requirement, minor consent requirement,
and warning/blocking severity.

Do not send or store raw passport numbers through this surface. The route and
schemas only model document type, issuing country, expiry date, nationality,
birth date, and boolean evidence such as `hasVisa`.

This first slice is API-only. Admin CRUD and operator UI for managing transport
rules should persist normalized rule objects and can call the same public
eligibility service once added.
