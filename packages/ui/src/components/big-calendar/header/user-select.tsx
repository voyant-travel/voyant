import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "../../avatar.js"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../select.js"

import { useCalendar } from "../context.js"

export function UserSelect() {
  const { users, selectedUserId, setSelectedUserId } = useCalendar()

  if (users.length === 0) return null

  return (
    <Select value={selectedUserId} onValueChange={(value) => setSelectedUserId(value ?? "all")}>
      <SelectTrigger className="flex-1 md:w-48">
        <SelectValue />
      </SelectTrigger>

      <SelectContent align="end">
        <SelectItem value="all">
          <div className="flex items-center gap-1">
            <AvatarGroup>
              {users.slice(0, 2).map((user) => (
                <Avatar key={user.id} className="size-6">
                  <AvatarImage src={user.picturePath ?? undefined} alt={user.name} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
            All
          </div>
        </SelectItem>

        {users.map((user) => (
          <SelectItem key={user.id} value={user.id} className="flex-1">
            <div className="flex items-center gap-2">
              <Avatar className="size-6">
                <AvatarImage src={user.picturePath ?? undefined} alt={user.name} />
                <AvatarFallback>{user.name[0]}</AvatarFallback>
              </Avatar>

              <p className="truncate">{user.name}</p>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
