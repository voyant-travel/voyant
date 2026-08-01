"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@voyant-travel/ui/components/dialog"

import { useProductsUiI18nOrDefault } from "../i18n/index.js"
import { PRODUCT_QUICK_STARTS, type ProductQuickStart } from "./product-quick-starts.js"

export interface ProductQuickStartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Invoked with the chosen quick start, or `null` for a blank product. */
  onChoose: (quickStart: ProductQuickStart | null) => void | Promise<void>
  /** True while the create request is in flight (disables the choices). */
  creating?: boolean
}

/**
 * Accessible family / quick-start chooser shown when authoring a new product.
 * Every choice creates the SAME generic product draft — a quick start only
 * prefills editable field defaults (family, subtype, booking mode, duration).
 * There is no type-specific product aggregate.
 */
export function ProductQuickStartDialog({
  open,
  onOpenChange,
  onChoose,
  creating = false,
}: ProductQuickStartDialogProps) {
  const { messages } = useProductsUiI18nOrDefault()
  const qs = messages.productList.quickStart
  const presetCopy = qs.presets

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-slot="product-quick-start">
        <DialogHeader>
          <DialogTitle>{qs.title}</DialogTitle>
          <DialogDescription>{qs.description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRODUCT_QUICK_STARTS.map((preset) => {
            const copy = presetCopy[preset.id]
            return (
              <button
                key={preset.id}
                type="button"
                disabled={creating}
                data-slot={`quick-start-${preset.id}`}
                onClick={() => void onChoose(preset)}
                className="flex flex-col items-start gap-1 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="font-medium text-sm">{copy.label}</span>
                <span className="text-muted-foreground text-xs">{copy.description}</span>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={creating}
            data-slot="quick-start-blank"
            onClick={() => void onChoose(null)}
            className="rounded-md px-3 py-1.5 text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {creating ? qs.creating : qs.startBlank}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
