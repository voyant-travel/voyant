import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { cn } from "@voyantjs/ui/lib/utils"
import { currencies } from "@voyantjs/utils/currencies"
import { formatMessage } from "@voyantjs/voyant-admin"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

const CURRENCY_CODES = Object.keys(currencies).sort()

interface InlineCurrencyFieldProps {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: string | null
  disabled?: boolean
  onSave: (next: string | null) => Promise<void>
}

export function InlineCurrencyField({
  icon: Icon,
  label,
  value,
  disabled,
  onSave,
}: InlineCurrencyFieldProps) {
  const messages = useAdminMessages().crm.shared
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function commitSelection(next: string | null) {
    setSaving(true)
    setError(null)
    try {
      await onSave(next)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.failedToSave)
    } finally {
      setSaving(false)
    }
  }

  const currencyInfo = value ? currencies[value as keyof typeof currencies] : null

  return (
    <div className="group flex items-start gap-3 py-1.5">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {editing ? (
          <Combobox
            items={CURRENCY_CODES}
            defaultOpen
            autoHighlight
            filter={(code, query) => {
              const c = currencies[code as keyof typeof currencies]
              if (!c) return false
              const q = query.toLowerCase()
              return (
                c.code.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                c.symbol.toLowerCase().includes(q)
              )
            }}
            onValueChange={(v) => void commitSelection((v as string | null) ?? null)}
            onOpenChange={(open) => {
              if (!open) setEditing(false)
            }}
          >
            <ComboboxInput
              autoFocus
              placeholder={messages.searchCurrencyPlaceholder}
              className="mt-0.5 h-8 text-sm"
              disabled={saving}
            />
            <ComboboxContent>
              <ComboboxEmpty>{messages.noCurrenciesFound}</ComboboxEmpty>
              <ComboboxList>
                <ComboboxCollection>
                  {(code: string) => {
                    const c = currencies[code as keyof typeof currencies]
                    return (
                      <ComboboxItem key={code} value={code}>
                        <span className="min-w-10 font-mono text-xs text-muted-foreground">
                          {code}
                        </span>
                        <span className="truncate">{c?.name ?? code}</span>
                      </ComboboxItem>
                    )
                  }}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => !disabled && setEditing(true)}
              disabled={disabled}
              className={cn(
                "-mx-1 flex-1 truncate rounded px-1 py-0.5 text-left text-sm transition-colors",
                !disabled && "hover:bg-muted/60 cursor-text",
                !value && "text-muted-foreground italic",
              )}
            >
              {value ? (
                <span>
                  <span className="font-mono">{value}</span>
                  {currencyInfo ? (
                    <span className="ml-2 text-muted-foreground">{currencyInfo.name}</span>
                  ) : null}
                </span>
              ) : (
                formatMessage(messages.addTemplate, { label: label.toLowerCase() })
              )}
            </button>
            {!disabled ? (
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
            ) : null}
          </div>
        )}
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  )
}
