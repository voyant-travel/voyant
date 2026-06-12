// Payday spike — write-path burst against the booking-session bootstrap.
//
// !!! THIS SCENARIO MUTATES DATA — STAGING TENANTS ONLY !!!
// It refuses to run unless ALLOW_WRITES=1 is set explicitly.
//
//   k6 run -e TARGET_URL=https://staging-tenant.example.com -e ALLOW_WRITES=1 \
//     scripts/load/payday-spike.js
//
// Shape: bursts of POST /v1/public/bookings/sessions/bootstrap with unique
// Idempotency-Key headers, ramping 5 -> 100 rps over 60s and back down, while
// a steady 20 rps of quote/availability reads runs alongside.
//
// SLO budgets asserted:
//   - http_req_failed rate < 2% (429s from per-plan dispatch limits are
//     EXPECTED statuses — tracked separately via the rate_limited metric,
//     not counted as failures)
//   - http_req_duration p(95) < 1500ms
//
// Seed data required on the target tenant: at least one published catalog
// product with an open (or capacity-unlimited) departure. Pass
// -e DEPARTURE_ID=... (and optionally -e SLOT_ID=...) to skip discovery.

import { check, fail } from "k6"
import http from "k6/http"
import { Rate } from "k6/metrics"

import { ALLOW_WRITES, DEPARTURE_ID, PRODUCT_IDS, SLOT_ID } from "./lib/config.js"
import {
  bootstrapSession,
  discoverDeparture,
  discoverProducts,
  listDepartures,
  priceDeparture,
} from "./lib/requests.js"

if (!ALLOW_WRITES) {
  throw new Error(
    "payday-spike MUTATES DATA (booking session bootstraps). " +
      "Run against a STAGING tenant only, with -e ALLOW_WRITES=1 to confirm.",
  )
}

// Treat 429 (per-plan dispatch limits) as an expected status so it does not
// count toward http_req_failed; it is tracked via rate_limited instead.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 429))

const rateLimited = new Rate("rate_limited")

export const options = {
  scenarios: {
    bootstrap_spike: {
      executor: "ramping-arrival-rate",
      exec: "bootstrap",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 300,
      stages: [
        { duration: "30s", target: 5 },
        { duration: "60s", target: 100 },
        { duration: "30s", target: 5 },
      ],
    },
    quote_reads: {
      executor: "constant-arrival-rate",
      exec: "quotes",
      rate: 20,
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 20,
      maxVUs: 60,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
  },
}

export function setup() {
  if (DEPARTURE_ID) {
    return {
      productId: PRODUCT_IDS[0] || null,
      departureId: DEPARTURE_ID,
      slotId: SLOT_ID || DEPARTURE_ID,
    }
  }
  const productIds = PRODUCT_IDS.length > 0 ? PRODUCT_IDS : discoverProducts().ids
  const target = discoverDeparture(productIds)
  if (!target) {
    fail(
      "No bookable departure found. Seed the staging tenant with a product that has open " +
        "departures, or pass -e DEPARTURE_ID=... (-e SLOT_ID=... if it differs)",
    )
  }
  return target
}

export function bootstrap(data) {
  const res = bootstrapSession(data, { endpoint: "bootstrap", kind: "write" })
  rateLimited.add(res.status === 429)
  check(res, {
    "bootstrap 2xx or 429": (r) => (r.status >= 200 && r.status < 300) || r.status === 429,
  })
}

export function quotes(data) {
  const useAvailabilityRead = data.productId !== null && Math.random() < 0.5
  const res = useAvailabilityRead
    ? listDepartures(data.productId, { endpoint: "departures", kind: "read" })
    : priceDeparture(data.departureId, { endpoint: "price_preview", kind: "quote" })
  rateLimited.add(res.status === 429)
  check(res, { "quote read ok": (r) => r.status === 200 || r.status === 429 })
}
