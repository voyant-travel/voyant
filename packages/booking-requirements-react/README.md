# @voyantjs/booking-requirements-react

The booking-requirements client tier: headless data hooks/clients plus the
styled UI components (formerly `@voyantjs/booking-requirements-ui`).

Headless consumers import from the root, `./hooks`, `./client`, or
`./query-keys` — these pull no styling peers. Styled surfaces live under
`./ui`, `./components/*`, `./i18n`, and `./styles.css`, whose heavier peers
(`@voyantjs/ui`) are optional and only needed when you import those subpaths.

React runtime package for Voyant booking requirements. Provides the shared provider, typed fetch client, query keys, constants, and TanStack Query hooks that power booking-requirements-focused frontend experiences.

## Install

```bash
pnpm add @voyantjs/booking-requirements-react @voyantjs/booking-requirements @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import {
  VoyantBookingRequirementsProvider,
  useProducts,
} from "@voyantjs/booking-requirements-react"

function App() {
  return (
    <VoyantBookingRequirementsProvider baseUrl="/api">
      <ProductsList />
    </VoyantBookingRequirementsProvider>
  )
}

function ProductsList() {
  const { data } = useProducts({ limit: 50 })
  return <>{data?.data.map((product) => <div key={product.id}>{product.name}</div>)}</>
}
```

## UI components

Importable React UI components for Voyant booking-requirements. Bundler-consumed (Vite, Next.js, webpack, etc.).

```bash
pnpm add @voyantjs/booking-requirements-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives (optional peer; required only when importing the styled subpaths). The headless hooks ship in this same package.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

### I18n

Components render English by default. To localize them, wrap your UI in
`BookingRequirementsUiMessagesProvider` and import only the locales your app
supports.

```tsx
import { BookingRequirementsUiMessagesProvider } from "@voyantjs/booking-requirements-react/ui"
import { bookingRequirementsUiEn } from "@voyantjs/booking-requirements-react/i18n/en"
import { bookingRequirementsUiRo } from "@voyantjs/booking-requirements-react/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

### Not included (registry-only)

Some components couple to TanStack Router or template-local helpers and remain available only via the shadcn registry: `booking-question-dialog`, `contact-requirement-dialog`, `question-option-dialog`. Import via `npx shadcn add @voyant/<component>` and customize per-project.

## License

Apache-2.0
