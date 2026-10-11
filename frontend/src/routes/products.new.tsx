import { createFileRoute } from "@tanstack/react-router";
import { ProductFormPage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/products/new")({
  head: () => pageHead("Add Product", "Create a new product in your catalogue."),
  component: ProductFormPage,
});
