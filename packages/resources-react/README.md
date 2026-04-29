# @voyantjs/resources-react

React runtime package for Voyant resources. Provides the shared resources provider, typed fetch client, query keys, constants, and TanStack Query hooks that power resource-focused frontend experiences.

## Install

```bash
pnpm add @voyantjs/resources-react @voyantjs/resources @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { VoyantResourcesProvider, useResources } from "@voyantjs/resources-react"

function App() {
  return (
    <VoyantResourcesProvider baseUrl="/api">
      <ResourcesList />
    </VoyantResourcesProvider>
  )
}

function ResourcesList() {
  const { data } = useResources()
  return <>{data?.data.map((resource) => <div key={resource.id}>{resource.name}</div>)}</>
}
```

## Relationship To The Registry

`@voyantjs/resources-react` is the runtime layer. Installable resource UI blocks should depend on this package for hooks, client state, typed response validation, and shared resource-domain helpers.

## License

Apache-2.0
