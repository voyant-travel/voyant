import { Loader2 } from "lucide-react"
import { useState } from "react"
import type * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog"
import { Button } from "./button"

function ConfirmActionButton({
  buttonLabel,
  confirmLabel,
  title,
  description,
  onConfirm,
  disabled = false,
  variant = "outline",
  confirmVariant = "default",
}: {
  buttonLabel: string
  confirmLabel: string
  title: string
  description: React.ReactNode
  onConfirm: () => Promise<void> | void
  disabled?: boolean
  variant?: React.ComponentProps<typeof Button>["variant"]
  confirmVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const handleConfirm = async () => {
    setPending(true)

    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        disabled={disabled || pending}
        render={<Button variant={variant} size="sm" />}
      >
        {buttonLabel}
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant}
            disabled={pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ConfirmActionButton }
