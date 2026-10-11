import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";

export const Route = createFileRoute("/dashboard")({
  head: () => pageHead("Dashboard", "An overview of your shop's sales, profit and stock."),
  component: DashboardPage,
});
