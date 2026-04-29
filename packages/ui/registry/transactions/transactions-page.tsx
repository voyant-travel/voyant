"use client"

import { Receipt } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRegistryTransactionsMessagesOrDefault } from "./i18n"
import { OffersTab } from "./offers-tab"
import { OrdersTab } from "./orders-tab"

export function TransactionsPage() {
  const pageMessages = useRegistryTransactionsMessagesOrDefault().page

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Receipt className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">{pageMessages.description}</p>

      <Tabs defaultValue="offers" className="w-full">
        <TabsList>
          <TabsTrigger value="offers">{pageMessages.tabs.offers}</TabsTrigger>
          <TabsTrigger value="orders">{pageMessages.tabs.orders}</TabsTrigger>
        </TabsList>
        <TabsContent value="offers" className="mt-4">
          <OffersTab />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <OrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
