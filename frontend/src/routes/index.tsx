import { createFileRoute } from "@tanstack/react-router";
import { ShopChooser } from "@/components/shop/public";
import { pageHead } from "@/components/shop/data";
import { STORE_NAME } from "@/lib/constants";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Store Directory",
      `Choose a ${STORE_NAME} branch to browse live stock, in-store pricing and warranty support.`,
    ),
  component: ShopChooser,
});
