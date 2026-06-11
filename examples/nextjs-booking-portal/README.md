# nextjs-booking-portal

Reference Next.js 15 **booking portal** that consumes Voyant's `/v1/public/*`
API surface. Demonstrates the customer-facing side of a Voyant deployment:
browsing tours, reading detail pages, submitting a booking inquiry, and
bootstrapping a customer account against Voyant's customer portal contract,
inspecting customer-scoped booking detail, opening booking documents, and
handing off into public payment/voucher flows.

> In travel tech, the customer-facing website isn't a "storefront" — tour
> products are inquiry- and availability-driven, not cart-and-checkout SKUs.
> We use the terms **booking portal**, **booking site**, or **public site**
> throughout this example.

```
examples/nextjs-booking-portal/
├── app/
│   ├── page.tsx                     Home — product grid
│   ├── account/page.tsx             Customer account bootstrap/reference flow
│   ├── products/[id]/page.tsx       Product detail
│   ├── inquire/[id]/page.tsx        Inquiry form (Server Action)
│   ├── thanks/page.tsx              Confirmation
│   └── api/
│       ├── products/route.ts        GET /api/products (BFF)
│       ├── products/[id]/route.ts   GET /api/products/:id
│       └── inquiries/route.ts       POST /api/inquiries
├── lib/
│   ├── voyant-client.ts             Server-side public client + mock fallback
│   ├── mock-data.ts                 Demo product catalog
│   ├── types.ts                     Public product / inquiry types
│   └── format.ts                    Formatting helpers
└── .env.example
```

## Running the demo

From the monorepo root:

```bash
pnpm install
pnpm -F nextjs-booking-portal dev
```

Open <http://localhost:3100>. The booking portal runs in **mock mode** by
default (`USE_MOCK_DATA=1`), so you can click through the flow without a live
backend.

## Connecting to a real Voyant backend

1. Start the operator template:
   ```bash
   pnpm -C templates/operator dev
   ```
2. In `examples/nextjs-booking-portal/`, create `.env.local`:
   ```
   VOYANT_API_URL=http://localhost:3300/api
   VOYANT_API_KEY=sk_live_...
   NEXT_PUBLIC_VOYANT_CUSTOMER_API_URL=http://localhost:3300/api
   USE_MOCK_DATA=0
   ```
3. Restart `pnpm -F nextjs-booking-portal dev`.

The client in `lib/voyant-client.ts` uses the shared public fetch/error
contract from `@voyantjs/storefront-react`, but keeps example-local response
schemas for the simplified product and inquiry payloads. In a real deployment
you would either:

- Map Voyant's `selectProductSchema` to the public shape in a server-side
  projection function, or
- Point the client at a dedicated public projection endpoint that already
  returns the trimmed-down shape.

The `/account` reference page uses `@voyantjs/customer-portal-react` directly
from the browser. That means the configured
`NEXT_PUBLIC_VOYANT_CUSTOMER_API_URL` should point at the public Voyant origin
that owns the Better Auth session cookie for the signed-in traveler. In a
single-origin deployment, this is often the same value as `VOYANT_API_URL`.

## API surface used

| Endpoint                        | Actor     | Purpose                                   |
|---------------------------------|-----------|-------------------------------------------|
| `GET  /v1/public/products`      | customer  | List publicly-visible products            |
| `GET  /v1/public/products/:id`  | customer  | Fetch a single product by id              |
| `POST /v1/public/inquiries`     | customer  | Submit a booking inquiry (create draft)   |
| `GET  /v1/customer-portal/contact-exists` | public preflight | Check if an email already maps to auth/CRM |
| `POST /v1/public/customer-portal/bootstrap` | customer | Link or create a customer record |
| `GET  /v1/public/customer-portal/me` | customer | Read customer profile and linked CRM record |
| `GET  /v1/public/customer-portal/bookings` | customer | Read customer-scoped bookings |
| `GET  /v1/public/customer-portal/bookings/:id` | customer | Read booking detail |
| `GET  /v1/public/customer-portal/bookings/:id/documents` | customer | Read customer-visible booking documents |
| `GET  /v1/public/finance/bookings/:id/payment-options` | customer | Read public checkout targets |
| `POST /v1/public/finance/bookings/:id/payment-schedules/:scheduleId/payment-session` | customer | Start schedule payment session |
| `POST /v1/public/finance/bookings/:id/guarantees/:guaranteeId/payment-session` | customer | Start guarantee payment session |
| `POST /v1/public/finance/vouchers/validate` | customer | Validate voucher against public checkout context |

These endpoints are all served by the **`public` route surface** defined by
modules that opt-in with `publicRoutes` in `@voyantjs/hono`. The
`actor: "customer"` guard is applied automatically by the Voyant Hono adapter
— the booking portal only needs an API key or an anonymous session cookie.

## Alternatives demonstrated

| Approach                    | Where                                    |
|-----------------------------|------------------------------------------|
| Direct REST fetch           | `lib/voyant-client.ts` + page server components |
| Next.js Route Handlers (BFF)| `app/api/**`                             |
| Next.js Server Actions      | `app/inquire/[id]/page.tsx#createInquiry`|

You can also swap `lib/voyant-client.ts` for the `@voyantjs/next`
route adapter if you want to mount Voyant modules **inside** the Next.js app
itself (i.e. run Voyant in-process rather than calling out to a separate
Voyant deployment). See `packages/next/src/route.ts` for that pattern.

## Notes

- All pages use `dynamic = "force-dynamic"` to bypass full-route caching —
  booking availability changes frequently and is not safe to cache at the
  page level.
- The Server Action in `app/inquire/[id]/page.tsx` demonstrates how to
  tunnel a mutating customer action through a server component without
  exposing API keys to the browser.
- CSS is plain vanilla CSS in `app/globals.css` for legibility; use
  Tailwind or CSS Modules in your own app.
