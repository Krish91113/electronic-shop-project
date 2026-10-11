import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/shop/admin";
import { pageHead } from "@/components/shop/data";
export const Route = createFileRoute("/settings")({
  head: () => pageHead("Shop Settings", "Manage your shop details and invoice preferences."),
  component: SettingsPage,
});
