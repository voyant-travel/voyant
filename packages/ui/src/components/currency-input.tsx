"use client"

import * as React from "react"

import { cn } from "../lib/utils.js"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "./input-group.js"

type NativeInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "value" | "defaultValue" | "onChange" | "type"
>

export interface CurrencyInputProps extends NativeInputProps {
  value: number | null | undefined
  onChange: (value: number | null) => void
  currency: string | null | undefined
  decimals?: number
  locale?: string
  allowNegative?: boolean
  inputClassName?: string
}

function formatMinorUnits(
  value: number | null | undefined,
  decimals: number,
  locale: string,
): string {
  if (value == null || !Number.isFinite(value)) return ""
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(value / 10 ** decimals)
}

function getDecimalSeparator(locale: string): string {
  const part = new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === "decimal")
  return part?.value ?? "."
}

function normalizeCurrency(currency: string | null | undefined): string | null {
  const code = currency?.trim().toUpperCase()
  return code || null
}

function getCurrencySymbol(currency: string, locale: string): string {
  try {
    const part = new Intl.NumberFormat(locale, {
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      style: "currency",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")

    return part?.value ?? currency
  } catch {
    return currency
  }
}

export function parseCurrencyInput(
  raw: string,
  {
    decimals = 2,
    locale = "en",
    allowNegative = false,
  }: Pick<CurrencyInputProps, "decimals" | "locale" | "allowNegative"> = {},
): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const negative = allowNegative && /^-/.test(trimmed)
  const normalized = trimmed.replace(/[^\d.,]/g, "")
  if (!/\d/.test(normalized)) return null

  const lastDot = normalized.lastIndexOf(".")
  const lastComma = normalized.lastIndexOf(",")
  const localeDecimal = getDecimalSeparator(locale)
  let decimalIndex = Math.max(lastDot, lastComma)

  if (decimalIndex >= 0 && (lastDot === -1) !== (lastComma === -1)) {
    const separator = lastDot >= 0 ? "." : ","
    const fractionalLength = normalized.length - decimalIndex - 1
    const isLikelyGrouping = fractionalLength === 3 && separator !== localeDecimal
    if (isLikelyGrouping) {
      decimalIndex = -1
    }
  }

  const integerRaw = decimalIndex >= 0 ? normalized.slice(0, decimalIndex) : normalized
  const fractionalRaw = decimalIndex >= 0 ? normalized.slice(decimalIndex + 1) : ""
  const integer = integerRaw.replace(/\D/g, "") || "0"
  const fractional = fractionalRaw.replace(/\D/g, "").slice(0, decimals).padEnd(decimals, "0")
  const amount = Number.parseInt(`${integer}${fractional}`, 10)

  if (!Number.isFinite(amount)) return null
  return negative ? -amount : amount
}

export function CurrencyInput({
  value,
  onChange,
  currency,
  decimals = 2,
  locale = "en",
  allowNegative = false,
  className,
  inputClassName,
  onBlur,
  onFocus,
  disabled,
  placeholder,
  ...props
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() =>
    formatMinorUnits(value, decimals, locale),
  )
  const [isFocused, setIsFocused] = React.useState(false)

  React.useEffect(() => {
    if (isFocused) return
    setDisplayValue(formatMinorUnits(value, decimals, locale))
  }, [decimals, isFocused, locale, value])

  const currencyCode = normalizeCurrency(currency)
  const currencySymbol = currencyCode ? getCurrencySymbol(currencyCode, locale) : null

  return (
    <InputGroup className={className} data-disabled={disabled ? true : undefined}>
      {currencySymbol ? (
        <InputGroupAddon>
          <InputGroupText>{currencySymbol}</InputGroupText>
        </InputGroupAddon>
      ) : null}
      <InputGroupInput
        {...props}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder ?? formatMinorUnits(0, decimals, locale)}
        value={displayValue}
        onChange={(event) => {
          const next = event.target.value
          setDisplayValue(next)
          onChange(parseCurrencyInput(next, { decimals, locale, allowNegative }))
        }}
        onFocus={(event) => {
          setIsFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          const parsed = parseCurrencyInput(displayValue, { decimals, locale, allowNegative })
          setIsFocused(false)
          onChange(parsed)
          setDisplayValue(formatMinorUnits(parsed, decimals, locale))
          onBlur?.(event)
        }}
        className={cn("tabular-nums", inputClassName)}
      />
      {currencyCode ? (
        <InputGroupAddon align="inline-end">
          <InputGroupText>{currencyCode}</InputGroupText>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
