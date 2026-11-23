import { describe, it, expect } from "vitest";
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceDocument } from "@/components/shop/invoice-document";
import { type Sale, type Shop, type Payment } from "@/lib/api";

const mockSale: Sale = {
  id: "sale-123",
  shopId: "shop-tc",
  invoiceNumber: "INV-2026-001",
  customerName: "Rahul Sharma",
  customerPhone: "9876543210",
  customerAddress: "Main Road, Bishnugarh, Hazaribagh",
  customerGstin: "20AAAAA0000A1Z5",
  customerAadhaar: "4321",
  customerState: "Jharkhand",
  customerStateCode: "20",
  placeOfSupply: "Jharkhand (20)",
  subtotal: 10000,
  taxTotal: 1800,
  discountTotal: 0,
  totalAmount: 11800,
  cgstTotal: 900,
  sgstTotal: 900,
  igstTotal: 0,
  roundOff: 0,
  amountInWords: "INR Eleven Thousand Eight Hundred Only",
  status: "COMPLETED",
  paymentStatus: "PAID",
  createdAt: "2026-11-20T10:00:00Z",
  shop: {
    id: "shop-tc",
    name: "Time Centre Mobile & Electronics",
    code: "TC",
    slug: "time-centre",
    address: "Akhara Chowk, Bishnugarh, Hazaribagh, Jharkhand",
    contactPhone: "9123456789",
    alternatePhone: "7033389366",
    contactEmail: "timecentre@example.com",
    gstin: "20EBEPK7095A1Z0",
    invoicePrefix: "INV",
    timezone: "Asia/Kolkata",
    state: "Jharkhand",
    stateCode: "20",
    tagline: "Mobile Sale & Service — All Types of Mobile Repairing here",
    bankName: "State Bank of India",
    bankAccountNo: "12345678901",
    bankIfsc: "SBIN0001234",
    bankBranch: "Bishnugarh",
    upiId: "timecentre@sbi",
    warrantyNote: "All warranty & guaranty by Manufacturer",
    termsAndConditions: "Goods once sold will not be taken back without original invoice.",
    brandsServiced: ["NOKIA", "SAMSUNG", "vivo", "oppo", "mi", "Realme", "TECNO"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as unknown as Shop,
  items: [
    {
      id: "item-1",
      saleId: "sale-123",
      productId: "prod-1",
      quantity: 1,
      unitSellingPrice: 11800,
      unitCostSnapshot: 10000,
      discountAmount: 0,
      taxAmount: 1800,
      lineBase: 10000,
      lineTax: 1800,
      lineTotal: 11800,
      taxRateSnapshot: 18,
      productNameSnapshot: "Oppo A6x 4/64 Ice Blue",
      imeiSnapshot: "865796081668730",
      imei2Snapshot: "865796081668731",
      chargerNoSnapshot: "CHG-9988",
      hsnSnapshot: "8517",
      product: {
        warranty: "1 Year Manufacturer",
        category: "Mobile",
        trackSerial: true,
      },
    },
  ],
  payments: [
    {
      id: "pay-1",
      shopId: "shop-tc",
      saleId: "sale-123",
      method: "UPI",
      amount: 11800,
      status: "COMPLETED",
      createdAt: "2026-11-20T10:00:00Z",
    } as unknown as Payment,
  ],
};

describe("Phase 5: InvoiceDocument Component", () => {
  it("renders A4 GST Tax Invoice with Time Centre details, customer, and IMEI", () => {
    render(
      <InvoiceDocument sale={mockSale} copyLabel="ORIGINAL FOR RECIPIENT" isThermal={false} />,
    );

    // Tax invoice title and copy tag
    expect(screen.getByText("TAX INVOICE")).toBeDefined();
    expect(screen.getByText("ORIGINAL FOR RECIPIENT")).toBeDefined();

    // Shop branding
    expect(screen.getByText("Time Centre Mobile & Electronics")).toBeDefined();
    expect(screen.getByText(/20EBEPK7095A1Z0/)).toBeDefined();
    expect(screen.getByText(/Mobile Sale & Service/)).toBeDefined();

    // Customer / Buyer Details
    expect(screen.getByText("Rahul Sharma")).toBeDefined();
    expect(screen.getByText(/20AAAAA0000A1Z5/)).toBeDefined();
    expect(screen.getByText(/Main Road, Bishnugarh/)).toBeDefined();

    // Items table with IMEI and charger
    expect(screen.getByText("Oppo A6x 4/64 Ice Blue")).toBeDefined();
    expect(screen.getByText(/865796081668730/)).toBeDefined();
    expect(screen.getByText(/CHG-9988/)).toBeDefined();
    expect(screen.getAllByText("8517").length).toBeGreaterThanOrEqual(1);

    // Bank Details
    expect(screen.getByText(/State Bank of India/)).toBeDefined();
    expect(screen.getByText(/12345678901/)).toBeDefined();
    expect(screen.getByText(/SBIN0001234/)).toBeDefined();

    // Amount in words
    expect(screen.getByText(/Eleven Thousand Eight Hundred/)).toBeDefined();

    // EMI Reminder Notice
    expect(
      screen.getByText(/EMI कटने के तारीख से 3 दिन पहले A\/c में पैसा डाल के रखना अनिवार्य है/),
    ).toBeDefined();
  });

  it("renders 80mm thermal receipt mode correctly", () => {
    render(<InvoiceDocument sale={mockSale} isThermal={true} />);

    // Header & Shop
    expect(screen.getByText("Time Centre Mobile & Electronics")).toBeDefined();
    expect(screen.getByText("TAX INVOICE / CASH MEMO")).toBeDefined();

    // Serial/IMEI details
    expect(screen.getByText(/865796081668730/)).toBeDefined();

    // Total and UPI
    expect(screen.getByText(/UPI: timecentre@sbi/)).toBeDefined();
    expect(screen.getByText("Thank you for visiting Time Centre!")).toBeDefined();

    // EMI Warning Notice in Thermal mode
    expect(
      screen.getByText(/EMI कटने के तारीख से 3 दिन पहले A\/c में पैसा डाल के रखना अनिवार्य है/),
    ).toBeDefined();
  });
});
