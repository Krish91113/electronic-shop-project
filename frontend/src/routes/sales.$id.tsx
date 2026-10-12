import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { InvoicePage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";

export const Route = createFileRoute("/sales/$id")({
  head: () => pageHead("Invoice Preview", "A record of this sale."),
  component: Page,
});

function Page() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.endsWith("/print") ? <Outlet /> : <InvoicePage />;
}
