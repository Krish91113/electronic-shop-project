import React from "react";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Replace the heavy pages with markers so we only test WHICH page the router shows.
vi.mock("@/components/shop/public", async (orig) => ({
  ...(await orig<object>()),
  ProductDetail: () => <div>PUBLIC-PRODUCT-DETAIL</div>,
}));
vi.mock("@/components/shop/admin", async (orig) => ({
  ...(await orig<object>()),
  ProductFormPage: () => <div>ADMIN-PRODUCT-EDIT-FORM</div>,
  ProductsPage: () => <div>ADMIN-PRODUCT-LIST</div>,
}));

// Pretend an owner is logged in so the protected-route guard lets /products/:id/edit through.
vi.mock("@/lib/auth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ isLoading: false, isAuthenticated: true, user: null, activeShop: null }),
}));

import { routeTree } from "@/routeTree.gen";

async function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient: new QueryClient() },
  });
  await router.load();
  render(<RouterProvider router={router} />);
}

describe("product routes", () => {
  it("/products/:id/edit shows the owner's edit form, not the public page", async () => {
    await renderAt("/products/abc-123/edit");
    expect(await screen.findByText("ADMIN-PRODUCT-EDIT-FORM")).toBeTruthy();
    expect(screen.queryByText("PUBLIC-PRODUCT-DETAIL")).toBeNull();
  });

  it("/products/:id still shows the public product page", async () => {
    await renderAt("/products/abc-123");
    expect(await screen.findByText("PUBLIC-PRODUCT-DETAIL")).toBeTruthy();
  });
});
