# @voyantjs/resources-react

The resources client tier: headless data hooks/clients plus the styled UI
components and page-level compositions (formerly `@voyantjs/resources-ui`).

Headless consumers import from the root, `./hooks`, or `./client` — these pull
no styling peers. Styled surfaces live under `./ui`, `./components/*`,
`./admin`, `./i18n`, and `./styles.css`, whose heavier peers (`@voyantjs/ui`,
`@voyantjs/admin`, `@tanstack/react-table`, `sonner`) are optional and only
needed when you import those subpaths.

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

## UI components

Importable React UI components for Voyant resources. Bundler-consumed (Vite, Next.js, webpack, etc.).

`@voyantjs/ui` provides the design-system primitives; the data-layer hooks come
from this package's headless tier. Add the optional styled-tier peers
(`@voyantjs/ui`, `@voyantjs/admin`, `@tanstack/react-table`, `sonner`,
`react-hook-form`) when you import the styled subpaths.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

### Components

- `ResourcesPage` composes the resources overview and all primary/secondary tabs with package data hooks, shared filters, row selection state, and app-provided bulk mutation/navigation handlers.
- `ResourcesOverview`, `ResourcesTab`, `PoolsTab`, `AllocationsTab`, `AssignmentsTab`, and `CloseoutsTab` remain exported for apps that need a custom page shell.
- `ResourceDetailPage`, `ResourcePoolDetailPage`, `ResourceAllocationDetailPage`, and `ResourceAssignmentDetailPage` compose package-owned detail views for the four resources surfaces. They use the headless hooks for detail/list data where available and expose app callbacks for routing and delete mutations.
- `ensureResourceDetailPageData`, `ensureResourcePoolDetailPageData`, `ensureResourceAllocationDetailPageData`, and `ensureResourceAssignmentDetailPageData` are exported for route loaders that want to prefetch the same package data.
- `ResourceDetailField`, `ResourceDetailCard`, `ResourceDetailHeader`, the four detail skeletons, and `useResourcePoolMembers` are exported for apps that need custom detail shells while preserving the package sections/helpers.

### Detail pages

The detail pages deliberately keep router and mutation behavior app-owned:

```tsx
import {
  ResourceDetailPage,
  ensureResourceDetailPageData,
} from "@voyantjs/resources-react/ui"
import { defaultFetcher, resourcesQueryKeys } from "@voyantjs/resources-react"

const resourcesClient = { baseUrl: "/api", fetcher: defaultFetcher }

export const loader = ({ queryClient, id }) =>
  ensureResourceDetailPageData(queryClient, resourcesClient, id)

export function RouteComponent({ id, navigate, queryClient, api }) {
  return (
    <ResourceDetailPage
      id={id}
      onBack={() => navigate("/resources")}
      onOpenSupplier={(supplierId) => navigate(`/suppliers/${supplierId}`)}
      onOpenAssignment={(assignmentId) => navigate(`/resources/assignments/${assignmentId}`)}
      onDelete={async (resource) => {
        await api.delete(`/v1/resources/resources/${resource.id}`)
        await queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.resources() })
        navigate("/resources")
      }}
    />
  )
}
```

### I18n

Components render English by default. To localize them, wrap your UI in
`ResourcesUiMessagesProvider` and import only the locales your app supports.

```tsx
import { ResourcesUiMessagesProvider } from "@voyantjs/resources-react/ui"
import { resourcesUiEn } from "@voyantjs/resources-react/i18n/en"
import { resourcesUiRo } from "@voyantjs/resources-react/i18n/ro"
```

## License

Apache-2.0
