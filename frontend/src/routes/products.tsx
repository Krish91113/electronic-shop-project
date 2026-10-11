import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ProductsPage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/products")({
  head: () => pageHead("Product Management", "Manage your shop catalogue, pricing and stock."),
  component: Page,
});
function Page() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.replace(/\/$/, "") === "/products" ? <ProductsPage /> : <Outlet />;
}
