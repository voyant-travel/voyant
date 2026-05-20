import * as React from "react"
import { RichTextEditor } from "@voyantjs/ui/components/rich-text-editor"
import { cn } from "@voyantjs/ui/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Badge } from "./badge"
import { Button } from "./button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"
import { Checkbox } from "./checkbox"
import {
  CollapsibleContent,
  Collapsible as LocalCollapsible,
  CollapsibleTrigger as LocalCollapsibleTrigger,
} from "./collapsible"
import { ConfirmActionButton } from "./confirm-action-button"
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  Dialog as LocalDialog,
  DialogContent as LocalDialogContent,
} from "./dialog"
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenu as LocalDropdownMenu,
  DropdownMenuItem as LocalDropdownMenuItem,
  DropdownMenuTrigger as LocalDropdownMenuTrigger,
} from "./dropdown-menu"
import { Input } from "./input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./input-otp"
import { Label } from "./label"
import { OverviewMetric } from "./overview-metric"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { SelectionActionBar } from "./selection-action-bar"
import {
  SidebarMenuButton as LocalSidebarMenuButton,
  SidebarMenuSubButton as LocalSidebarMenuSubButton,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "./sidebar"
import { Toaster } from "./sonner"
import { Switch } from "./switch"
import { Textarea } from "./textarea"

type AsChildProps = {
  asChild?: boolean
  children?: React.ReactNode
}

function withAsChild<P extends object>(Component: React.ComponentType<P>, displayName: string) {
  function Wrapped({ asChild, children, ...props }: P & AsChildProps) {
    if (asChild && React.isValidElement(children)) {
      return (
        <Component
          {...({
            ...props,
            render: children,
          } as P)}
        />
      )
    }

    return <Component {...({ ...props, children } as P)} />
  }

  Wrapped.displayName = displayName

  return Wrapped
}

const dialogSizeClasses = {
  sm: "sm:max-w-sm",
  default: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100vh-2rem)]",
} as const

function Dialog({ ...props }: React.ComponentProps<typeof LocalDialog>) {
  return <LocalDialog {...props} />
}

function DialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof LocalDialogContent> & {
  size?: keyof typeof dialogSizeClasses
}) {
  return <LocalDialogContent className={cn(dialogSizeClasses[size], className)} {...props} />
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-body" className={cn("flex-1 py-4", className)} {...props} />
}

const Collapsible = withAsChild(LocalCollapsible as React.ComponentType<any>, "Collapsible")

const CollapsibleTrigger = withAsChild(
  LocalCollapsibleTrigger as React.ComponentType<any>,
  "CollapsibleTrigger",
)

const DropdownMenu = LocalDropdownMenu

const DropdownMenuTrigger = withAsChild(
  LocalDropdownMenuTrigger as React.ComponentType<any>,
  "DropdownMenuTrigger",
)

const DropdownMenuItem = withAsChild(
  LocalDropdownMenuItem as React.ComponentType<any>,
  "DropdownMenuItem",
)

const SidebarMenuButton = withAsChild(
  LocalSidebarMenuButton as React.ComponentType<any>,
  "SidebarMenuButton",
)

const SidebarMenuSubButton = withAsChild(
  LocalSidebarMenuSubButton as React.ComponentType<any>,
  "SidebarMenuSubButton",
)

export {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ConfirmActionButton,
  cn,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Label,
  OverviewMetric,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectionActionBar,
  SelectTrigger,
  SelectValue,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Switch,
  Textarea,
  Toaster,
  useSidebar,
}
