import { createFileRoute } from "@tanstack/react-router";
import { Catalogue } from "@/components/shop/public";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Catalogue",
      "Browse the Volt Electronics catalogue. Real products to explore online and find in store.",
    ),
  component: Catalogue,
});
