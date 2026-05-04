import * as React from "react"
import { cn } from "../lib/utils"
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
import { ContractTemplateAuthoringHelp } from "./contract-template-authoring-help"
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
import { NotificationDeliveriesPage } from "./notification-deliveries-page"
import { NotificationDeliveryDetailDialog } from "./notification-delivery-detail-dialog"
import { NotificationReminderRulesPage } from "./notification-reminder-rules-page"
import { NotificationReminderRunsPage } from "./notification-reminder-runs-page"
import { NotificationTemplateAuthoringHelp } from "./notification-template-authoring-help"
import { NotificationTemplateDetailPage } from "./notification-template-detail-page"
import { NotificationTemplatesPage } from "./notification-templates-page"
import { OverviewMetric } from "./overview-metric"
import { RadioGroup, RadioGroupItem } from "./radio-group"
import { RichTextEditor } from "./rich-text-editor"
import { ScrollArea, ScrollBar } from "./scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { SelectionActionBar } from "./selection-action-bar"
import {
  Sheet as LocalSheet,
  SheetContent as LocalSheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./sheet"
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

type AsChildComponent = React.ComponentType<Record<string, unknown>>

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
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-1 overflow-y-auto py-4 pr-1", className)}
      {...props}
    />
  )
}

const sheetSizeClasses = {
  sm: "data-[side=right]:sm:max-w-sm data-[side=left]:sm:max-w-sm",
  default: "data-[side=right]:sm:max-w-lg data-[side=left]:sm:max-w-lg",
  lg: "data-[side=right]:sm:max-w-2xl data-[side=left]:sm:max-w-2xl",
  xl: "data-[side=right]:sm:max-w-4xl data-[side=left]:sm:max-w-4xl",
} as const

function Sheet({ ...props }: React.ComponentProps<typeof LocalSheet>) {
  return <LocalSheet {...props} />
}

function SheetContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof LocalSheetContent> & {
  size?: keyof typeof sheetSizeClasses
}) {
  return <LocalSheetContent className={cn(sheetSizeClasses[size], className)} {...props} />
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sheet-body" className={cn("overflow-y-auto px-4 py-4", className)} {...props} />
  )
}

const Collapsible = withAsChild(LocalCollapsible as AsChildComponent, "Collapsible")

const CollapsibleTrigger = withAsChild(
  LocalCollapsibleTrigger as AsChildComponent,
  "CollapsibleTrigger",
)

const DropdownMenu = LocalDropdownMenu

const DropdownMenuTrigger = withAsChild(
  LocalDropdownMenuTrigger as AsChildComponent,
  "DropdownMenuTrigger",
)

const DropdownMenuItem = withAsChild(LocalDropdownMenuItem as AsChildComponent, "DropdownMenuItem")

const SidebarMenuButton = withAsChild(
  LocalSidebarMenuButton as AsChildComponent,
  "SidebarMenuButton",
)

const SidebarMenuSubButton = withAsChild(
  LocalSidebarMenuSubButton as AsChildComponent,
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
  ContractTemplateAuthoringHelp,
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
  NotificationDeliveriesPage,
  NotificationDeliveryDetailDialog,
  NotificationReminderRulesPage,
  NotificationReminderRunsPage,
  NotificationTemplateAuthoringHelp,
  NotificationTemplateDetailPage,
  NotificationTemplatesPage,
  OverviewMetric,
  RadioGroup,
  RadioGroupItem,
  RichTextEditor,
  ScrollArea,
  ScrollBar,
  Select,
  SelectContent,
  SelectItem,
  SelectionActionBar,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
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
