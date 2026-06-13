# @voyantjs/relationships-react

React hooks, query keys, providers, admin routes, and reusable UI for the
Relationships module: people, organizations, activities, profile context,
person documents, relationships, and customer signals.

Quote panels are exposed as extension slots on person and organization detail
pages. Quote lifecycle hooks and components live in `@voyantjs/quotes-react`.

## Install

```bash
pnpm add @voyantjs/relationships-react @voyantjs/relationships @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { VoyantProvider, usePeople } from "@voyantjs/relationships-react"

function PeopleList() {
  const { data } = usePeople()
  return <>{data?.data.map((person) => <div key={person.id}>{person.firstName}</div>)}</>
}
```

## UI

```tsx
import { PersonCard, PersonDialog, PersonList } from "@voyantjs/relationships-react/ui"
import { VoyantProvider } from "@voyantjs/relationships-react"
```

Components that render styled UI require the optional `@voyantjs/ui` peer.
Admin route contributions are exported from `@voyantjs/relationships-react/admin`.

## License

Apache-2.0
