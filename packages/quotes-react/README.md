# @voyantjs/quotes-react

React hooks, query keys, providers, and reusable UI for the Quotes module:
pipelines, stages, quotes, quote versions, proposal lifecycle decisions, and
quote version lines.

People and organizations are represented by ids on quote records. Use
`@voyantjs/relationships-react` for person and organization UI.

## Install

```bash
pnpm add @voyantjs/quotes-react @voyantjs/quotes @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { QuotesBoard, VoyantProvider, useQuotes, useStages } from "@voyantjs/quotes-react"

function QuotePipeline({ pipelineId }: { pipelineId: string }) {
  const { data: stages } = useStages({ pipelineId })
  const { data: quotes } = useQuotes({ pipelineId })
  const quotesByStage = new Map(
    (stages?.data ?? []).map((stage) => [
      stage.id,
      (quotes?.data ?? []).filter((quote) => quote.stageId === stage.id),
    ]),
  )

  return <QuotesBoard stages={stages?.data ?? []} quotesByStage={quotesByStage} />
}
```

Styled components require the optional `@voyantjs/ui` peer.

## License

Apache-2.0
