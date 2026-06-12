// Mixed workload — 80/15/5 read/quote/write against the public surface.
//
// Reads (80%): catalog list, product detail, departures.
// Quotes (15%): POST /v1/public/departures/:id/price (read-only despite POST).
// Writes (5%): POST /v1/public/bookings/sessions/bootstrap — ONLY when
// ALLOW_WRITES=1; without it the write share is folded into quotes and the
// run stays read-only (safe default).
//
//   k6 run -e TARGET_URL=https://staging-tenant.example.com scripts/load/mixed.js
//   k6 run -e TARGET_URL=... -e ALLOW_WRITES=1 scripts/load/mixed.js   # staging only
//
// Tunables: -e RATE=50 (rps), -e DURATION=5m
//
// SLO budgets asserted:
//   - http_req_failed rate < 2% (429s expected, tracked via rate_limited)
//   - reads  (kind:read)  p(95) < 300ms
//   - quotes (kind:quote) p(95) < 800ms
//   - writes (kind:write) p(95) < 1500ms

import { check, fail } from "k6"
import http from "k6/http"
import { Rate } from "k6/metrics"

import {
  ALLOW_WRITES,
  DEPARTURE_ID,
  PRODUCT_IDS,
  PRODUCT_SLUGS,
  pick,
  SLOT_ID,
} from "./lib/config.js"
import {
  bootstrapSession,
  discoverDeparture,
  discoverProducts,
  getProduct,
  getProductBySlug,
  listDepartures,
  listProducts,
  priceDeparture,
} from "./lib/requests.js"

// 429s from per-plan dispatch limits are expected, not failures.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 429))

const rateLimited = new Rate("rate_limited")

const RATE = __ENV.RATE ? Number.parseInt(String(__ENV.RATE), 10) : 50
const DURATION = __ENV.DURATION || "5m"

export const options = {
  scenarios: {
    mixed: {
      executor: "constant-arrival-rate",
      rate: RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: Math.max(20, RATE),
      maxVUs: RATE * 6,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{kind:read}": ["p(95)<300"],
    "http_req_duration{kind:quote}": ["p(95)<800"],
    "http_req_duration{kind:write}": ["p(95)<1500"],
  },
}

export function setup() {
  let ids = PRODUCT_IDS
  let slugs = PRODUCT_SLUGS
  if (ids.length === 0) {
    const discovered = discoverProducts()
    ids = discovered.ids
    if (slugs.length === 0) slugs = discovered.slugs
  }
  if (ids.length === 0) {
    fail(
      "No product ids available. Seed the staging tenant with published catalog products, " +
        "or pass -e PRODUCT_IDS=prod_a,prod_b",
    )
  }

  let target = null
  if (DEPARTURE_ID) {
    target = {
      productId: ids[0] || null,
      departureId: DEPARTURE_ID,
      slotId: SLOT_ID || DEPARTURE_ID,
    }
  } else {
    target = discoverDeparture(ids)
  }
  if (!target) {
    fail(
      "No bookable departure found for the quote/write slices. Seed an open departure " +
        "or pass -e DEPARTURE_ID=...",
    )
  }
  return { ids, slugs, target }
}

function doRead(data) {
  const roll = Math.random()
  let res
  if (roll < 0.4) {
    res = listProducts({ endpoint: "products_list", kind: "read" })
  } else if (roll < 0.8) {
    res =
      data.slugs.length > 0 && Math.random() < 0.3
        ? getProductBySlug(pick(data.slugs), { endpoint: "product_detail", kind: "read" })
        : getProduct(pick(data.ids), { endpoint: "product_detail", kind: "read" })
  } else {
    res = listDepartures(pick(data.ids), { endpoint: "departures", kind: "read" })
  }
  rateLimited.add(res.status === 429)
  check(res, { "read ok": (r) => r.status === 200 || r.status === 429 })
}

function doQuote(data) {
  const res = priceDeparture(data.target.departureId, { endpoint: "price_preview", kind: "quote" })
  rateLimited.add(res.status === 429)
  check(res, { "quote ok": (r) => r.status === 200 || r.status === 429 })
}

function doWrite(data) {
  const res = bootstrapSession(data.target, { endpoint: "bootstrap", kind: "write" })
  rateLimited.add(res.status === 429)
  check(res, {
    "write 2xx or 429": (r) => (r.status >= 200 && r.status < 300) || r.status === 429,
  })
}

export default function (data) {
  const roll = Math.random()
  if (roll < 0.8) {
    doRead(data)
  } else if (roll < 0.95 || !ALLOW_WRITES) {
    // Without ALLOW_WRITES=1 the 5% write share folds into quotes.
    doQuote(data)
  } else {
    doWrite(data)
  }
}
