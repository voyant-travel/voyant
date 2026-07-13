"use client"

import { CheckIcon, CopyIcon, SearchIcon, SparklesIcon } from "lucide-react"
import * as React from "react"

import { cn } from "../lib/utils.js"
import { Badge } from "./badge.js"
import { Button } from "./button.js"
import { Input } from "./input.js"
import { ScrollArea } from "./scroll-area.js"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js"

export type TemplateAuthoringVariable = {
  key: string
  label: string
  example: string
  type: string
  description?: string
  deprecated?: boolean
}

export type TemplateAuthoringVariableGroup = {
  id: string
  label: string
  description?: string
  variables: TemplateAuthoringVariable[]
}

export type TemplateAuthoringSnippet = {
  id: string
  label: string
  description: string
  code: string
}

type ContractTemplateAuthoringHelpProps = {
  variableGroups: TemplateAuthoringVariableGroup[]
  snippets?: TemplateAuthoringSnippet[]
  className?: string
  title?: string
  description?: string
  messages?: {
    tabs?: {
      variables?: string
      liquid?: string
    }
    searchPlaceholder?: string
    noVariables?: string
    example?: string
    copy?: string
    copied?: string
    liquidUsage?: string
    noLiquidSnippets?: string
  }
}

function useCopyToClipboard(timeoutMs = 1200) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const copy = React.useCallback(
    async (id: string, text: string) => {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else if (typeof document !== "undefined") {
          // Fallback for browsers without the async clipboard API.
          const textarea = document.createElement("textarea")
          textarea.value = text
          textarea.setAttribute("readonly", "")
          textarea.style.position = "fixed"
          textarea.style.opacity = "0"
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand("copy")
          document.body.removeChild(textarea)
        }
        setCopiedId(id)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setCopiedId(null), timeoutMs)
      } catch {
        // Silent — copy failures are surfaced by the lack of the
        // confirmation state. Better than spamming a toast we don't own.
      }
    },
    [timeoutMs],
  )

  return { copiedId, copy }
}

function matchesSearch(haystack: string, query: string) {
  return haystack.toLowerCase().includes(query)
}

export function ContractTemplateAuthoringHelp({
  variableGroups,
  snippets = [],
  className,
  title = "Template variables",
  description = "Templates render with Liquid. Use output tags for variables and control tags for loops and conditionals.",
  messages,
}: ContractTemplateAuthoringHelpProps) {
  const [search, setSearch] = React.useState("")
  const normalizedQuery = search.trim().toLowerCase()
  const { copiedId, copy } = useCopyToClipboard()
  const copyLabel = messages?.copy ?? "Copy"
  const copiedLabel = messages?.copied ?? "Copied"

  const filteredGroups = React.useMemo(() => {
    if (!normalizedQuery) {
      return variableGroups
    }

    return variableGroups
      .map((group) => ({
        ...group,
        variables: group.variables.filter((variable) =>
          matchesSearch(
            [variable.key, variable.label, variable.description, variable.example, variable.type]
              .filter(Boolean)
              .join(" "),
            normalizedQuery,
          ),
        ),
      }))
      .filter((group) => group.variables.length > 0)
  }, [normalizedQuery, variableGroups])

  const filteredSnippets = React.useMemo(() => {
    if (!normalizedQuery) {
      return snippets
    }

    return snippets.filter((snippet) =>
      matchesSearch(
        [snippet.label, snippet.description, snippet.code].filter(Boolean).join(" "),
        normalizedQuery,
      ),
    )
  }, [normalizedQuery, snippets])

  return (
    <div className={cn("rounded-md border bg-muted/20", className)}>
      <div className="flex flex-col gap-1 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <Tabs defaultValue="variables" className="gap-3 p-4">
        <TabsList className="w-full">
          <TabsTrigger value="variables">{messages?.tabs?.variables ?? "Variables"}</TabsTrigger>
          <TabsTrigger value="liquid">{messages?.tabs?.liquid ?? "Liquid"}</TabsTrigger>
        </TabsList>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={messages?.searchPlaceholder ?? "Search variables or snippets..."}
            className="pl-9"
          />
        </div>

        <TabsContent value="variables">
          <ScrollArea className="h-80">
            <div className="space-y-4 pr-3">
              {filteredGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {messages?.noVariables ?? "No variables match this search."}
                </p>
              ) : (
                filteredGroups.map((group) => (
                  <section key={group.id} className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium">{group.label}</h4>
                        <Badge variant="outline">{group.variables.length}</Badge>
                      </div>
                      {group.description ? (
                        <p className="text-xs text-muted-foreground">{group.description}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      {group.variables.map((variable) => (
                        <div
                          key={variable.key}
                          className="rounded-md border bg-background p-3 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{variable.label}</p>
                                <Badge variant="outline" className="font-normal">
                                  {variable.type}
                                </Badge>
                              </div>
                              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                {`{{ ${variable.key} }}`}
                              </code>
                              {variable.description ? (
                                <p className="text-xs text-muted-foreground">
                                  {variable.description}
                                </p>
                              ) : null}
                              <p className="text-xs text-muted-foreground">
                                {messages?.example ?? "Example"}:{" "}
                                <span className="font-mono text-foreground">
                                  {variable.example}
                                </span>
                              </p>
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              aria-label={`${copyLabel} ${variable.key}`}
                              onClick={() => copy(`var:${variable.key}`, `{{ ${variable.key} }}`)}
                            >
                              {copiedId === `var:${variable.key}` ? (
                                <>
                                  <CheckIcon className="mr-1.5 h-3.5 w-3.5" />
                                  {copiedLabel}
                                </>
                              ) : (
                                <>
                                  <CopyIcon className="mr-1.5 h-3.5 w-3.5" />
                                  {copyLabel}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="liquid">
          <ScrollArea className="h-80">
            <div className="space-y-3 pr-3">
              <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                {messages?.liquidUsage ??
                  "Use {{ ... }} for output and {% ... %} for control flow."}
              </div>

              {filteredSnippets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {messages?.noLiquidSnippets ?? "No Liquid snippets match this search."}
                </p>
              ) : (
                filteredSnippets.map((snippet) => (
                  <div key={snippet.id} className="rounded-md border bg-background p-3 shadow-xs">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{snippet.label}</p>
                        <p className="text-xs text-muted-foreground">{snippet.description}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`${copyLabel} ${snippet.label}`}
                        onClick={() => copy(`snippet:${snippet.id}`, snippet.code)}
                      >
                        {copiedId === `snippet:${snippet.id}` ? (
                          <>
                            <CheckIcon className="mr-1.5 h-3.5 w-3.5" />
                            {copiedLabel}
                          </>
                        ) : (
                          <>
                            <CopyIcon className="mr-1.5 h-3.5 w-3.5" />
                            {copyLabel}
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs text-foreground">
                      {snippet.code}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
