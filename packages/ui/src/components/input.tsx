import { Input as InputPrimitive } from "@base-ui/react/input"
import type * as React from "react"

import { cn } from "../lib/utils.js"

type InputProps = React.ComponentProps<"input">

function hasUsableMax(max: InputProps["max"], min: InputProps["min"]) {
  if (max === undefined || max === null || max === "") return false
  const parsedMax = Number(max)
  const parsedMin = parseNumberAttribute(min)
  if (!Number.isFinite(parsedMax)) return true
  return parsedMin === undefined || parsedMax >= parsedMin
}

function parseNumberAttribute(value: InputProps["min"] | InputProps["step"]) {
  if (value === undefined || value === null || value === "" || value === "any") {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function hasStepMismatch(value: number, min: InputProps["min"], step: InputProps["step"]) {
  const parsedStep = parseNumberAttribute(step)
  if (parsedStep === undefined || parsedStep <= 0) {
    return false
  }
  const base = parseNumberAttribute(min) ?? 0
  const quotient = (value - base) / parsedStep
  return Math.abs(quotient - Math.round(quotient)) > 1e-8
}

function validateNumericTextInput(
  input: HTMLInputElement,
  min: InputProps["min"],
  step: InputProps["step"],
) {
  const rawValue = input.value.trim()
  if (rawValue === "") {
    input.setCustomValidity("")
    return
  }

  const value = Number(rawValue)
  if (!Number.isFinite(value)) {
    input.setCustomValidity("Enter a number.")
    return
  }

  const parsedMin = parseNumberAttribute(min)
  if (parsedMin !== undefined && value < parsedMin) {
    input.setCustomValidity(`Value must be greater than or equal to ${min}.`)
    return
  }

  if (hasStepMismatch(value, min, step)) {
    input.setCustomValidity(`Value must match the step ${step}.`)
    return
  }

  input.setCustomValidity("")
}

function Input({
  className,
  type,
  inputMode,
  min,
  max,
  step,
  onBlur,
  onInput,
  ...props
}: InputProps) {
  const isUnboundedNumberInput = type === "number" && !hasUsableMax(max, min)
  const renderedType = isUnboundedNumberInput ? "text" : type
  const renderedInputMode = isUnboundedNumberInput ? (inputMode ?? "decimal") : inputMode
  const validateUnboundedNumber = (event: React.FormEvent<HTMLInputElement>) => {
    if (isUnboundedNumberInput) {
      validateNumericTextInput(event.currentTarget, min, step)
    }
  }

  return (
    <InputPrimitive
      type={renderedType}
      inputMode={renderedInputMode}
      min={isUnboundedNumberInput ? undefined : min}
      max={isUnboundedNumberInput ? undefined : max}
      step={isUnboundedNumberInput ? undefined : step}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      onBlur={(event) => {
        validateUnboundedNumber(event)
        onBlur?.(event)
      }}
      onInput={(event) => {
        validateUnboundedNumber(event)
        onInput?.(event)
      }}
      {...props}
    />
  )
}

export { Input }
