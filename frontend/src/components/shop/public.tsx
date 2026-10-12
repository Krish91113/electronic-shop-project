import { useState, useEffect, useMemo, useCallback, type ReactNode, type FormEvent } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Headphones,
  PackageCheck,
  LockKeyhole,
  Eye,
  EyeOff,
  Package,
  Loader2,
  AlertCircle,
  Menu,
  X,
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageCircle,
  ChevronRight,
  Search,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Linkedin,
  Store,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brand, SearchInput, EmptyState, Field } from "./shared";
import { money } from "./data";
import { STORE_NAME } from "@/lib/constants";
import { publicApi, getErrorMessage, type PublicProduct, type PublicShop } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import hero from "@/assets/catalogue-hero.jpg";

// ─── Configurable store details ──────────────────────────────────────────────
function env(key: string): string {
  const value = (import.meta.env as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

const STORE = {
  name: env("VITE_STORE_NAME") || STORE_NAME,
  announcement: env("VITE_STORE_ANNOUNCEMENT") || "Live in-store inventory · Genuine warranty",
  phone: env("VITE_STORE_PHONE"),
  whatsapp: env("VITE_STORE_WHATSAPP").replace(/[^\d]/g, ""),
  email: env("VITE_STORE_EMAIL"),
  address: env("VITE_STORE_ADDRESS"),
  hours: env("VITE_STORE_HOURS"),
  mapsUrl: env("VITE_STORE_MAPS_URL"),
};

const HAS_STORE_DETAILS = Boolean(
  STORE.phone || STORE.whatsapp || STORE.email || STORE.address || STORE.hours || STORE.mapsUrl,
);

const DEVELOPER = {
  name: "Krish",
  agency: "Netbro",
  krishUrl: env("VITE_DEVELOPER_KRISH_URL"),
  netbroUrl: env("VITE_DEVELOPER_NETBRO_URL"),
};

const SOCIAL_LINKS = [
  { label: "Instagram", url: env("VITE_SOCIAL_INSTAGRAM"), Icon: Instagram },
  { label: "Facebook", url: env("VITE_SOCIAL_FACEBOOK"), Icon: Facebook },
  { label: "X", url: env("VITE_SOCIAL_X"), Icon: Twitter },
  { label: "YouTube", url: env("VITE_SOCIAL_YOUTUBE"), Icon: Youtube },
  { label: "LinkedIn", url: env("VITE_SOCIAL_LINKEDIN"), Icon: Linkedin },
].filter((s) => s.url);

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

const HIDE_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const CONTAINER = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10";
const GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function optimizeImage(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (/\/upload\/[^/]*(f_auto|q_auto|w_\d+)/.test(url)) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

function shortCategory(category: string) {
  return category === "Computer Peripherals" ? "Peripherals" : category;
}

// ─── Shared UI Elements ──────────────────────────────────────────────────────

export function StockLabel({ inStock }: { inStock: boolean }) {
  return inStock ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      In stock
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
      Out of stock
    </span>
  );
}

export function PriceLabel({
  price,
  className = "",
}: {
  price: number | null;
  className?: string;
}) {
  return price === null ? (
    <span className={`text-sm font-medium text-muted-foreground ${className}`}>Ask in store</span>
  ) : (
    <strong className={`font-semibold tracking-tight text-foreground ${className}`}>
      {money(price)}
    </strong>
  );
}

export function SectionHeading({
  id,
  title,
  description,
  aside,
}: {
  id?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {aside}
    </div>
  );
}

export function ErrorPanel({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-emerald-950/20 bg-white px-6 py-14 text-center shadow-sm"
    >
      <AlertCircle size={34} className="text-rose-600" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">Please check your connection and try again.</p>
      {onRetry && (
        <Button variant="outline" className="mt-3 rounded-full" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function PublicProductImage({
  product,
  imageUrl,
  width = 600,
  eager = false,
}: {
  product: PublicProduct;
  imageUrl?: string | undefined;
  width?: number;
  eager?: boolean;
}) {
  const primary = product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
  const source = imageUrl ?? primary?.url;

  const [useOriginal, setUseOriginal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUseOriginal(false);
    setLoaded(false);
    setFailed(false);
  }, [source]);

  if (!source || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-emerald-50/70 text-emerald-900/30">
        <Package size={44} aria-hidden="true" />
        <span className="sr-only">No image available</span>
      </div>
    );
  }

  const src = useOriginal ? source : optimizeImage(source, width);

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-emerald-50/80 motion-reduce:animate-none" />
      )}
      <img
        src={src}
        alt={product.name}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={512}
        height={512}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!useOriginal && src !== source) setUseOriginal(true);
          else setFailed(true);
        }}
        className={`h-full w-full object-contain p-3 motion-safe:transition-opacity motion-safe:duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID_CLASS} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white motion-safe:animate-pulse"
        >
          <div className="aspect-square bg-emerald-50/80" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/2 rounded bg-emerald-50" />
            <div className="h-4 w-3/4 rounded bg-emerald-50" />
            <div className="h-4 w-1/3 rounded bg-emerald-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PublicHeader({
  search,
  onSearch,
  shopSlug,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  shopSlug?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasSearch = typeof search === "string" && typeof onSearch === "function";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    setOpen(false);
    scrollToId("products");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className={`${CONTAINER} flex h-16 items-center gap-4 lg:gap-8`}>
        <Link to="/" aria-label="Time Centre home" className={`shrink-0 rounded-md ${FOCUS_RING}`}>
          <Brand />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-2 md:flex">
          <Link
            to="/"
            className={`rounded-full px-3 py-1.5 text-sm font-medium text-emerald-950/70 hover:bg-emerald-50 hover:text-emerald-900 motion-safe:transition-colors ${FOCUS_RING}`}
          >
            All Shops
          </Link>
          {shopSlug && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <Store size={13} />
              Current Shop
            </span>
          )}
        </nav>

        {hasSearch && (
          <form
            role="search"
            onSubmit={submitSearch}
            className="ml-auto hidden max-w-sm flex-1 lg:block"
          >
            <label htmlFor="header-search" className="sr-only">
              Search products
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="header-search"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search products, brands, models"
                className="h-9 rounded-full bg-emerald-50/60 pl-9"
              />
            </div>
          </form>
        )}

        {/* <div className="ml-auto flex items-center gap-2">
          <Link
            to="/login"
            className={`hidden sm:inline-flex text-xs font-medium text-emerald-900/70 hover:text-emerald-900 px-3 py-1.5 rounded-full hover:bg-emerald-50 ${FOCUS_RING}`}
          >
            Staff Login
          </Link>
          <button
            type="button"
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-emerald-950 hover:bg-emerald-50 md:hidden ${FOCUS_RING}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div> */}
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-emerald-950/10 bg-white md:hidden">
          <div className={`${CONTAINER} flex flex-col gap-1 py-4`}>
            {hasSearch && (
              <form role="search" onSubmit={submitSearch} className="mb-3">
                <label htmlFor="mobile-search" className="sr-only">
                  Search products
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="mobile-search"
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                    placeholder="Search products, brands, models"
                    className="rounded-full pl-9"
                  />
                </div>
              </form>
            )}
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between rounded-xl px-3 py-3 text-base font-medium text-emerald-950 hover:bg-emerald-50 ${FOCUS_RING}`}
            >
              All Shops / Locations
              <ChevronRight size={16} className="text-muted-foreground" />
            </Link>
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between rounded-xl px-3 py-3 text-base font-medium text-emerald-950 hover:bg-emerald-50 ${FOCUS_RING}`}
            >
              Staff Login
              <ChevronRight size={16} className="text-muted-foreground" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative mt-20 overflow-hidden bg-[#08080d] text-emerald-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(60%_120%_at_50%_0%,rgba(16,185,129,0.16),transparent_70%)]"
      />
      <div className={`${CONTAINER} relative`}>
        <div className="grid gap-x-8 gap-y-12 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:py-16">
          <div className="sm:col-span-2 lg:col-span-6">
            <Brand dark />
            <p className="mt-5 text-sm font-semibold text-white">{STORE_NAME}</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-emerald-50/60">
              Two independent branches bringing you genuine mobile phones, electronics, expert
              in-store guidance, and verified warranty service.
            </p>
          </div>
          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white">Shops</h3>
            <ul className="mt-4 space-y-2 text-sm text-emerald-50/70">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Shop 1 &amp; Shop 2 Directory
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Staff Portal
                </Link>
              </li>
            </ul>
          </div>
          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
              Services
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-emerald-50/70">
              <li>Mobile Phones &amp; Accessories</li>
              <li>Computer Peripherals &amp; Audio</li>
              <li>In-Store Billing &amp; Invoicing</li>
              <li>Authorised Warranty Support</li>
            </ul>
          </div>
        </div>

        <div className="h-px w-full bg-white/10" aria-hidden="true" />

        <div className="flex flex-col items-center gap-2.5 py-6 text-center text-xs text-emerald-50/50 sm:flex-row sm:justify-between sm:text-left">
          <span>
            © {year} {STORE_NAME}. All rights reserved.
          </span>
          <span>
            Designed &amp; Developed by {DEVELOPER.name} | {DEVELOPER.agency}
          </span>
        </div>
      </div>
    </footer>
  );
}

// ─── Product Card ────────────────────────────────────────────────────────────

interface CatalogueItem {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  price: number | null;
  inStock: boolean;
  raw: PublicProduct;
}

export function ProductCard({ item, shopSlug }: { item: CatalogueItem; shopSlug: string }) {
  const meta = [item.brand, item.model].filter(Boolean).join(" · ");
  const productSlug = item.raw.slug || item.id;

  return (
    <Link
      to="/shop/$shopSlug/products/$productSlug"
      params={{ shopSlug, productSlug }}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-[0_1px_2px_rgba(6,20,15,0.04)] motion-safe:transition motion-safe:duration-200 hover:border-emerald-600/30 hover:shadow-[0_12px_32px_-12px_rgba(6,78,59,0.25)] motion-safe:hover:-translate-y-0.5 ${FOCUS_RING}`}
    >
      <div className="relative aspect-square overflow-hidden bg-white">
        <PublicProductImage product={item.raw} width={500} />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-emerald-50/95 px-2.5 py-0.5 text-[11px] font-medium text-emerald-900 ring-1 ring-emerald-900/10">
          {shortCategory(item.category)}
        </span>
        {!item.inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-white/85 py-1 text-center text-xs font-medium text-rose-700 backdrop-blur-sm">
            Currently out of stock
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5 sm:p-4">
        {meta && <div className="truncate text-xs text-muted-foreground">{meta}</div>}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-foreground sm:text-[15px]">
          {item.name}
        </h3>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <PriceLabel price={item.price} className="text-base sm:text-lg" />
          <StockLabel inStock={item.inStock} />
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-800 group-hover:text-emerald-950">
          View details
          <ArrowRight
            size={14}
            className="motion-safe:transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}

// ─── 1. Shop Chooser Landing Page ("/") ───────────────────────────────────────

export function ShopChooser() {
  const {
    data: shops,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["public-shops"],
    queryFn: () => publicApi.listShops(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f6faf8] text-foreground">
      {STORE.announcement && (
        <div className="bg-[#06140f] px-4 py-2 text-center text-xs text-emerald-50/90 sm:text-sm">
          {STORE.announcement}
        </div>
      )}

      <PublicHeader />

      <main>
        {/* Hero Section */}
        <section aria-labelledby="hero-heading" className="relative overflow-hidden bg-[#06140f]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className={`${CONTAINER} relative grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-24`}
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                <Sparkles size={14} />
                Independent Branch System
              </div>
              <h1
                id="hero-heading"
                className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
              >
                Time Centre
                <br />
                <span className="text-emerald-400">Mobile &amp; Electronics</span>
              </h1>
              <p className="mt-5 max-w-lg text-base text-emerald-50/80 sm:text-lg">
                Choose a store to check live in-stock mobile phones, electronics, accessories, and
                warranty details before you visit.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                  onClick={() => scrollToId("branches")}
                >
                  Select a store
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/25 bg-transparent text-white hover:bg-white/10"
                  onClick={() => scrollToId("features")}
                >
                  Our services
                </Button>
              </div>
            </div>

            <div>
              <div className="overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-2xl shadow-black/40">
                <img
                  src={hero}
                  alt="Time Centre Mobile & Electronics display"
                  width={1536}
                  height={768}
                  decoding="async"
                  className="aspect-[2/1] h-auto w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Shop Cards Chooser */}
        <section
          id="branches"
          aria-labelledby="branches-heading"
          className={`${CONTAINER} py-14 sm:py-20`}
        >
          <SectionHeading
            id="branches-heading"
            title="Select Your Branch"
            description="Our two locations operate independently with dedicated inventory. Pick a shop to explore live stock."
          />

          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-72 rounded-3xl border border-emerald-950/10 bg-white p-8 animate-pulse"
                >
                  <div className="h-6 w-1/3 rounded bg-emerald-50" />
                  <div className="mt-4 h-4 w-2/3 rounded bg-emerald-50" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-emerald-50" />
                  <div className="mt-12 h-10 w-full rounded-full bg-emerald-50" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <ErrorPanel title="Unable to load shops right now" onRetry={() => refetch()} />
          ) : !shops || shops.length === 0 ? (
            <EmptyState
              title="No shops currently available"
              detail="Please check back shortly or contact our main desk."
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
              {shops.map((shop) => (
                <div
                  key={shop.slug}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-950/10 bg-white p-7 sm:p-9 shadow-sm transition-all duration-300 hover:border-emerald-500/40 hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="absolute right-0 top-0 -mr-12 -mt-12 h-36 w-36 rounded-full bg-emerald-500/5 transition-transform group-hover:scale-125" />

                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-900/10">
                        <Store size={24} />
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        {shop.inStockCount} {shop.inStockCount === 1 ? "product" : "products"} in
                        stock
                      </span>
                    </div>

                    <h3 className="mt-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {shop.name}
                    </h3>

                    <div className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                      {shop.address && (
                        <p className="flex items-start gap-2.5">
                          <MapPin size={17} className="mt-0.5 shrink-0 text-emerald-700" />
                          <span>{shop.address}</span>
                        </p>
                      )}
                      {shop.contactPhone && (
                        <p className="flex items-center gap-2.5">
                          <Phone size={17} className="shrink-0 text-emerald-700" />
                          <a
                            href={`tel:${shop.contactPhone.replace(/\s/g, "")}`}
                            className="font-medium hover:text-foreground hover:underline"
                          >
                            {shop.contactPhone}
                          </a>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-emerald-950/5">
                    <Button
                      asChild
                      size="lg"
                      className="w-full rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-md transition-all group-hover:bg-emerald-600"
                    >
                      <Link to="/shop/$shopSlug" params={{ shopSlug: shop.slug }}>
                        Browse this shop
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Features / Why Time Centre */}
        <section id="features" aria-labelledby="features-heading" className={`${CONTAINER} pb-16`}>
          <div className="rounded-3xl bg-emerald-950/5 p-8 sm:p-12 border border-emerald-950/10">
            <h2
              id="features-heading"
              className="text-2xl font-semibold text-foreground text-center sm:text-3xl"
            >
              Why Shop at Time Centre Mobile &amp; Electronics
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-emerald-950/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">Authorised Warranty</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Official brand warranties, serial number tracking on every bill, and trustworthy
                  service.
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-emerald-950/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <PackageCheck size={20} />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">Verified In-Stock Status</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Our website reflects live shop inventory so you never waste a trip to the store.
                </p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm border border-emerald-950/5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Headphones size={20} />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">Expert In-Person Help</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Visit either branch for transparent advice on smartphones, tablets, laptops, and
                  accessories.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

// ─── 2. Shop Catalogue Page ("/shop/$shopSlug") ──────────────────────────────

const ALL = "All products";
type SortOption = "Featured" | "Price: low to high" | "Price: high to low";

export function ShopCatalogue() {
  const { shopSlug } = useParams({ strict: false }) as { shopSlug: string };
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [inStockOnly, setInStockOnly] = useState(true); // Default ON per requirements
  const [sort, setSort] = useState<SortOption>("Featured");
  const [page, setPage] = useState(1);

  // Shop details
  const {
    data: currentShop,
    isLoading: shopLoading,
    isError: shopError,
    refetch: refetchShop,
  } = useQuery({
    queryKey: ["public-shop", shopSlug],
    queryFn: () => publicApi.getShop(shopSlug),
    enabled: Boolean(shopSlug),
    staleTime: 5 * 60 * 1000,
  });

  // All shops for the switcher
  const { data: allShops } = useQuery({
    queryKey: ["public-shops"],
    queryFn: () => publicApi.listShops(),
    staleTime: 5 * 60 * 1000,
  });

  const otherShops = useMemo(
    () => (allShops ?? []).filter((s) => s.slug !== shopSlug),
    [allShops, shopSlug],
  );

  // Products query with server filtering
  const {
    data: productsData,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["public-products", shopSlug, search, category, inStockOnly, page],
    queryFn: () =>
      publicApi.listProducts(shopSlug, {
        search: search.trim() || undefined,
        category: category !== ALL ? category : undefined,
        inStock: inStockOnly ? true : undefined,
        page,
        limit: 24,
      }),
    enabled: Boolean(shopSlug),
    staleTime: 2 * 60 * 1000,
  });

  // Normalized catalogue items for rendering
  const items = useMemo<CatalogueItem[]>(() => {
    let list = (productsData?.products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand ?? "",
      model: p.model ?? "",
      category: p.category ?? "General",
      price: typeof p.defaultSellingPrice === "number" ? p.defaultSellingPrice : null,
      inStock: p.inStock,
      raw: p,
    }));

    if (sort === "Price: low to high") {
      list = [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (sort === "Price: high to low") {
      list = [...list].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    }
    return list;
  }, [productsData, sort]);

  // Dynamic category list from items
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of productsData?.products ?? []) {
      if (p.category) set.add(p.category);
    }
    return [ALL, ...Array.from(set).sort()];
  }, [productsData]);

  const pagination = productsData?.pagination;
  const hasFilters = search.trim() !== "" || category !== ALL || !inStockOnly;

  const clearFilters = useCallback(() => {
    setSearch("");
    setCategory(ALL);
    setInStockOnly(true);
    setPage(1);
  }, []);

  if (shopError) {
    return (
      <div className="min-h-screen bg-[#f6faf8]">
        <PublicHeader />
        <main className={`${CONTAINER} py-16`}>
          <ErrorPanel
            title="Shop not found or currently unavailable"
            onRetry={() => refetchShop()}
          />
          <div className="mt-6 text-center">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Shops
              </Link>
            </Button>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f6faf8] text-foreground">
      <PublicHeader search={search} onSearch={setSearch} shopSlug={shopSlug} />

      <main>
        {/* Top Shop Banner & Switcher */}
        <section className="border-b border-emerald-950/10 bg-white py-6 shadow-sm">
          <div
            className={`${CONTAINER} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}
          >
            <div>
              <div className="flex items-center gap-2">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-950 hover:underline"
                >
                  <ArrowLeft size={13} />
                  All Shops
                </Link>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-xs font-semibold text-emerald-950 uppercase tracking-wider">
                  Live Catalogue
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {currentShop?.name ?? (shopLoading ? "Loading shop…" : shopSlug)}
              </h1>
              {currentShop && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {currentShop.address && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={15} className="text-emerald-700" />
                      {currentShop.address}
                    </span>
                  )}
                  {currentShop.contactPhone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={15} className="text-emerald-700" />
                      <a
                        href={`tel:${currentShop.contactPhone.replace(/\s/g, "")}`}
                        className="hover:underline"
                      >
                        {currentShop.contactPhone}
                      </a>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Switcher to other shop */}
            {otherShops.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-emerald-50/70 p-2.5 border border-emerald-900/10">
                <span className="text-xs font-medium text-emerald-900">Other branch:</span>
                {otherShops.map((other) => (
                  <Button
                    key={other.slug}
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-full bg-white hover:bg-emerald-50 border-emerald-300 text-xs font-semibold"
                  >
                    <Link to="/shop/$shopSlug" params={{ shopSlug: other.slug }}>
                      Switch to {other.name}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Main Catalogue Area */}
        <section id="products" className={`${CONTAINER} py-8 sm:py-12`}>
          {/* Controls: Category chips, In-Stock toggle, Sort dropdown */}
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Category chips */}
              <div
                role="group"
                aria-label="Filter by category"
                className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 ${HIDE_SCROLLBAR}`}
              >
                {categories.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    className="shrink-0 rounded-full text-xs font-medium"
                    variant={c === category ? "default" : "outline"}
                    aria-pressed={c === category}
                    onClick={() => {
                      setCategory(c);
                      setPage(1);
                    }}
                  >
                    {c}
                  </Button>
                ))}
              </div>

              {/* In-Stock Toggle & Sort */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-full border border-emerald-950/15 bg-white px-3.5 py-1.5 text-xs font-medium cursor-pointer hover:bg-emerald-50/50">
                  <Switch
                    checked={inStockOnly}
                    onCheckedChange={(checked) => {
                      setInStockOnly(checked);
                      setPage(1);
                    }}
                  />
                  <span>In stock only</span>
                </label>

                <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                  <SelectTrigger
                    aria-label="Sort products"
                    className={`h-9 w-[180px] shrink-0 rounded-full border-emerald-950/15 bg-white px-3 text-xs ${FOCUS_RING}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="Featured">Featured</SelectItem>
                    <SelectItem value="Price: low to high">Price: low to high</SelectItem>
                    <SelectItem value="Price: high to low">Price: high to low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          {productsLoading ? (
            <ProductGridSkeleton count={8} />
          ) : productsError ? (
            <ErrorPanel
              title="We couldn't load products for this shop"
              onRetry={() => refetchProducts()}
            />
          ) : items.length > 0 ? (
            <>
              <div className={GRID_CLASS}>
                {items.map((p) => (
                  <ProductCard key={p.id} item={p} shopSlug={shopSlug} />
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-12 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={!pagination.hasPrev}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-xs font-medium text-muted-foreground px-3">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={!pagination.hasNext}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 rounded-3xl border border-dashed border-emerald-950/15 bg-white p-12 text-center">
              <Package size={40} className="mx-auto text-muted-foreground/40" />
              <h3 className="text-lg font-semibold text-foreground">
                {inStockOnly
                  ? "No products in stock in this shop right now"
                  : "No products match your criteria"}
              </h3>
              <p className="max-w-md mx-auto text-sm text-muted-foreground">
                {inStockOnly
                  ? "Check back soon, or turn off 'In stock only' to view the complete catalog."
                  : "Try clearing your search or category filters to find what you're looking for."}
              </p>
              {hasFilters && (
                <div className="pt-2">
                  <Button variant="outline" className="rounded-full" onClick={clearFilters}>
                    Clear search and filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

// ─── 3. Product Detail Page ("/shop/$shopSlug/products/$productSlug") ─────────

function extractSpecs(product: PublicProduct): { label: string; value: string }[] {
  const raw = (product as unknown as { specifications?: unknown }).specifications;
  const out: { label: string; value: string }[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        const label = e["name"] ?? e["key"] ?? e["label"];
        const value = e["value"];
        if (typeof label === "string" && (typeof value === "string" || typeof value === "number")) {
          out.push({ label, value: String(value) });
        }
      }
    }
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number") out.push({ label: k, value: String(v) });
    }
  }
  return out.slice(0, 12);
}

function DetailGallery({ product }: { product: PublicProduct }) {
  const images = product.images ?? [];
  const primaryIndex = Math.max(
    0,
    images.findIndex((i) => i.isPrimary),
  );
  const [active, setActive] = useState(primaryIndex);
  const current = images[active]?.url;

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-emerald-950/10 bg-white">
        <PublicProductImage product={product} imageUrl={current} width={1000} eager />
      </div>
      {images.length > 1 && (
        <ul className={`mt-3 flex gap-2 overflow-x-auto pb-1 ${HIDE_SCROLLBAR}`}>
          {images.map((img, i) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === active}
                className={`relative block h-16 w-16 overflow-hidden rounded-xl border bg-white sm:h-20 sm:w-20 ${
                  i === active
                    ? "border-emerald-600 ring-1 ring-emerald-600"
                    : "border-emerald-950/10"
                } ${FOCUS_RING}`}
              >
                <PublicProductImage product={product} imageUrl={img.url} width={160} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProductDetail() {
  const params = useParams({ strict: false }) as {
    shopSlug?: string;
    productSlug?: string;
    id?: string;
  };
  const shopSlug = params.shopSlug ?? "shop1";
  const productSlug = params.productSlug ?? params.id ?? "";

  const { data: shop } = useQuery({
    queryKey: ["public-shop", shopSlug],
    queryFn: () => publicApi.getShop(shopSlug),
    enabled: Boolean(shopSlug),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["public-product", shopSlug, productSlug],
    queryFn: () => publicApi.getProduct(shopSlug, productSlug),
    enabled: Boolean(shopSlug && productSlug),
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const specs = useMemo(() => {
    if (!product) return [];
    const rows: { label: string; value: string }[] = [];
    if (product.brand) rows.push({ label: "Brand", value: product.brand });
    if (product.model) rows.push({ label: "Model", value: product.model });
    if (product.category) rows.push({ label: "Category", value: product.category });
    if (product.warranty) rows.push({ label: "Warranty", value: product.warranty });
    const known = new Set(rows.map((r) => r.label.toLowerCase()));
    for (const s of extractSpecs(product)) {
      if (!known.has(s.label.toLowerCase())) rows.push(s);
    }
    return rows;
  }, [product]);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f6faf8] text-foreground">
      <PublicHeader shopSlug={shopSlug} />

      <main className={`${CONTAINER} py-6 sm:py-10`}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link to="/" className={`rounded hover:text-foreground ${FOCUS_RING}`}>
                All Shops
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                to="/shop/$shopSlug"
                params={{ shopSlug }}
                className={`rounded hover:text-foreground ${FOCUS_RING}`}
              >
                {shop?.name ?? shopSlug}
              </Link>
            </li>
            {product?.category && (
              <>
                <li aria-hidden="true">/</li>
                <li className="text-foreground/80">{product.category}</li>
              </>
            )}
            <li aria-hidden="true">/</li>
            <li className="font-medium text-foreground truncate max-w-xs">
              {product?.name ?? "Product"}
            </li>
          </ol>
        </nav>

        {isLoading ? (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square rounded-3xl bg-emerald-50 animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 rounded bg-emerald-50 animate-pulse" />
              <div className="h-5 w-1/3 rounded bg-emerald-50 animate-pulse" />
              <div className="h-10 w-1/4 rounded bg-emerald-50 animate-pulse" />
              <div className="h-28 rounded bg-emerald-50 animate-pulse" />
            </div>
          </div>
        ) : product ? (
          <>
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
              <DetailGallery product={product} />

              <div className="flex flex-col gap-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                    {product.name}
                  </h1>
                  {[product.brand, product.model].filter(Boolean).length > 0 && (
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      {[product.brand, product.model].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <PriceLabel
                    price={
                      typeof product.defaultSellingPrice === "number"
                        ? product.defaultSellingPrice
                        : null
                    }
                    className="text-3xl"
                  />
                  <StockLabel inStock={product.inStock} />
                </div>

                {product.description && (
                  <p className="max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">
                    {product.description}
                  </p>
                )}

                {specs.length > 0 && (
                  <dl className="divide-y divide-emerald-950/10 overflow-hidden rounded-2xl border border-emerald-950/10 bg-white">
                    {specs.map((s) => (
                      <div
                        key={s.label}
                        className="grid grid-cols-[130px_1fr] gap-3 px-4 py-3 text-sm sm:grid-cols-[160px_1fr]"
                      >
                        <dt className="text-muted-foreground">{s.label}</dt>
                        <dd className="font-medium">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {/* In-Store Availability Card */}
                <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/80 p-5 text-sm text-emerald-950">
                  <p className="font-semibold text-base flex items-center gap-2">
                    <Store size={18} className="text-emerald-700" />
                    Available at {shop?.name ?? "this store"}
                  </p>
                  <p className="mt-1 text-emerald-950/75 text-xs">
                    In-store purchase and inspection only. Please visit our store location:
                  </p>
                  {shop?.address && (
                    <p className="mt-3 flex items-start gap-2 text-emerald-950/80 text-sm">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-700" />
                      <span>{shop.address}</span>
                    </p>
                  )}
                  {shop?.contactPhone && (
                    <p className="mt-2 flex items-center gap-2 text-emerald-950/80 text-sm">
                      <Phone size={16} className="shrink-0 text-emerald-700" />
                      <a
                        href={`tel:${shop.contactPhone.replace(/\s/g, "")}`}
                        className="hover:underline font-medium"
                      >
                        {shop.contactPhone}
                      </a>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/shop/$shopSlug" params={{ shopSlug }}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to {shop?.name ?? "shop"} catalogue
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : isError ? (
          <ErrorPanel title="We couldn't load this product" onRetry={() => refetch()} />
        ) : (
          <EmptyState
            title="Product not available"
            detail="This product may be inactive or no longer in the catalogue."
          />
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

// Export ShopChooser as Catalogue for backward compatibility
export const Catalogue = ShopChooser;

// ─── LoginPage (connected to real auth) ───────────────────────────────────────

export function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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
          {STORE_NAME}
          <br />
          Management Portal.
        </h1>
        <p>Independent shop billing, inventory tracking, and sales analytics.</p>
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
        <p>Sign in to your shop account.</p>

        <form onSubmit={handleSubmit}>
          <Field label="Email">
            <Input
              name="username"
              type="email"
              required
              placeholder="owner@timecentre.com"
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

        <div className="login-note">For authorized shop owners and staff only.</div>
      </div>
    </div>
  );
}
