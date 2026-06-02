# @voyantjs/products-react

React runtime package for Voyant products. Provides the shared products provider, typed fetch client, query keys, and TanStack Query hooks that power product-focused frontend experiences, including product component authoring.

## Install

```bash
pnpm add @voyantjs/products-react @voyantjs/products @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { VoyantProductsProvider, useProducts } from "@voyantjs/products-react"

function App() {
  return (
    <VoyantProductsProvider baseUrl="/api">
      <ProductsList />
    </VoyantProductsProvider>
  )
}

function ProductsList() {
  const { data } = useProducts()
  return <>{data?.data.map((product) => <div key={product.id}>{product.name}</div>)}</>
}
```

Product component endpoints are available through `useProductComponents`,
`useProductComponent`, and `useProductComponentMutation`. The component
mutation hook also exposes typed JSON component import through
`importComponents`, including dry-run and append/replace modes.

## Relationship To The Registry

`@voyantjs/products-react` is the runtime layer. Installable product UI blocks should come from the Voyant shadcn registry and depend on this package for hooks, client state, and provider wiring.

## License

Apache-2.0
