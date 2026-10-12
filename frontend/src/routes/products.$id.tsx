import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ProductDetail } from "@/components/shop/public";
import { pageHead } from "@/components/shop/data";

export const Route = createFileRoute("/products/$id")({
  head: () =>
    pageHead(
      "Product Details",
      "View product details, availability and specifications at Time Centre Mobile & Electronics.",
    ),
  component: ProductIdRoute,
});

// "/products/$id/edit" is a CHILD route of this one, so this component must render <Outlet />
// for that path. Without it the public product page is shown instead of the owner's edit form.
export function ProductIdRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isChildRoute = /^\/products\/[^/]+\/.+/.test(pathname.replace(/\/$/, ""));
  return isChildRoute ? <Outlet /> : <ProductDetail />;
}
