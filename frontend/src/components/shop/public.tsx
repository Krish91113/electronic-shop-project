import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Headphones,
  PackageCheck,
  Sparkles,
  ArrowUpRight,
  LockKeyhole,
  Eye,
  EyeOff,
  Package,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brand, SearchInput, EmptyState, Field } from "./shared";
import { money } from "./data";
import { publicApi, getErrorMessage, type PublicProduct } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import hero from "@/assets/catalogue-hero.jpg";

// ─── Public slug config ──────────────────────────────────────────────────────
// Override via VITE_PUBLIC_SHOP_SLUG env var; falls back to seed-data slug.
const PUBLIC_SHOP_SLUG =
  (import.meta.env["VITE_PUBLIC_SHOP_SLUG"] as string | undefined) ?? "electronics-hub-main";

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function PublicHeader() {
  return (
    <header className="public-header">
      <Link to="/" aria-label="Volt home">
        <Brand />
      </Link>
      <nav>
        <Link to="/">Our catalogue</Link>
        <Link to="/" hash="products">
          Categories
        </Link>
      </nav>
      <Button asChild variant="outline" size="sm">
        <Link to="/login">
          <LockKeyhole size={14} />
          Owner portal
          <ArrowUpRight size={14} />
        </Link>
      </Button>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <Brand />
      <span>A little technology. A lot of possibilities.</span>
      <span>© 2026 Volt Electronics</span>
    </footer>
  );
}

// ─── ProductImage for public products ─────────────────────────────────────────

