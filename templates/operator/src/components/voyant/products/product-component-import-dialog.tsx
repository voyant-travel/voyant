import {
  type ImportProductComponentsInput,
  type ProductComponentImportSummary,
  useProductComponentMutation,
} from "@voyantjs/products-react"
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useMemo, useState } from "react"

type ComponentImportMode = Exclude<ImportProductComponentsInput["mode"], undefined>

const defaultPayload = JSON.stringify(
  {
    components: [
      {
        componentKind: "transport",
        title: "Coach transfer",
        selection: "fixed",
        commitmentBoundary: "internal",
        priceDisposition: "included",
        required: true,
        binding: {
          type: "inline",
          content: {
            legs: [{ mode: "coach" }],
          },
        },
        choices: [],
      },
    ],
  },
  null,
  2,
)

export function ProductComponentImportDialog({
  open,
  onOpenChange,
  productId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  onSuccess: () => void
}) {
  const mutation = useProductComponentMutation()
  const [mode, setMode] = useState<ComponentImportMode>("append")
  const [dryRun, setDryRun] = useState(true)
  const [payload, setPayload] = useState(defaultPayload)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ProductComponentImportSummary | null>(null)
  const saving = mutation.importComponents.isPending

  const buttonLabel = useMemo(() => {
    if (saving) return dryRun ? "Validating" : "Importing"
    return dryRun ? "Validate" : "Import"
  }, [dryRun, saving])

  function parsePayload(): Pick<ImportProductComponentsInput, "components"> | null {
    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid JSON")
      return null
    }

    if (Array.isArray(parsed)) {
      return { components: parsed as ImportProductComponentsInput["components"] }
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "components" in parsed &&
      Array.isArray((parsed as { components?: unknown }).components)
    ) {
      return {
        components: (parsed as { components: ImportProductComponentsInput["components"] })
          .components,
      }
    }

    setError("Payload must be an array or an object with a components array.")
    return null
  }

  function submit() {
    setError(null)
    setSummary(null)
    const parsed = parsePayload()
    if (!parsed) return

    mutation.importComponents.mutate(
      {
        productId,
        mode,
        dryRun,
        components: parsed.components,
      },
      {
        onSuccess: (result) => {
          setSummary(result.summary)
          if (!result.summary.dryRun) {
            onSuccess()
          }
        },
        onError: (cause) => {
          setError(cause instanceof Error ? cause.message : "Import failed")
        },
      },
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>Import components</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select
                  value={mode}
                  onValueChange={(value) => setMode(value as ComponentImportMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Append</SelectItem>
                    <SelectItem value="replace">Replace</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-7">
                <Switch checked={dryRun} onCheckedChange={setDryRun} />
                <span className="text-sm">Dry run</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>JSON payload</Label>
              <Textarea
                className="min-h-96 font-mono text-xs"
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                spellCheck={false}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {summary ? (
              <p className="text-sm text-muted-foreground">
                {summary.dryRun ? "Validated" : "Imported"} {summary.requested} component
                {summary.requested === 1 ? "" : "s"}; {summary.deleted} replaced.
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="button" disabled={saving} onClick={submit}>
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {buttonLabel}
              </Button>
            </div>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
