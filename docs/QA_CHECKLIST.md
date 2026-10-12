# TIME CENTRE Mobile & Electronics - Manual QA Checklist

This checklist guides manual verification across devices, independent shop owners, POS billing, print layouts, and the public multi-shop storefront.

---

## 1. Multi-Device & Independent Owner Isolation

### Test 1.1: Shop 1 Owner Login (Device / Browser 1)
- [ ] Open the app on Device 1 (e.g. Chrome desktop or mobile) and navigate to `/login`.
- [ ] Log in with Shop 1 Owner credentials (`owner1@timecentre.com`).
- [ ] Verify you are redirected to `/dashboard`.
- [ ] **Top Bar Check:**
  - [ ] Look at the top bar navigation.
  - [ ] Confirm the prominent green shop badge displays **"Time Centre - Shop 1"**.
  - [ ] Confirm **no shop switcher dropdown** is visible (since this user belongs to only 1 branch).
- [ ] Attempt to manually navigate to or view Shop 2 resources:
  - [ ] Products, sales, expenses, and inventory must only show Shop 1 items.
  - [ ] Direct API requests using `x-shop-id` for Shop 2 return `403 Forbidden` or `404 Not Found`.

### Test 1.2: Shop 2 Owner Login (Device / Browser 2)
- [ ] Open the app on Device 2 (or an incognito window) and navigate to `/login`.
- [ ] Log in with Shop 2 Owner credentials (`owner2@timecentre.com`).
- [ ] Verify you are redirected to `/dashboard`.
- [ ] **Top Bar Check:**
  - [ ] Confirm the top bar displays **"Time Centre - Shop 2"**.
  - [ ] Confirm **no shop switcher dropdown** is visible.
- [ ] Confirm Shop 2's catalogue, stock, sales history, and expenses are completely distinct from Shop 1.

### Test 1.3: Super Owner Login (Combined View)
- [ ] Log in with `superowner@timecentre.com`.
- [ ] Confirm the top bar displays a **shop switcher dropdown**.
- [ ] Switch between **"Time Centre - Shop 1"** and **"Time Centre - Shop 2"**; verify active shop context switches smoothly and updates all modules accordingly.

---

## 2. Point of Sale (POS) Billing & Customer Details

### Test 2.1: Creating a Sale
- [ ] Navigate to `/billing`.
- [ ] Enter **Customer Name** (e.g. `Rahul Sharma`).
- [ ] Enter **Customer Phone** (e.g. `+91 98765 43210`).
- [ ] Add an item (e.g. a smartphone or accessory) to the cart.
- [ ] In the cart line item, enter the mobile **IMEI / Serial Number** (e.g. `IMEI 358923091823901`).
- [ ] Verify tax calculation (GST) is correctly computed line-by-line.
- [ ] Select payment method (`Cash`, `UPI`, or `Card`).
- [ ] Toggle the checkbox **"Auto-open print dialog after sale"**.
- [ ] Click **"Complete Sale"**:
  - [ ] Verify the button is **disabled while submitting** to prevent accidental double sales.
  - [ ] If auto-open print was checked, verify the browser print dialog opens automatically.
  - [ ] Verify the success screen displays three action buttons:
    - **"Print Bill"**
    - **"View Invoice"**
    - **"New Bill"**

---

## 3. Customer Bill Printing (A4 Standard & 80mm Thermal)

### Test 3.1: Chrome-Free Print Route (`/sales/:id/print`)
- [ ] Open any completed sale via **"Print Bill"** or from Sales History (`/sales`).
- [ ] Confirm the page loads at route `/sales/:id/print`.
- [ ] **Branding & Header Verification:**
  - [ ] Displays the branch name (e.g. `Time Centre - Shop 1` or `Shop 2`).
  - [ ] Displays the branch **Address**, **Phone**, and **GSTIN** (e.g. `29AAAAA0000A1Z1`).
  - [ ] Displays **Retail Tax Invoice**, sequential invoice number (e.g. `TC1-2026-000001`), and date/time.
  - [ ] Displays **Customer Details** (`Name` and `Phone`).
  - [ ] Confirm **no Volt Electronics or app admin chrome/navigation** is rendered.
  - [ ] Confirm **no "PDF uses your browser's Save as PDF option"** text appears.
