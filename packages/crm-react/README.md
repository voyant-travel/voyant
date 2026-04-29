# @voyantjs/crm-react

React runtime package for Voyant CRM. Provides the shared `VoyantProvider`, typed fetch client, query keys, and TanStack Query hooks that power CRM-focused frontend experiences.

## Install

```bash
pnpm add @voyantjs/crm-react @voyantjs/crm @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { VoyantProvider, usePeople } from "@voyantjs/crm-react"

function App() {
  return (
    <VoyantProvider baseUrl="/api">
      <PeopleList />
    </VoyantProvider>
  )
}

function PeopleList() {
  const { data } = usePeople()
  return <>{data?.items.map((person) => <div key={person.id}>{person.firstName}</div>)}</>
}
```

## Relationship To The Registry

`@voyantjs/crm-react` is the runtime layer. Installable CRM UI blocks should come from the Voyant shadcn registry and depend on this package for hooks, client state, and provider wiring.

## License

Apache-2.0
