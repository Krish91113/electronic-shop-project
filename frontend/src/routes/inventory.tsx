import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { InventoryPage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/inventory")({
  head: () => pageHead("Inventory", "Track stock levels across your catalogue."),
  component: Page,
});
function Page() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.replace(/\/$/, "") === "/inventory" ? <InventoryPage /> : <Outlet />;
}
