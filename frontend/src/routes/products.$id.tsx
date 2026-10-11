import { createFileRoute } from "@tanstack/react-router";
import { ProductDetail } from "@/components/shop/public";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/products/$id")({
  head: () =>
    pageHead(
      "Product Details",
      "View product details, availability and specifications at Volt Electronics.",
    ),
  component: ProductDetail,
});