function PublicProductImage({ product }: { product: PublicProduct }) {
  const primary = product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
  if (primary) {
    return <img src={primary.url} alt={product.name} loading="lazy" width={512} height={512} />;
  }
  return (
    <div className="image-placeholder">
      <Package size={48} />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProductGridSkeleton() {
  return (
    <div className="product-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="product-card animate-pulse">
          <div className="product-card-image bg-muted" style={{ minHeight: 200 }} />
          <div className="product-card-body">
            <div className="h-3 bg-muted rounded w-1/2 mb-2" />
            <div className="h-4 bg-muted rounded w-3/4 mb-3" />
            <div className="h-4 bg-muted rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

export function Catalogue() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All products");
  const [sort, setSort] = useState("Featured");

  // Fetch from the public API (no sample fallback — real catalogue only)
  const {
    data: apiData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["public-products", PUBLIC_SHOP_SLUG],
    queryFn: () => publicApi.listProducts(PUBLIC_SHOP_SLUG, { limit: 100 }),
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  interface NormalizedProduct {
    id: string;
    name: string;
    brand: string;
    model: string;
    category: string;
    price: number;
    inStock: boolean;
    _raw: PublicProduct;
  }

  const normalized: NormalizedProduct[] = (apiData?.products ?? [])
    .filter((p) => p.isPublished)
    .map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand ?? "",
      model: p.model ?? "",
      category: p.category ?? "General",
      price: p.defaultSellingPrice ?? 0,
      inStock: p.inStock,
      _raw: p,
    }));

  // Derive category list dynamically
  const categories = [
    "All products",
    ...Array.from(new Set(normalized.map((p) => p.category))).sort(),
  ];

  let items = normalized.filter(
    (p) =>
      (category === "All products" || p.category === category) &&
      (p.name + " " + p.brand + " " + p.model).toLowerCase().includes(search.toLowerCase()),
  );

  if (sort === "Price: low to high") items = [...items].sort((a, b) => a.price - b.price);
  if (sort === "Price: high to low") items = [...items].sort((a, b) => b.price - a.price);

  function StockLabel({ inStock }: { inStock: boolean }) {
    return inStock ? (
      <span className="status status-success">
        <span />
        In stock
      </span>
    ) : (
      <span className="status status-danger">
        <span />
        Out of stock
      </span>
    );
  }

  return (
    <div className="public-layout">
      <PublicHeader />
      <main className="public-content">
        <section className="catalogue-hero">
          <img
            src={hero}
            alt="Wireless headphones, a portable speaker and a compact keyboard"
            width={1536}
            height={768}
          />
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={13} />
              YOUR EVERYDAY TECH, UPGRADED
            </div>
            <h1>
              Electronics,
              <br />
              made easy to find.
            </h1>
            <p>
              Good tech for work, play, and everything in between. Find your next everyday
              essential.
            </p>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="What are you looking for?"
            />
          </div>
        </section>

        <div className="trust-row">
          <span>
            <ShieldCheck size={17} />
            Quality you can count on
          </span>
          <span>
            <Headphones size={17} />A little expert guidance
          </span>
          <span>
            <PackageCheck size={17} />
            Explore online. Find in store.
          </span>
        </div>

        <section id="products" className="catalogue-section">
          <div className="page-header">
            <div>
              <h2>Discover your next essential</h2>
              <p>Thoughtfully selected. Ready for your everyday.</p>
            </div>
            <span className="count-label">
              {isLoading ? "…" : isError ? "" : `${items.length} products`}
            </span>
          </div>

          <div className="catalogue-toolbar">
            <div className="filter-chips">
              {categories.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={c === category ? "selected" : "chip"}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
            <select
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option>Featured</option>
              <option>Price: low to high</option>
              <option>Price: high to low</option>
            </select>
          </div>

          {isLoading ? (
            <ProductGridSkeleton />
          ) : isError ? (
            <div className="empty-state">
              <AlertCircle size={34} />
              <h3>We couldn't load the catalogue</h3>
              <p>Please check your connection and try again.</p>
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : items.length ? (
            <div className="product-grid">
              {items.map((p) => (
                <Link key={p.id} to="/products/$id" params={{ id: p.id }} className="product-card">
                  <div className="product-card-image">
                    <PublicProductImage product={p._raw} />
                    <span className="category-label">
                      {p.category === "Computer Peripherals" ? "Peripherals" : p.category}
                    </span>
                  </div>
                  <div className="product-card-body">
                    <div className="product-brand">
                      {p.brand} · {p.model}
                    </div>
                    <h3>{p.name}</h3>
                    <div className="product-card-bottom">
                      <strong>{money(p.price)}</strong>
                      <StockLabel inStock={p.inStock} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>

        <PublicFooter />
      </main>
    </div>
  );
}

// ─── ProductDetail ────────────────────────────────────────────────────────────

export function ProductDetail() {
  const { id } = useParams({ strict: false });

  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-product", PUBLIC_SHOP_SLUG, id],
    queryFn: () => publicApi.getProduct(PUBLIC_SHOP_SLUG, id!),
    enabled: !!id,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="public-layout">
      <PublicHeader />
      <main className="public-content">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} />
          Back to catalogue
        </Link>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : product ? (
          <div className="detail-layout">
            <div className="detail-image">
              <PublicProductImage product={product} />
            </div>
            <div className="detail-copy">
              <span className="sample-caption">
                {[product.category, product.brand].filter(Boolean).join(" · ")}
              </span>
              <h1>{product.name}</h1>
              {product.model && (
                <p>
                  {product.brand} · {product.model}
                </p>
              )}
              {product.inStock ? (
                <span className="status status-success">
                  <span />
                  In stock
                </span>
              ) : (
                <span className="status status-danger">
                  <span />
                  Out of stock
                </span>
              )}
              {product.defaultSellingPrice !== undefined && (
                <strong className="price">{money(product.defaultSellingPrice)}</strong>
              )}
              {product.description && <p>{product.description}</p>}
              {product.warranty && (
                <div className="detail-spec">
                  <span>Warranty</span>
                  <strong>{product.warranty}</strong>
                </div>
              )}
              {product.model && (
                <div className="detail-spec">
                  <span>Model</span>
                  <strong>{product.model}</strong>
                </div>
              )}
              <div className="hint">Available to explore in store. No online checkout.</div>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/">
                  Browse more products
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            title={isError ? "We couldn't load this product" : "Product not available"}
            detail="This product may be inactive or no longer in the catalogue."
          />
        )}

        <PublicFooter />
      </main>
    </div>
  );
}

// ─── LoginPage (connected to real auth) ──────────────────────────────────────

export function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Show a spinner while session is loading (to avoid flash)
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      await login(email, password);
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-intro">
        <Link to="/">
          <Brand dark />
        </Link>
        <h1>
          Electronics Shop
          <br />
          Management.
        </h1>
        <p>A clearer view of your shop. Products, inventory and billing, all in one place.</p>
        <img
          className="login-image"
          src={hero}
          alt="Everyday electronics"
          width={1536}
          height={768}
        />
      </div>

      <div className="login-card">
        <span className="text-primary">
          <LockKeyhole size={25} />
        </span>
        <h2 className="mt-5">Welcome back</h2>
        <p>Your shop, ready for the day.</p>

        <form onSubmit={handleSubmit}>
          <Field label="Email">
            <Input
              name="username"
              type="email"
              required
              placeholder="owner@example.com"
              autoComplete="username"
              disabled={submitting}
            />
          </Field>
          <Field label="Password">
            <div className="password-field">
              <Input
                name="password"
                type={show ? "text" : "password"}
                required
                minLength={6}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={submitting}
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
                disabled={submitting}
              >
                {show ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </Field>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full mt-6" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight />
              </>
            )}
          </Button>
        </form>

        <div className="login-note">For authorized shop owners only.</div>
      </div>
    </div>
  );
}
