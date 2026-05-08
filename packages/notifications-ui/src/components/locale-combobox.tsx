"use client"

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import * as React from "react"

type LocaleEntry = { code: string; label: string }

const LOCALES: readonly LocaleEntry[] = [
  { code: "en-US", label: "English (United States)" },
  { code: "en-GB", label: "English (United Kingdom)" },
  { code: "en-CA", label: "English (Canada)" },
  { code: "en-AU", label: "English (Australia)" },
  { code: "en-IE", label: "English (Ireland)" },
  { code: "en-NZ", label: "English (New Zealand)" },
  { code: "ro-RO", label: "Romanian (Romania)" },
  { code: "fr-FR", label: "French (France)" },
  { code: "fr-CA", label: "French (Canada)" },
  { code: "fr-BE", label: "French (Belgium)" },
  { code: "de-DE", label: "German (Germany)" },
  { code: "de-AT", label: "German (Austria)" },
  { code: "de-CH", label: "German (Switzerland)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "es-AR", label: "Spanish (Argentina)" },
  { code: "it-IT", label: "Italian (Italy)" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "nl-NL", label: "Dutch (Netherlands)" },
  { code: "nl-BE", label: "Dutch (Belgium)" },
  { code: "sv-SE", label: "Swedish (Sweden)" },
  { code: "no-NO", label: "Norwegian (Norway)" },
  { code: "da-DK", label: "Danish (Denmark)" },
  { code: "fi-FI", label: "Finnish (Finland)" },
  { code: "pl-PL", label: "Polish (Poland)" },
  { code: "cs-CZ", label: "Czech (Czechia)" },
  { code: "hu-HU", label: "Hungarian (Hungary)" },
  { code: "el-GR", label: "Greek (Greece)" },
  { code: "tr-TR", label: "Turkish (Turkey)" },
  { code: "ru-RU", label: "Russian (Russia)" },
  { code: "uk-UA", label: "Ukrainian (Ukraine)" },
  { code: "ja-JP", label: "Japanese (Japan)" },
  { code: "ko-KR", label: "Korean (South Korea)" },
  { code: "zh-CN", label: "Chinese (Mainland)" },
  { code: "zh-TW", label: "Chinese (Taiwan)" },
  { code: "zh-HK", label: "Chinese (Hong Kong)" },
  { code: "ar-AE", label: "Arabic (UAE)" },
  { code: "ar-EG", label: "Arabic (Egypt)" },
  { code: "he-IL", label: "Hebrew (Israel)" },
  { code: "hi-IN", label: "Hindi (India)" },
  { code: "th-TH", label: "Thai (Thailand)" },
  { code: "vi-VN", label: "Vietnamese (Vietnam)" },
  { code: "id-ID", label: "Indonesian (Indonesia)" },
]

const LOCALE_BY_CODE = new Map<string, LocaleEntry>()
for (const entry of LOCALES) LOCALE_BY_CODE.set(entry.code, entry)

export interface LocaleComboboxProps {
  value: string | null | undefined
  onChange: (value: string | null) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
}

export function LocaleCombobox({
  value,
  onChange,
  placeholder = "Search locales…",
  emptyText = "No locales found.",
  disabled,
}: LocaleComboboxProps) {
  const labelFor = React.useCallback((code: string | null) => {
    if (!code) return ""
    const entry = LOCALE_BY_CODE.get(code)
    return entry ? `${entry.label} (${entry.code})` : code
  }, [])

  const [inputValue, setInputValue] = React.useState(labelFor(value ?? null))
  React.useEffect(() => {
    setInputValue(labelFor(value ?? null))
  }, [value, labelFor])

  const itemCodes = React.useMemo(() => LOCALES.map((entry) => entry.code), [])

  const itemToStringLabel = React.useCallback(
    (code: unknown) => {
      return labelFor(code as string)
    },
    [labelFor],
  )

  return (
    <Combobox
      items={itemCodes}
      value={value ?? null}
      inputValue={inputValue}
      autoHighlight
      disabled={disabled}
      itemToStringLabel={itemToStringLabel}
      itemToStringValue={(code) => code as string}
      onInputValueChange={(next) => {
        setInputValue(next)
        if (!next) onChange(null)
      }}
      onValueChange={(next) => {
        const code = (next as string | null) ?? null
        onChange(code)
        setInputValue(labelFor(code))
      }}
    >
      <ComboboxInput placeholder={placeholder} showClear={Boolean(value)} />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(code) => {
              const entry = LOCALE_BY_CODE.get(code as string)
              if (!entry) return null
              return (
                <ComboboxItem key={entry.code} value={entry.code}>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">{entry.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{entry.code}</span>
                  </div>
                </ComboboxItem>
              )
            }}
          </ComboboxCollection>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
