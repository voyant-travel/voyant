# @voyantjs/resources-ui

Importable React UI components for Voyant resources. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/resources-ui @voyantjs/resources-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/resources-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## Components

- `ResourcesPage` composes the resources overview and all primary/secondary tabs with package data hooks, shared filters, row selection state, and app-provided bulk mutation/navigation handlers.
- `ResourcesOverview`, `ResourcesTab`, `PoolsTab`, `AllocationsTab`, `AssignmentsTab`, and `CloseoutsTab` remain exported for apps that need a custom page shell.
- `ResourceDetailPage`, `ResourcePoolDetailPage`, `ResourceAllocationDetailPage`, and `ResourceAssignmentDetailPage` compose package-owned detail views for the four resources surfaces. They use `@voyantjs/resources-react` hooks for detail/list data where available and expose app callbacks for routing and delete mutations.
- `ensureResourceDetailPageData`, `ensureResourcePoolDetailPageData`, `ensureResourceAllocationDetailPageData`, and `ensureResourceAssignmentDetailPageData` are exported for route loaders that want to prefetch the same package data.
- `ResourceDetailField`, `ResourceDetailCard`, `ResourceDetailHeader`, the four detail skeletons, and `useResourcePoolMembers` are exported for apps that need custom detail shells while preserving the package sections/helpers.

## Detail pages

The detail pages deliberately keep router and mutation behavior app-owned:

```tsx
import {
  ResourceDetailPage,
  ensureResourceDetailPageData,
} from "@voyantjs/resources-ui"
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

## I18n

Components render English by default. To localize them, wrap your UI in
`ResourcesUiMessagesProvider` and import only the locales your app supports.

```tsx
import { ResourcesUiMessagesProvider } from "@voyantjs/resources-ui"
import { resourcesUiEn } from "@voyantjs/resources-ui/i18n/en"
import { resourcesUiRo } from "@voyantjs/resources-ui/i18n/ro"
```
