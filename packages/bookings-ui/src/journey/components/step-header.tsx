"use client"

import { Button } from "@voyantjs/ui/components/button"

import type { JourneyHeaderState, JourneyStep } from "../types.js"

interface StepHeaderProps extends JourneyHeaderState {
  onJumpTo: (step: JourneyStep) => void
}

export function StepHeader({
  current,
  visited,
  steps,
  onJumpTo,
}: StepHeaderProps): React.ReactElement {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((step, idx) => {
        const isCurrent = step === current
        const isVisited = visited.includes(step)
        return (
          <li key={step}>
            <Button
              type="button"
              variant={isCurrent ? "default" : isVisited ? "outline" : "ghost"}
              size="sm"
              disabled={!isVisited && !isCurrent}
              onClick={() => onJumpTo(step)}
            >
              <span className="mr-1 font-mono text-xs">{idx + 1}.</span>
              {labelForStep(step)}
            </Button>
          </li>
        )
      })}
    </ol>
  )
}

function labelForStep(step: JourneyStep): string {
  switch (step) {
    case "configure":
      return "Configure"
    case "billing":
      return "Billing"
    case "travelers":
      return "Travelers"
    case "accommodation":
      return "Accommodation"
    case "addons":
      return "Add-ons"
    case "payment":
      return "Payment"
    case "review":
      return "Review"
  }
}
