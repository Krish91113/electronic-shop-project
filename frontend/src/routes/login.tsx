import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/shop/public";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});
