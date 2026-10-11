import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/reports/profit-loss")({
  head: () => pageHead("Profit and Loss", "A summary of your shop's performance."),
  component: ReportsPage,
});
