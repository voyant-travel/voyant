import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@voyant-travel/ui/components/empty"
import { Inbox } from "lucide-react"

export function EmptyDetail(): React.ReactElement {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <Inbox className="text-muted-foreground size-8" />
        <EmptyTitle>No run selected</EmptyTitle>
        <EmptyDescription>
          Pick a run from the list on the left, or trigger a new one.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <code className="text-muted-foreground text-xs">
          voyant workflows run &lt;id&gt; --file &lt;path&gt;
        </code>
      </EmptyContent>
    </Empty>
  )
}
