"use client"

import { Button } from "@voyant-travel/ui/components/button"

import { useBookingsUiMessagesOrDefault } from "../../i18n/index.js"
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
  const messages = useBookingsUiMessagesOrDefault()
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
              {messages.bookingJourney.steps[step]}
            </Button>
          </li>
        )
      })}
    </ol>
  )
}
