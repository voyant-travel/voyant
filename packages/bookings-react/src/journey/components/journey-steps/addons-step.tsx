"use client"

import { Separator } from "@voyantjs/ui/components"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { useBookingsUiMessagesOrDefault } from "../../../i18n/index.js"
import { type Draft, setAddons } from "../../lib/draft-state.js"
import { bucketBy, type StepCommonProps } from "./shared.js"

// ─────────────────────────────────────────────────────────────────
// Add-ons
// ─────────────────────────────────────────────────────────────────

export function AddonsStep({ draft, setDraft, shape }: StepCommonProps): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const flat = shape.addons?.catalog ?? []
  const groups = shape.addons?.groups ?? []
  const all = [...flat, ...groups.flatMap((g) => g.items)]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.bookingJourney.addons.title}</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4">
        {all.length === 0 ? (
          <p className="text-muted-foreground text-sm">{messages.bookingJourney.addons.empty}</p>
        ) : null}
        {groups.map((group) => {
          // Group by port/day when the descriptor asks — cruise
          // excursions arrive grouped by port name.
          const buckets =
            group.groupBy === "port" || group.groupBy === "day"
              ? bucketBy(
                  group.items,
                  (i) => i.groupKey ?? messages.bookingJourney.addons.otherBucket,
                )
              : new Map([["", group.items as ReadonlyArray<(typeof group.items)[number]>]])
          return (
            <div key={group.label} className="space-y-3">
              <div className="font-medium text-sm">{group.label}</div>
              {[...buckets.entries()].map(([bucket, items]) => (
                <div key={bucket || "all"} className="space-y-2">
                  {bucket ? (
                    <div className="text-muted-foreground text-xs uppercase">{bucket}</div>
                  ) : null}
                  {items.map((item) => (
                    <AddonRow key={item.id} draft={draft} setDraft={setDraft} item={item} />
                  ))}
                </div>
              ))}
            </div>
          )
        })}
        {flat.length > 0 && groups.length === 0 ? (
          <div className="space-y-2">
            {flat.map((item) => (
              <AddonRow key={item.id} draft={draft} setDraft={setDraft} item={item} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AddonRow({
  draft,
  setDraft,
  item,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
  item: { id: string; name: string; description?: string | null }
}): React.ReactElement {
  const current = draft.addons.find((a) => a.extraId === item.id)
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <div className="font-medium">{item.name}</div>
        {item.description ? (
          <div className="text-muted-foreground text-xs">{item.description}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => {
            const list = draft.addons.filter((a) => a.extraId !== item.id)
            const qty = (current?.quantity ?? 0) - 1
            if (qty > 0) list.push({ extraId: item.id, quantity: qty })
            setDraft(setAddons(draft, list))
          }}
        >
          −
        </Button>
        <span className="min-w-6 text-center">{current?.quantity ?? 0}</span>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => {
            const list = draft.addons.filter((a) => a.extraId !== item.id)
            const qty = (current?.quantity ?? 0) + 1
            list.push({ extraId: item.id, quantity: qty })
            setDraft(setAddons(draft, list))
          }}
        >
          +
        </Button>
      </div>
    </div>
  )
}
