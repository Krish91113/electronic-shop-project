import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Zap,
  LayoutDashboard,
  Package,
  Boxes,
  ScanLine,
  ReceiptText,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  ArrowUpRight,
  Store,
  Bell,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import type { Product } from "./data";

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`brand ${dark ? "brand-dark" : ""}`}>
      <span className="brand-mark">
        <Zap size={21} fill="currentColor" />
      </span>
      <span>
        volt<span className="brand-dot">.</span>
      </span>
    </span>
  );
}

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/billing", label: "New Bill", icon: ScanLine },
  { to: "/sales", label: "Sales History", icon: ReceiptText },
  { to: "/reports/profit-loss", label: "Profit & Loss", icon: ChartNoAxesCombined },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const { activeShop, user, switchShop, logout } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Derive shop list from user for the switcher
  const shops = user?.shops ?? [];

  // User display — initials fallback
  const displayName = user?.name ?? user?.email ?? "Owner";
  const initials = displayName
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  const shopName = activeShop?.name ?? "Shop";

  async function handleLogout() {
    try {
      await logout();
    } finally {
      // __root.tsx redirect will handle navigation
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Link to="/" aria-label="Volt catalogue">
            <Brand dark />
          </Link>
          <Button
            variant="nav"
            size="icon"
            className="drawer-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>

        <p className="nav-caption">WORKSPACE</p>

        <nav>
          {nav.map((n) => (
            <Button
              asChild
              variant="nav"
              key={n.to}
              className={`nav-link ${path === n.to || (n.to !== "/products" && path.startsWith(n.to + "/")) ? "nav-active" : ""}`}
            >
              <Link to={n.to} onClick={() => setOpen(false)}>
                <n.icon size={19} />
                {n.label}
                {n.to === "/billing" && <span className="nav-shortcut">+</span>}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="shop-label">
            <Store size={19} />
            <div>
              <strong>{shopName}</strong>
              <small>{activeShop?.code ?? ""}</small>
            </div>
          </div>
          <Link to="/" className="catalogue-link">
            Public catalogue <ArrowUpRight size={15} />
          </Link>
          <div className="owner">
            <span className="avatar">{initials}</span>
            <div>
              <strong>{displayName}</strong>
              <small>Shop owner</small>
            </div>
            <Button variant="nav" size="icon" aria-label="Sign out" onClick={handleLogout}>
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </aside>

      {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} />}

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
            <span>{title}</span>
          </div>
          <div className="topbar-controls">
            {shops.length > 1 && (
              <label className="shop-switch">
                <Store size={16} />
                <select
                  aria-label="Current shop"
                  value={activeShop?.id ?? ""}
                  onChange={(e) => switchShop(e.target.value)}
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {shops.length <= 1 && activeShop && (
              <span className="shop-switch">
                <Store size={16} />
                <span style={{ padding: "0 4px" }}>{shopName}</span>
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => setNotice(true)}
            >
              <Bell size={19} />
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Owner settings">
              <Link to="/settings">
                <span className="avatar">{initials}</span>
              </Link>
            </Button>
          </div>
        </header>

        <main className="admin-main">{children}</main>

        <nav className="mobile-bottom">
          {nav
            .filter((n) => ["/dashboard", "/inventory", "/billing", "/sales"].includes(n.to))
            .map((n) => (
              <Button
                asChild
                variant="ghost"
                key={n.to}
                className={path === n.to ? "text-primary" : ""}
              >
                <Link to={n.to}>
                  <n.icon size={20} />
                  <span>{n.label === "Sales History" ? "Sales" : n.label}</span>
                </Link>
              </Button>
            ))}
        </nav>
      </div>

      <Confirm
        open={notice}
        onOpenChange={setNotice}
        title="You're all caught up"
        description="There are no new notifications."
        onConfirm={() => setNotice(false)}
        confirmLabel="Done"
      />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search products...",
  autoFocus = false,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="search-input">
      <Search size={18} />
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
      />
    </div>
  );
}

export function StatusBadge({ product }: { product: Product }) {
  const label = !product.active
    ? "Inactive"
    : product.stock === 0
      ? "Out of stock"
      : product.stock <= product.threshold
        ? "Low stock"
        : "In stock";
  return (
    <span
      className={`status ${label === "Low stock" ? "status-warning" : label === "Out of stock" ? "status-danger" : label === "Inactive" ? "status-neutral" : "status-success"}`}
    >
      <span />
      {label}
    </span>
  );
}

export function ProductImage({ product }: { product: Product }) {
  return product.image ? (
    <img src={product.image} alt={product.name} loading="lazy" width={512} height={512} />
  ) : (
    <div className="image-placeholder">
      <Package size={48} />
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Package;
}) {
  return (
    <section className="metric-card">
      <div className="metric-label">
        {label}
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}

export function DateRangeControl() {
  return (
    <select aria-label="Date range" className="date-control">
      <option>This week</option>
      <option>Today</option>
      <option>This month</option>
      <option>Last month</option>
    </select>
  );
}

export function EmptyState({
  title = "No products found",
  detail = "Try a different search or category.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="empty-state">
      <Package size={34} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirm",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="quantity-stepper">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        <Minus size={14} />
      </Button>
      <span>{value}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
      >
        <Plus size={14} />
      </Button>
    </div>
  );
}
