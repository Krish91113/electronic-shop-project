import { createFileRoute } from "@tanstack/react-router";
import { ProductDetail } from "@/components/shop/public";
import { pageHead } from "@/components/shop/data";

export const Route = createFileRoute("/shop/$shopSlug/products/$productSlug")({
  head: () => pageHead("Product Details", "View live product details, warranty and availability."),
  component: ProductDetail,
});
