import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ShopCatalogue } from "@/components/shop/public";
import { pageHead } from "@/components/shop/data";

export const Route = createFileRoute("/shop/$shopSlug")({
  head: () => pageHead("Shop Catalogue", "Live shop stock and catalogue."),
  component: Page,
});

function Page() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.includes("/products/") ? <Outlet /> : <ShopCatalogue />;
}
