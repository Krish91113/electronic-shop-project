import { createFileRoute } from "@tanstack/react-router";
import { ProductFormPage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/products/$id/edit")({
  head: () => pageHead("Edit Product", "Update this product details and pricing."),
  component: ProductFormPage,
});
