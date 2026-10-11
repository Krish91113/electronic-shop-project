import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { SalesPage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/sales")({
  head: () => pageHead("Sales History", "Every completed sale and its invoice."),
  component: Page,
});
function Page() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.replace(/\/$/, "") === "/sales" ? <SalesPage /> : <Outlet />;
}
