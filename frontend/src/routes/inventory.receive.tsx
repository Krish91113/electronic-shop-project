import { createFileRoute } from "@tanstack/react-router";
import { ReceiveStockPage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/inventory/receive")({
  head: () => pageHead("Receive Stock", "Scan a barcode and record a delivery."),
  component: ReceiveStockPage,
});
