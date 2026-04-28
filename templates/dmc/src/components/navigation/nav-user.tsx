import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@voyantjs/ui/components"
import { useLocale, useTheme } from "@voyantjs/voyant-admin"
import { BadgeCheck, Bell, Check, ChevronsUpDown, LogOut, Moon, Sun } from "lucide-react"
import { useAdminMessages } from "@/lib/admin-i18n"
import { useSignOut } from "@/lib/auth"
import { getInitials } from "@/lib/utils/initials"

export function NavUser({
  user,
}: {
  user: {
    name: string
    firstName?: string
    lastName?: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const { setTheme, theme, resolvedTheme } = useTheme()
  const { setLocale, resolvedLocale } = useLocale()
  const signOut = useSignOut()
  const messages = useAdminMessages()

  const firstName = user.firstName ?? (user.name ? user.name.split(" ")[0] : "") ?? ""
  const lastName = user.lastName ?? (user.name ? user.name.split(" ").slice(1).join(" ") : "") ?? ""

  let initials: string
  if (firstName || lastName) {
    initials = getInitials(firstName, lastName)
  } else if (user.email) {
    const emailPrefix = user.email.split("@")[0] || ""
    if (emailPrefix.length >= 2) {
      initials = emailPrefix.substring(0, 2).toUpperCase()
    } else if (emailPrefix.length === 1) {
      initials = emailPrefix.charAt(0).toUpperCase()
    } else {
      initials = "?"
    }
  } else {
    initials = "?"
  }

  const displayName = user.name.trim() || user.email
  const showEmailSeparately = user.name.trim() !== "" && user.name !== user.email

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar || undefined} alt={displayName} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                {showEmailSeparately && <span className="truncate text-xs">{user.email}</span>}
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <div className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar || undefined} alt={displayName} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  {showEmailSeparately && <span className="truncate text-xs">{user.email}</span>}
                </div>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <BadgeCheck />
                {messages.account}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="h-4 w-4" />
                {messages.light}
                {(theme === "light" || (theme === "system" && resolvedTheme === "light")) && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="h-4 w-4" />
                {messages.dark}
                {(theme === "dark" || (theme === "system" && resolvedTheme === "dark")) && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>{messages.language}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocale("en")}>
                {messages.english}
                {resolvedLocale === "en" && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocale("ro")}>
                {messages.romanian}
                {resolvedLocale === "ro" && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                {messages.notifications}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ redirectTo: "/sign-in" })}>
              <LogOut />
              {messages.logOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
