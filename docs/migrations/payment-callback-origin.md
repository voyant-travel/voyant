# Separate the payment callback origin

Payment processors send server-to-server notifications to the Operator, while
customers open payment links on a storefront or website. Those URLs now have
separate configuration:

- `PAYMENT_CALLBACK_BASE_URL` is the public **Operator origin** that receives
  processor callbacks.
- `PUBLIC_CHECKOUT_BASE_URL` remains the customer-facing payment-link base URL.

Set `PAYMENT_CALLBACK_BASE_URL` to an HTTP(S) origin only:

```dotenv
PAYMENT_CALLBACK_BASE_URL="https://operator.example.com"
PUBLIC_CHECKOUT_BASE_URL="https://www.example.com/pay"
```

The runtime derives the callback URL as:

```text
https://operator.example.com/api/v1/public/payment-link/callback
```

Paths (including `/api`), credentials, query strings, and fragments are
rejected. Local development may use an `http://localhost:<port>` origin.

## Compatibility and rollout

For deployments upgrading before their platform injects the new setting, the
runtime temporarily falls back to `DASH_BASE_URL`, then to the origin obtained
from `APP_URL` after removing its conventional trailing `/api`. Both describe
the Operator itself. `PUBLIC_CHECKOUT_BASE_URL` is intentionally not a fallback
because it may describe a different host or include a customer route such as
`/pay`.

1. Add `PAYMENT_CALLBACK_BASE_URL` before or with the package upgrade.
2. Start a sandbox payment and verify the processor receives the derived
   `/api/v1/public/payment-link/callback` URL.
3. Verify a signed callback advances the payment session exactly once.
4. Keep the previous callback endpoint reachable until payment sessions created
   before the rollout have settled or expired.
5. Remove any deployment-specific workaround that derived callbacks from
   `PUBLIC_CHECKOUT_BASE_URL`.

Voyant Cloud must inject the managed Operator's public origin into
`PAYMENT_CALLBACK_BASE_URL`. Self-hosted deployments set it explicitly in their
runtime environment.
