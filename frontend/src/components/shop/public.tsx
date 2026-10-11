import { useState, useEffect, useMemo, useCallback, type ReactNode, type FormEvent } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Headphones,
  PackageCheck,
  ArrowUpRight,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brand, SearchInput, EmptyState, Field } from "./shared";
import { money } from "./data";
import { publicApi, getErrorMessage, type PublicProduct } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import hero from "@/assets/catalogue-hero.jpg";

// ─── Public slug config ──────────────────────────────────────────────────────
// Override via VITE_PUBLIC_SHOP_SLUG env var; falls back to seed-data slug.
const PUBLIC_SHOP_SLUG =
  (import.meta.env["VITE_PUBLIC_SHOP_SLUG"] as string | undefined) ?? "electronics-hub-main";

// ─── Configurable store details ──────────────────────────────────────────────
// Everything below is optional. Anything left empty is simply not rendered.
// Add to your frontend .env (all optional):
//   VITE_STORE_NAME, VITE_STORE_ANNOUNCEMENT, VITE_STORE_PHONE, VITE_STORE_WHATSAPP,
//   VITE_STORE_EMAIL, VITE_STORE_ADDRESS, VITE_STORE_HOURS, VITE_STORE_MAPS_URL
function env(key: string): string {
  const value = (import.meta.env as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

const STORE = {
  name: env("VITE_STORE_NAME") || "Volt Electronics",
  announcement: env("VITE_STORE_ANNOUNCEMENT") || "Explore online. Find in store.",
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

// ─── Developer credit (optional links) ───────────────────────────────────────
// Add to .env when real destinations exist; otherwise credits render as plain text.
//   VITE_DEVELOPER_KRISH_URL, VITE_DEVELOPER_NETBRO_URL
const DEVELOPER = {
  name: "Krish",
  agency: "Netbro",
  krishUrl: env("VITE_DEVELOPER_KRISH_URL"),
  netbroUrl: env("VITE_DEVELOPER_NETBRO_URL"),
};

// ─── Social profiles (rendered only when configured; no placeholders) ────────
//   VITE_SOCIAL_INSTAGRAM, VITE_SOCIAL_FACEBOOK, VITE_SOCIAL_X,
//   VITE_SOCIAL_YOUTUBE, VITE_SOCIAL_LINKEDIN
const SOCIAL_LINKS = [
  { label: "Instagram", url: env("VITE_SOCIAL_INSTAGRAM"), Icon: Instagram },
  { label: "Facebook", url: env("VITE_SOCIAL_FACEBOOK"), Icon: Facebook },
  { label: "X", url: env("VITE_SOCIAL_X"), Icon: Twitter },
  { label: "YouTube", url: env("VITE_SOCIAL_YOUTUBE"), Icon: Youtube },
  { label: "LinkedIn", url: env("VITE_SOCIAL_LINKEDIN"), Icon: Linkedin },
].filter((s) => s.url);

// ─── Small helpers ───────────────────────────────────────────────────────────

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

const HIDE_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** Adds Cloudinary delivery transforms (auto format/quality, width). Non-Cloudinary URLs pass through. */
function optimizeImage(url: string, width: number): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (/\/upload\/[^/]*(f_auto|q_auto|w_\d+)/.test(url)) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

function shortCategory(category: string) {
  return category === "Computer Peripherals" ? "Peripherals" : category;
}

// ─── Normalized catalogue data (single source for cards, categories, related) ─

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

function useCatalogueProducts() {
  const query = useQuery({
    queryKey: ["public-products", PUBLIC_SHOP_SLUG],
    queryFn: () => publicApi.listProducts(PUBLIC_SHOP_SLUG, { limit: 100 }),
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const items = useMemo<CatalogueItem[]>(
    () =>
      (query.data?.products ?? [])
        .filter((p) => p.isPublished)
        .map((p) => ({
          id: p.id,
          name: p.name,
          brand: p.brand ?? "",
          model: p.model ?? "",
          category: p.category ?? "General",
          price: typeof p.defaultSellingPrice === "number" ? p.defaultSellingPrice : null,
          inStock: p.inStock,
          raw: p,
        })),
    [query.data],
  );

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

function StockLabel({ inStock }: { inStock: boolean }) {
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

function PriceLabel({ price, className = "" }: { price: number | null; className?: string }) {
  return price === null ? (
    <span className={`text-sm font-medium text-muted-foreground ${className}`}>Ask in store</span>
  ) : (
    <strong className={`font-semibold tracking-tight text-foreground ${className}`}>
      {money(price)}
    </strong>
  );
}

function SectionHeading({
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

const CONTAINER = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10";

// ─── Header / Footer ─────────────────────────────────────────────────────────

interface PublicHeaderProps {
  /** When provided, a search box is shown in the header (used on the catalogue page). */
  search?: string;
  onSearch?: (value: string) => void;
}

const NAV_LINKS = [
  { label: "Catalogue", hash: "products" },
  { label: "Categories", hash: "categories" },
  { label: "Visit the store", hash: "store" },
] as const;

export function PublicHeader({ search, onSearch }: PublicHeaderProps = {}) {
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
    <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className={`${CONTAINER} flex h-16 items-center gap-4 lg:gap-8`}>
        <Link to="/" aria-label="Volt home" className={`shrink-0 rounded-md ${FOCUS_RING}`}>
          <Brand />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.hash}
              to="/"
              hash={l.hash}
              className={`rounded-full px-3 py-1.5 text-sm font-medium text-emerald-950/70 hover:bg-emerald-50 hover:text-emerald-900 motion-safe:transition-colors ${FOCUS_RING}`}
            >
              {l.label}
            </Link>
          ))}
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

        <div className={`${hasSearch ? "" : "ml-auto"} hidden items-center md:flex`}>
          <span className="mr-3 hidden h-6 w-px bg-emerald-950/15 lg:block" aria-hidden="true" />
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/login">
              <LockKeyhole size={14} />
              Owner portal
              <ArrowUpRight size={14} />
            </Link>
          </Button>
        </div>

        <button
          type="button"
          className={`ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-emerald-950 hover:bg-emerald-50 md:hidden ${FOCUS_RING}`}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
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
            {NAV_LINKS.map((l) => (
              <Link
                key={l.hash}
                to="/"
                hash={l.hash}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between rounded-xl px-3 py-3 text-base font-medium text-emerald-950 hover:bg-emerald-50 ${FOCUS_RING}`}
              >
                {l.label}
                <ChevronRight size={16} className="text-muted-foreground" />
              </Link>
            ))}
            <Button asChild variant="outline" className="mt-3 rounded-full">
              <Link to="/login" onClick={() => setOpen(false)}>
                <LockKeyhole size={14} />
                Owner portal
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

const FOOTER_LINK_CLASS = `inline-flex rounded text-sm text-emerald-50/60 hover:text-white motion-safe:transition-colors duration-200 ${FOCUS_RING} focus-visible:ring-offset-[#08080d]`;
const FOOTER_CREDIT_CLASS = `rounded underline-offset-4 hover:text-white hover:underline motion-safe:transition-colors duration-200 ${FOCUS_RING} focus-visible:ring-offset-[#08080d]`;

function FooterColumn({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white">{title}</h2>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

function FooterNavLink({ hash, children }: { hash?: string; children: ReactNode }) {
  return (
    <li>
      <Link to="/" {...(hash ? { hash } : {})} className={FOOTER_LINK_CLASS}>
        {children}
      </Link>
    </li>
  );
}

function FooterContactLink({
  href,
  external,
  icon,
  children,
}: {
  href?: string;
  external?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  const content = (
    <>
      <span className="mt-0.5 shrink-0 text-emerald-400/80">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <a
          href={href}
          className={`${FOOTER_LINK_CLASS} items-start gap-2.5`}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {content}
        </a>
      ) : (
        <span className="flex items-start gap-2.5 text-sm text-emerald-50/60">{content}</span>
      )}
    </li>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();

  // Contact options are only listed when actually configured — never placeholders.
  const contactItems: ReactNode[] = [];
  if (STORE.email)
    contactItems.push(
      <FooterContactLink key="email" href={`mailto:${STORE.email}`} icon={<Mail size={15} />}>
        {STORE.email}
      </FooterContactLink>,
    );
  if (STORE.whatsapp)
    contactItems.push(
      <FooterContactLink
        key="whatsapp"
        href={`https://wa.me/${STORE.whatsapp}`}
        external
        icon={<MessageCircle size={15} />}
      >
        WhatsApp
      </FooterContactLink>,
    );
  if (STORE.phone)
    contactItems.push(
      <FooterContactLink
        key="phone"
        href={`tel:${STORE.phone.replace(/\s/g, "")}`}
        icon={<Phone size={15} />}
      >
        {STORE.phone}
      </FooterContactLink>,
    );
  if (STORE.mapsUrl)
    contactItems.push(
      <FooterContactLink key="location" href={STORE.mapsUrl} external icon={<MapPin size={15} />}>
        Store location
      </FooterContactLink>,
    );
  else if (STORE.address)
    contactItems.push(
      <FooterContactLink key="address" icon={<MapPin size={15} />}>
        {STORE.address}
      </FooterContactLink>,
    );

  const hasContact = contactItems.length > 0;

  return (
    <footer className="relative mt-20 overflow-hidden bg-[#08080d] text-emerald-50">
      {/* Ambient emerald glow, fading into the dark background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(60%_120%_at_50%_0%,rgba(16,185,129,0.16),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl motion-reduce:blur-none"
      />

      <div className={`${CONTAINER} relative`}>
        <div className="grid gap-x-8 gap-y-12 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:py-16">
          {/* Brand */}
          <div className={`sm:col-span-2 ${hasContact ? "lg:col-span-5" : "lg:col-span-6"}`}>
            <Brand dark />
            <p className="mt-5 text-sm font-semibold text-white">{STORE.name}</p>
            <div className="mt-3 flex items-stretch gap-3">
              <span
                aria-hidden="true"
                className="w-px shrink-0 rounded-full bg-gradient-to-b from-emerald-400/80 via-emerald-400/30 to-transparent"
              />
              <p className="max-w-sm text-sm leading-relaxed text-emerald-50/60">
                Your trusted destination for quality electronics, everyday essentials, and reliable
                service.
              </p>
            </div>

            {SOCIAL_LINKS.length > 0 && (
              <ul className="mt-6 flex flex-wrap items-center gap-2">
                {SOCIAL_LINKS.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-emerald-50/60 hover:border-emerald-400/40 hover:text-white motion-safe:transition-colors duration-200 ${FOCUS_RING} focus-visible:ring-offset-[#08080d]`}
                    >
                      <s.Icon size={16} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <Link
              to="/login"
              className={`mt-6 inline-flex items-center gap-1.5 text-xs text-emerald-50/50 hover:text-white motion-safe:transition-colors duration-200 ${FOCUS_RING} focus-visible:ring-offset-[#08080d]`}
            >
              <LockKeyhole size={13} />
              Owner portal
            </Link>
          </div>

          {/* Explore */}
          <FooterColumn title="Explore" className="lg:col-span-2">
            <FooterNavLink>Home</FooterNavLink>
            <FooterNavLink hash="products">Products</FooterNavLink>
            <FooterNavLink hash="categories">Categories</FooterNavLink>
            <FooterNavLink hash="store">Contact</FooterNavLink>
          </FooterColumn>

          {/* Information */}
          <FooterColumn
            title="Information"
            className={hasContact ? "lg:col-span-2" : "lg:col-span-4"}
          >
            <FooterNavLink hash="about">About Us</FooterNavLink>
            <FooterNavLink hash="store">Store Information</FooterNavLink>
            <FooterNavLink hash="support">Warranty &amp; Support</FooterNavLink>
          </FooterColumn>

          {/* Get in touch */}
          {hasContact && (
            <FooterColumn title="Get in touch" className="lg:col-span-3">
              {contactItems}
            </FooterColumn>
          )}
        </div>

        <div className="h-px w-full bg-white/10" aria-hidden="true" />

        <div className="flex flex-col items-center gap-2.5 py-6 text-center text-xs text-emerald-50/50 sm:flex-row sm:justify-between sm:text-left">
          <span>
            © {year} {STORE.name}. All rights reserved.
          </span>
          <span>
            Designed &amp; Developed by{" "}
            {DEVELOPER.krishUrl ? (
              <a
                href={DEVELOPER.krishUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={FOOTER_CREDIT_CLASS}
              >
                {DEVELOPER.name}
              </a>
            ) : (
              DEVELOPER.name
            )}{" "}
            |{" "}
            {DEVELOPER.netbroUrl ? (
              <a
                href={DEVELOPER.netbroUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={FOOTER_CREDIT_CLASS}
              >
                {DEVELOPER.agency}
              </a>
            ) : (
              DEVELOPER.agency
            )}
          </span>
        </div>
      </div>
    </footer>
  );
}

// ─── ProductImage for public products ─────────────────────────────────────────

function PublicProductImage({
  product,
  imageUrl,
  width = 600,
  eager = false,
}: {
  product: PublicProduct;
  /** Overrides the default primary image (used by the detail gallery). */
  imageUrl?: string | undefined;
  /** Requested Cloudinary width. */
  width?: number;
  eager?: boolean;
}) {
  const primary = product.images?.find((i) => i.isPrimary) ?? product.images?.[0];
  const source = imageUrl ?? primary?.url;

  const [useOriginal, setUseOriginal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset state whenever the image source changes.
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
          // Retry once with the untouched URL, then fall back to the placeholder.
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

// ─── Product card & skeleton ─────────────────────────────────────────────────

function ProductCard({ item }: { item: CatalogueItem }) {
  const meta = [item.brand, item.model].filter(Boolean).join(" · ");
  return (
    <Link
      to="/products/$id"
      params={{ id: item.id }}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-[0_1px_2px_rgba(6,20,15,0.04)] motion-safe:transition motion-safe:duration-200 hover:border-emerald-600/30 hover:shadow-[0_12px_32px_-12px_rgba(6,78,59,0.25)] motion-safe:hover:-translate-y-0.5 ${FOCUS_RING}`}
    >
      <div className="relative aspect-square overflow-hidden bg-white">
        <PublicProductImage product={item.raw} width={500} />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-emerald-50/95 px-2.5 py-0.5 text-[11px] font-medium text-emerald-900 ring-1 ring-emerald-900/10">
          {shortCategory(item.category)}
        </span>
        {!item.inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-white/80 py-1 text-center text-xs font-medium text-rose-700 backdrop-blur-sm">
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

const GRID_CLASS = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5";

function ProductGridSkeleton({ count = 10 }: { count?: number }) {
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

function ErrorPanel({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-emerald-950/20 bg-white px-6 py-14 text-center"
    >
      <AlertCircle size={34} className="text-rose-600" aria-hidden="true" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">Please check your connection and try again.</p>
      {onRetry && (
        <Button variant="outline" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// ─── Store info / contact ────────────────────────────────────────────────────

function StoreContactLinks({ className = "" }: { className?: string }) {
  const btn = "rounded-full";
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {STORE.phone && (
        <Button asChild className={btn}>
          <a href={`tel:${STORE.phone.replace(/\s/g, "")}`}>
            <Phone size={15} />
            Call the store
          </a>
        </Button>
      )}
      {STORE.whatsapp && (
        <Button asChild variant="outline" className={btn}>
          <a href={`https://wa.me/${STORE.whatsapp}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={15} />
            WhatsApp
          </a>
        </Button>
      )}
      {STORE.mapsUrl && (
        <Button asChild variant="outline" className={btn}>
          <a href={STORE.mapsUrl} target="_blank" rel="noopener noreferrer">
            <MapPin size={15} />
            Get directions
          </a>
        </Button>
      )}
    </div>
  );
}

function StoreInfoSection() {
  const rows: { icon: ReactNode; label: string; value: ReactNode }[] = [];
  if (STORE.address)
    rows.push({ icon: <MapPin size={18} />, label: "Address", value: STORE.address });
  if (STORE.hours)
    rows.push({ icon: <Clock size={18} />, label: "Opening hours", value: STORE.hours });
  if (STORE.phone)
    rows.push({
      icon: <Phone size={18} />,
      label: "Phone",
      value: (
        <a className="hover:underline" href={`tel:${STORE.phone.replace(/\s/g, "")}`}>
          {STORE.phone}
        </a>
      ),
    });
  if (STORE.email)
    rows.push({
      icon: <Mail size={18} />,
      label: "Email",
      value: (
        <a className="break-all hover:underline" href={`mailto:${STORE.email}`}>
          {STORE.email}
        </a>
      ),
    });

  return (
    <section id="store" aria-labelledby="store-heading" className="scroll-mt-24">
      <div className="overflow-hidden rounded-3xl bg-[#06140f] text-emerald-50">
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <h2
              id="store-heading"
              className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            >
              See it in person at {STORE.name}
            </h2>
            <p className="mt-3 max-w-md text-sm text-emerald-50/70">
              This catalogue is for browsing. Pick what you like, then visit the store to see it,
              ask questions and get guidance from our team.
            </p>
            {HAS_STORE_DETAILS && <StoreContactLinks className="mt-6 [&_a]:min-w-0" />}
          </div>

          {rows.length > 0 && (
            <dl className="grid gap-4 sm:grid-cols-2">
              {rows.map((r) => (
                <div key={r.label} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <dt className="flex items-center gap-2 text-sm text-emerald-300">
                    {r.icon}
                    {r.label}
                  </dt>
                  <dd className="mt-1.5 text-sm text-white">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── About & support (real sections referenced by the footer) ────────────────

function AboutSection() {
  return (
    <section id="about" aria-labelledby="about-heading" className="scroll-mt-24">
      <div className="overflow-hidden rounded-3xl border border-emerald-950/10 bg-white">
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              About us
            </span>
            <h2
              id="about-heading"
              className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              Electronics, made simple for everyday life.
            </h2>
          </div>
          <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            <p>
              {STORE.name} is your trusted destination for quality electronics, everyday essentials,
              and reliable service.
            </p>
            <p>
              Browse the catalogue online, then visit the store to see products in person, ask
              questions and get guidance from our team.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SupportSection() {
  const items = [
    {
      icon: <ShieldCheck size={18} />,
      title: "Product warranty",
      text: "Warranty details are shown on each product's page.",
    },
    {
      icon: <Headphones size={18} />,
      title: "In-store guidance",
      text: "Ask our team for help choosing the right product.",
    },
    {
      icon: <MapPin size={18} />,
      title: "Visit the store",
      text: "See products in person and get hands-on help.",
    },
  ];
  return (
    <section id="support" aria-labelledby="support-heading" className="scroll-mt-24">
      <div className="overflow-hidden rounded-3xl border border-emerald-950/10 bg-white p-6 sm:p-10">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Warranty &amp; support
        </span>
        <h2
          id="support-heading"
          className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
        >
          Help before and after you buy
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {items.map((it) => (
            <li
              key={it.title}
              className="rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-950/5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-800 ring-1 ring-emerald-950/5">
                {it.icon}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{it.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{it.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

const ALL = "All products";
type SortOption = "Featured" | "Price: low to high" | "Price: high to low";

export function Catalogue() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [sort, setSort] = useState<SortOption>("Featured");

  // Real catalogue only — no sample fallback.
  const { items: normalized, isLoading, isError, refetch } = useCatalogueProducts();

  // Derive categories + counts dynamically from returned data.
  const categoryStats = useMemo(() => {
    const map = new Map<string, { count: number; sample: CatalogueItem }>();
    for (const p of normalized) {
      const entry = map.get(p.category);
      if (entry) {
        entry.count += 1;
        if (!hasImage(entry.sample.raw) && hasImage(p.raw)) entry.sample = p;
      } else {
        map.set(p.category, { count: 1, sample: p });
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [normalized]);

  const categories = useMemo(() => [ALL, ...categoryStats.map((c) => c.name)], [categoryStats]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = normalized.filter(
      (p) =>
        (category === ALL || p.category === category) &&
        (!q || `${p.name} ${p.brand} ${p.model}`.toLowerCase().includes(q)),
    );
    if (sort === "Price: low to high")
      list = [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (sort === "Price: high to low")
      list = [...list].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    return list;
  }, [normalized, category, search, sort]);

  // Featured: an honest selection (in-stock products that have a photo) — not a popularity claim.
  const featured = useMemo(
    () => normalized.filter((p) => p.inStock && hasImage(p.raw)).slice(0, 5),
    [normalized],
  );

  const filtersActive = category !== ALL || search.trim() !== "";
  const clearFilters = useCallback(() => {
    setCategory(ALL);
    setSearch("");
  }, []);

  function pickCategory(name: string) {
    setCategory(name);
    scrollToId("products");
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f6faf8] text-foreground">
      {/* Announcement strip */}
      {STORE.announcement && (
        <div className="bg-[#06140f] px-4 py-2 text-center text-xs text-emerald-50/90 sm:text-sm">
          {STORE.announcement}
        </div>
      )}

      <PublicHeader search={search} onSearch={setSearch} />

      <main>
        {/* Hero */}
        <section aria-labelledby="hero-heading" className="relative overflow-hidden bg-[#06140f]">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className={`${CONTAINER} relative grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2 lg:gap-14 lg:py-20`}
          >
            <div className="order-2 lg:order-1">
              <h1
                id="hero-heading"
                className="text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
              >
                Electronics,
                <br />
                made easy to find.
              </h1>
              <p className="mt-5 max-w-md text-base text-emerald-50/75 sm:text-lg">
                Good tech for work, play, and everything in between. Find your next everyday
                essential.
              </p>

              <div className="mt-7 max-w-lg" role="search">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="What are you looking for?"
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button size="lg" className="rounded-full" onClick={() => scrollToId("products")}>
                  Browse the catalogue
                  <ArrowRight />
                </Button>
                {categoryStats.length > 0 && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    onClick={() => scrollToId("categories")}
                  >
                    Shop by category
                  </Button>
                )}
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-2xl shadow-black/30">
                <img
                  src={hero}
                  alt="Wireless headphones, a portable speaker and a compact keyboard"
                  width={1536}
                  height={768}
                  decoding="async"
                  className="aspect-[2/1] h-auto w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        <div className={`${CONTAINER} space-y-16 py-10 sm:py-14`}>
          {/* Trust / service highlights */}
          <ul className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: <ShieldCheck size={20} />,
                title: "Quality you can count on",
                text: "Products chosen with care.",
              },
              {
                icon: <Headphones size={20} />,
                title: "A little expert guidance",
                text: "Ask our team in store.",
              },
              {
                icon: <PackageCheck size={20} />,
                title: "Explore online. Find in store.",
                text: "Browse here, visit to see it.",
              },
            ].map((t) => (
              <li
                key={t.title}
                className="flex items-start gap-3 rounded-2xl border border-emerald-950/10 bg-white p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  {t.icon}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{t.title}</span>
                  <span className="block text-sm text-muted-foreground">{t.text}</span>
                </span>
              </li>
            ))}
          </ul>

          {/* Browse by category */}
          {categoryStats.length > 0 && (
            <section id="categories" aria-labelledby="categories-heading" className="scroll-mt-24">
              <SectionHeading
                id="categories-heading"
                title="Browse by category"
                description="Jump straight to what you need."
              />
              <ul
                className={`-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-6 ${HIDE_SCROLLBAR}`}
              >
                {categoryStats.map((c) => (
                  <li key={c.name} className="w-40 shrink-0 sm:w-auto">
                    <button
                      type="button"
                      onClick={() => pickCategory(c.name)}
                      className={`group flex w-full flex-col overflow-hidden rounded-2xl border border-emerald-950/10 bg-white text-left motion-safe:transition hover:border-emerald-600/30 hover:shadow-md ${FOCUS_RING}`}
                    >
                      <span className="relative block aspect-[4/3] overflow-hidden bg-emerald-50/60">
                        <PublicProductImage product={c.sample.raw} width={320} />
                      </span>
                      <span className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {shortCategory(c.name)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {c.count} {c.count === 1 ? "product" : "products"}
                          </span>
                        </span>
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-emerald-700 motion-safe:transition-transform group-hover:translate-x-0.5"
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Featured selection */}
          {!isLoading && !isError && featured.length > 0 && (
            <section aria-labelledby="featured-heading">
              <SectionHeading
                id="featured-heading"
                title="Featured selection"
                description="A selection of products available in store right now."
              />
              <div className={GRID_CLASS}>
                {featured.map((p) => (
                  <ProductCard key={p.id} item={p} />
                ))}
              </div>
            </section>
          )}

          {/* Main catalogue */}
          <section id="products" aria-labelledby="products-heading" className="scroll-mt-24">
            <SectionHeading
              id="products-heading"
              title="Discover your next essential"
              description="Thoughtfully selected. Ready for your everyday."
              aside={
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {isLoading
                    ? "Loading…"
                    : isError
                      ? ""
                      : `${items.length} ${items.length === 1 ? "product" : "products"}`}
                </span>
              }
            />

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                role="group"
                aria-label="Filter by category"
                className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 ${HIDE_SCROLLBAR}`}
              >
                {categories.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    className="shrink-0 rounded-full"
                    variant={c === category ? "selected" : "chip"}
                    aria-pressed={c === category}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger
                  aria-label="Sort products"
                  className={`h-9 w-full shrink-0 rounded-full border-emerald-950/15 bg-white px-3 text-sm sm:w-[200px] ${FOCUS_RING}`}
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

            {isLoading ? (
              <ProductGridSkeleton />
            ) : isError ? (
              <ErrorPanel title="We couldn't load the catalogue" onRetry={() => refetch()} />
            ) : items.length ? (
              <div className={GRID_CLASS}>
                {items.map((p) => (
                  <ProductCard key={p.id} item={p} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <EmptyState />
                {filtersActive && (
                  <div className="text-center">
                    <Button variant="outline" className="rounded-full" onClick={clearFilters}>
                      Clear search and filters
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* About */}
          <AboutSection />

          {/* Warranty & support */}
          <SupportSection />

          {/* Store info */}
          <StoreInfoSection />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function hasImage(p: PublicProduct) {
  return Boolean(p.images && p.images.length > 0);
}

// ─── ProductDetail ────────────────────────────────────────────────────────────

/** Reads optional public specifications without assuming the API type declares them. */
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
  const { id } = useParams({ strict: false });

  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["public-product", PUBLIC_SHOP_SLUG, id],
    queryFn: () => publicApi.getProduct(PUBLIC_SHOP_SLUG, id!),
    enabled: !!id,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Shares the catalogue query cache; used only to suggest related products.
  const { items: allItems } = useCatalogueProducts();
  const related = useMemo(
    () =>
      product
        ? allItems
            .filter((p) => p.id !== product.id && p.category === (product.category ?? "General"))
            .slice(0, 5)
        : [],
    [allItems, product],
  );

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
      <PublicHeader />
      <main className={`${CONTAINER} py-6 sm:py-10`}>
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link to="/" className={`rounded hover:text-foreground ${FOCUS_RING}`}>
                Catalogue
              </Link>
            </li>
            {product?.category && (
              <>
                <li aria-hidden="true">
                  <ChevronRight size={14} />
                </li>
                <li>{product.category}</li>
              </>
            )}
            {product && (
              <>
                <li aria-hidden="true">
                  <ChevronRight size={14} />
                </li>
                <li aria-current="page" className="max-w-[60vw] truncate text-foreground">
                  {product.name}
                </li>
              </>
            )}
          </ol>
        </nav>

        <Link
          to="/"
          className={`mb-6 inline-flex items-center gap-1.5 rounded text-sm font-medium text-emerald-800 hover:text-emerald-950 ${FOCUS_RING}`}
        >
          <ArrowLeft size={16} />
          Back to catalogue
        </Link>

        {isLoading ? (
          <div className="flex items-center justify-center py-24" aria-busy="true">
            <Loader2 className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" />
            <span className="sr-only">Loading product</span>
          </div>
        ) : product ? (
          <>
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
              <DetailGallery key={product.id} product={product} />

              <div className="flex flex-col gap-4">
                {(product.category || product.brand) && (
                  <span className="text-sm font-medium text-emerald-800">
                    {[product.category, product.brand].filter(Boolean).join(" · ")}
                  </span>
                )}
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {product.name}
                </h1>
                {product.model && (
                  <p className="text-muted-foreground">
                    {[product.brand, product.model].filter(Boolean).join(" · ")}
                  </p>
                )}

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

                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950">
                  <p className="font-medium">Explore in store</p>
                  <p className="mt-1 text-emerald-950/75">
                    Available to explore in store. No online checkout.
                  </p>
                  {HAS_STORE_DETAILS && <StoreContactLinks className="mt-3" />}
                  {STORE.address && (
                    <p className="mt-3 flex items-start gap-2 text-emerald-950/75">
                      <MapPin size={15} className="mt-0.5 shrink-0" />
                      {STORE.address}
                    </p>
                  )}
                </div>

                <Button asChild variant="outline" className="w-fit rounded-full">
                  <Link to="/">
                    Browse more products
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>

            {related.length > 0 && (
              <section aria-labelledby="related-heading" className="mt-16">
                <SectionHeading id="related-heading" title="More from this category" />
                <div className={GRID_CLASS}>
                  {related.map((p) => (
                    <ProductCard key={p.id} item={p} />
                  ))}
                </div>
              </section>
            )}
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

// ─── LoginPage (connected to real auth) — unchanged ──────────────────────────

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
