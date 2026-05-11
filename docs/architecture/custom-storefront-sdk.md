# Custom Storefront SDK Architecture

Voyant custom storefronts should consume booking-engine behavior through a
framework-agnostic TypeScript SDK instead of stitching together package-specific
fetch helpers.

## Decision

`@voyantjs/storefront-sdk` is the supported integration surface for custom
storefront booking UIs.

The SDK wraps existing public contracts from:

- `@voyantjs/storefront` for public settings, departures, itinerary, offers,
  extensions, availability, and price preview
- `@voyantjs/bookings` for public booking sessions, wizard state, repricing,
  confirmation, expiration, and overview lookup
- `@voyantjs/checkout` for public checkout collection preview/initiation and
  collection bootstrap

The SDK does not own routes, persistence, or lifecycle side effects. It is a
typed client facade over the public route contracts those modules already own.

## Layering

Use this stack for custom booking UIs:

1. Public Hono route modules expose `/v1/public/*` capability contracts.
2. `@voyantjs/storefront-sdk` provides framework-agnostic TypeScript operations
   and booking-engine state helpers.
3. `@voyantjs/storefront-react` provides React Query hooks on top of the SDK.
4. Registry UI blocks and app/template storefronts provide presentation.

Custom UIs may skip layer 3 when they are not React applications.

## State Model

The SDK exports a customer-facing booking-engine state vocabulary:

- `draft`
- `reserved`
- `billing_completed`
- `travelers_completed`
- `terms_accepted`
- `ready_for_payment`
- `payment_started`
- `payment_pending`
- `confirmed`
- `completed`
- `expired`
- `cancelled`

These states are derived from existing public booking-session snapshots:

- `bookings.status`
- `booking_session_states.completedSteps`
- `booking_session_states.currentStep`
- public session checklist readiness

The state model is intentionally derived rather than persisted. The canonical
backend lifecycle remains the `bookings` status model plus public session state.

## Rules

1. Do not introduce a `/v1/public/storefront/*` namespace for SDK needs. Keep
   public routes capability-based.
2. Do not move booking, checkout, finance, legal, or notification side effects
   into the SDK. The SDK calls public contracts; modules own behavior.
3. Do not make React a dependency of the SDK. React hooks belong in
   `@voyantjs/storefront-react`.
4. Add new SDK methods only when they wrap a stable public contract or a stable
   derived client-side helper.
5. When a custom UI needs a new backend behavior, add the public route contract
   to the owning module first, then expose it through the SDK.

## Non-Goals

The SDK is not:

- a complete hosted storefront
- a UI component package
- a backend orchestration engine
- a replacement for module-owned public route contracts
