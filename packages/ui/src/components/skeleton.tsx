import { cn } from "../lib/utils.js"

interface SkeletonProps extends Omit<React.ComponentPropsWithoutRef<"div">, "style"> {
  className?: string
  style?: Record<string, string | number | undefined>
}

function Skeleton({ className, style, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      style={style}
      {...props}
    />
  )
}

export { Skeleton }
