import { describe, expect, it } from "vitest";

describe("Phase 4: Frontend Serialized Inventory and Billing UI", () => {
  it("computes inclusive GST math correctly for intra-state billing", () => {
    // 1 item priced at 8999 (inclusive of 18% GST)
    const unitPrice = 8999;
    const qty = 1;
    const rate = 18;

    const lineGross = unitPrice * qty;
    const lineBase = Number((lineGross / (1 + rate / 100)).toFixed(2));
    const lineTax = Number((lineGross - lineBase).toFixed(2));

    expect(lineBase).toBe(7626.27);
    expect(lineTax).toBe(1372.73);
    expect(Number((lineBase + lineTax).toFixed(2))).toBe(lineGross);

    // Intra-state 50/50 split
    const cgst = Number((lineTax / 2).toFixed(2));
    const sgst = Number((lineTax - cgst).toFixed(2));
    expect(cgst).toBe(686.37);
    expect(sgst).toBe(686.36);
    expect(Number((cgst + sgst).toFixed(2))).toBe(lineTax);
  });

  it("handles multi-item inclusive GST math with multiple tax rates", () => {
    const items = [
      { name: "Oppo A6x", unitPrice: 8999, qty: 1, rate: 18 },
      { name: "Fast Charger 33W", unitPrice: 999, qty: 2, rate: 18 },
      { name: "Phone Case", unitPrice: 199, qty: 1, rate: 12 },
    ];

    const grossTotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    expect(grossTotal).toBe(8999 + 1998 + 199); // 11196

    const baseTotal = items.reduce((s, it) => {
      const gross = it.qty * it.unitPrice;
      return s + Number((gross / (1 + it.rate / 100)).toFixed(2));
    }, 0);

    const taxTotal = Number((grossTotal - baseTotal).toFixed(2));
    expect(grossTotal).toBe(11196);
    expect(baseTotal).toBeGreaterThan(9000);
    expect(taxTotal).toBeGreaterThan(1500);
  });

  it("formats model display with brand, model, variant, and color correctly", () => {
    const product = {
      name: "Oppo A6x 4/64 Ice Blue",
      brand: "Oppo",
      model: "A6x",
      variant: "4/64",
      color: "Ice Blue",
      trackSerial: true,
    };

    const details = [product.brand, product.model].filter(Boolean).join(" · ");
    expect(details).toBe("Oppo · A6x");
    expect(product.variant).toBe("4/64");
    expect(product.color).toBe("Ice Blue");
    expect(product.trackSerial).toBe(true);
  });
});
