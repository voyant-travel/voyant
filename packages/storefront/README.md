# @voyantjs/storefront

Public storefront routes and service helpers for checkout-adjacent product, departure,
offer, and eligibility flows.

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
