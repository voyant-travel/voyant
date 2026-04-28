import { useQuery } from "@tanstack/react-query"
import { Label } from "@voyantjs/ui/components"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { ClipboardList } from "lucide-react"
import { useState } from "react"
import { BookingRequirementsContactTab } from "./booking-requirements-contact-tab"
import { BookingRequirementsQuestionsTab } from "./booking-requirements-questions-tab"
import { getBookingRequirementProductsQueryOptions } from "./booking-requirements-shared"

export function BookingRequirementsPage() {
  const [productId, setProductId] = useState("")
  const productsQuery = useQuery(getBookingRequirementProductsQueryOptions())
  const products = productsQuery.data?.data ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Booking Requirements</h1>
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <Label>Product</Label>
        <Select
          items={products.map((product) => ({
            label: `${product.name}${product.code ? ` · ${product.code}` : ""}`,
            value: product.id,
          }))}
          value={productId}
          onValueChange={(value) => setProductId(value ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a product…" />
          </SelectTrigger>
          <SelectContent>
            {products.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                {productsQuery.isPending ? "Loading…" : "No products"}
              </div>
            ) : null}
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
                {product.code ? ` · ${product.code}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Pick a product to configure traveler data collection.
        </p>
      </div>

      {!productId ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Select a product above to manage its contact requirements and custom booking questions.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="contact-requirements" className="flex flex-col gap-4">
          <TabsList>
            <TabsTrigger value="contact-requirements">Contact Requirements</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
          </TabsList>
          <TabsContent value="contact-requirements">
            <BookingRequirementsContactTab productId={productId} />
          </TabsContent>
          <TabsContent value="questions">
            <BookingRequirementsQuestionsTab productId={productId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
