import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "@/components/shop/billing";
export const Route = createFileRoute("/billing")({ component: BillingPage });