- [ ] **Item Table & Warranty:**
  - [ ] Lists Item name, quantity, rate, discount, tax %, and line total.
  - [ ] Displays the captured **IMEI / Serial Number** under the product name.
  - [ ] Displays the product **Warranty note** (e.g. `1 Year Comprehensive Brand Warranty`).
- [ ] **Summary & Footer:**
  - [ ] Displays Subtotal, Discount, Itemized Tax Breakdown (e.g. `GST 18%`), and Grand Total.
  - [ ] Lists Payment method(s) and amounts.
  - [ ] Displays the shop's configurable `invoiceFooter` text.

### Test 3.2: Layout Toggle & Print Preview
- [ ] Click the **"A4 Standard"** button in the print toolbar:
  - [ ] Bill renders in full A4 presentation layout.
  - [ ] Press `Ctrl + P` / click **"Print"**: verify page margins and pagination look crisp in print preview.
- [ ] Click the **"80mm Thermal"** button in the print toolbar:
  - [ ] Bill adjusts to continuous thermal receipt layout with compact fonts and dashed separators.
  - [ ] Press `Ctrl + P`: verify print preview fits standard 80mm thermal receipt paper.

### Test 3.3: Void / Cancelled Sales
- [ ] Cancel a sale from the Sales History page (`/sales`).
- [ ] Open the print view for that sale.
- [ ] Verify a bold, prominent **"*** CANCELLED SALE *** - This transaction has been voided"** watermark/banner is clearly visible.

---

## 4. Public Multi-Shop Storefront (Mobile & Desktop)

### Test 4.1: Store Chooser Landing Page (`/`)
- [ ] Open `/` in mobile emulation mode (or on a smartphone).
- [ ] Verify the header displays the **Time Centre Mobile & Electronics** brand.
- [ ] In the **"Select Your Branch"** section:
  - [ ] Confirm cards are displayed dynamically for each shop returned by the API (not hardcoded).
  - [ ] Each card clearly displays:
    - Shop Name (e.g. *Time Centre - Shop 1*, *Time Centre - Shop 2*)
    - Physical Address & Location pin
    - Contact Phone number
    - Live in-stock count badge (e.g. *"X products in stock"*)
    - Button **"Browse this shop"**
- [ ] Click **"Browse this shop"** on either card. Verify URL navigates to `/shop/$shopSlug`.

### Test 4.2: Branch Catalogue (`/shop/:shopSlug`)
- [ ] Verify the header displays:
  - Branch name, address, and clickable contact phone.
  - Link back to **"← All Shops"**.
  - A quick switcher button to the other branch (e.g. *"Switch to Time Centre - Shop 2"*).
- [ ] **Filters & Stock Controls:**
  - [ ] Confirm **"In stock only"** switch is **ON by default**.
  - [ ] Test category filters (e.g. *Smartphones*, *Wearables*, *Accessories*).
  - [ ] Test the search bar: type product name or brand; verify instant filtering.
  - [ ] Test empty state: search for a non-existent item; verify friendly empty state and "Clear search and filters" button.
- [ ] Confirm products listed belong **ONLY** to this shop; products from the other shop are never shown.
- [ ] Confirm public listing only reveals `inStock: true/false` and **never leaks cost, margin, or exact stock quantities**.

### Test 4.3: Product Detail View (`/shop/:shopSlug/products/:productSlug`)
- [ ] Click any product in the shop catalogue.
- [ ] Confirm URL is `/shop/$shopSlug/products/$productSlug`.
- [ ] Verify breadcrumb navigation: `All Shops / [Shop Name] / [Category] / [Product]`.
- [ ] Verify product specs, warranty note, and pricing.
- [ ] Verify the **"Available at [Shop Name]"** box clearly presents the branch address and phone number so customers know which physical shop to visit.
- [ ] Test legacy URL backward compatibility: navigate to `/products/TEST001` directly; confirm it gracefully redirects to the new `/shop/...` route.
