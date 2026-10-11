// Shared presentation helpers for the shop UI.
// All data now comes from the backend API (see @/lib/api); no sample catalogue lives here.

/**
 * Legacy presentational product shape still referenced by shared UI atoms
 * (StatusBadge/ProductImage). Kept for type-compatibility while screens migrate
 * to the API `Product` type.
 */
export type Product = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  threshold: number;
  barcode: string;
  image: string;
  description: string;
  warranty: string;
  active: boolean;
  visible: boolean;
};

export const money = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const pageHead = (title: string, description: string) => ({
  meta: [
    { title: `${title} · Volt Electronics` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · Volt Electronics` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ],
});
