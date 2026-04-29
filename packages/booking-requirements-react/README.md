# @voyantjs/booking-requirements-react

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

## License

Apache-2.0
