import { createFileRoute } from "@tanstack/react-router";
import { InvoicePage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/sales/$id")({
  head: () => pageHead("Invoice Preview", "A record of this sale."),
  component: InvoicePage,
});
