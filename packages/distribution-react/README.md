# @voyantjs/availability-react

React runtime package for Voyant availability. Provides the shared availability provider, typed fetch client, query keys, constants, and TanStack Query hooks that power availability-focused frontend experiences.

## Install

```bash
pnpm add @voyantjs/availability-react @voyantjs/availability @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { VoyantAvailabilityProvider, useSlots } from "@voyantjs/availability-react"

function App() {
  return (
    <VoyantAvailabilityProvider baseUrl="/api">
      <SlotsList />
    </VoyantAvailabilityProvider>
  )
}

function SlotsList() {
  const { data } = useSlots()
  return <>{data?.data.map((slot) => <div key={slot.id}>{slot.dateLocal}</div>)}</>
}
```

## License

Apache-2.0
