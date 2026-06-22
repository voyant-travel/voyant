"use client"

import { useState } from "react"

import type { PresenceMember } from "./connector.js"
import { useChannel } from "./use-channel.js"

/**
 * Track the presence member list of a channel ("Ana is viewing this booking").
 * Returns the current members; `profile` is announced as this client's entry.
 */
export function usePresence(
  channel: string | null | undefined,
  profile?: unknown,
): ReadonlyArray<PresenceMember> {
  const [members, setMembers] = useState<ReadonlyArray<PresenceMember>>([])

  useChannel(channel, { profile, onPresence: setMembers })

  return members
}
