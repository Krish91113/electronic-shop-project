import prisma from '../../config/db.js';
import { round2 } from '../../utils/money.js';

/**
 * Profit & Loss report using cost snapshots from SaleItems.
 */
export async function profitLoss(shopId, from, to, timezone) {
  let fromDate = new Date(from);
  let toDate = new Date(to);

  // If date-only string like YYYY-MM-DD, set start of day for fromDate and end of day for toDate
  if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    fromDate = new Date(`${from}T00:00:00.000Z`);
  }
  if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    toDate = new Date(`${to}T23:59:59.999Z`);
  } else if (toDate) {
    // If toDate is at exact midnight UTC (00:00:00), extend to end of day so all sales on that day are captured
    if (
      toDate.getUTCHours() === 0 &&
      toDate.getUTCMinutes() === 0 &&
      toDate.getUTCSeconds() === 0 &&
      toDate.getUTCMilliseconds() === 0
    ) {
      toDate.setUTCHours(23, 59, 59, 999);
    }
  }

  // Net sales from completed/refunded sales
  const salesAgg = await prisma.sale.aggregate({
    where: {
      shopId,
      status: { in: ['COMPLETED'] },
      createdAt: { gte: fromDate, lte: toDate },
    },
    _sum: { subtotal: true, discountTotal: true, taxTotal: true, totalAmount: true },
    _count: true,
  });

  const netSales = round2(
    Number(salesAgg._sum.subtotal || 0) - Number(salesAgg._sum.discountTotal || 0)
  );

  // COGS: sum of (unitCostSnapshot * quantity) from sale items of completed sales
  const cogsResult = await prisma.$queryRaw`
    SELECT COALESCE(SUM(si."unitCostSnapshot" * si.quantity), 0) as cogs
    FROM "SaleItem" si
    JOIN "Sale" s ON si."saleId" = s.id
    WHERE s."shopId" = ${shopId}
      AND s.status = 'COMPLETED'
      AND s."createdAt" >= ${fromDate}
      AND s."createdAt" <= ${toDate}
  `;
  const cogs = round2(Number(cogsResult[0]?.cogs || 0));

  // Returns / refunds
  const refunds = await prisma.sale.aggregate({
    where: {
      shopId,
      status: { in: ['CANCELLED', 'REFUNDED'] },
      createdAt: { gte: fromDate, lte: toDate },
    },
    _sum: { totalAmount: true },
    _count: true,
  });
  const refundTotal = round2(Number(refunds._sum.totalAmount || 0));

  // Expenses
  const expensesAgg = await prisma.expense.aggregate({
    where: {
      shopId,
      date: { gte: fromDate, lte: toDate },
    },
    _sum: { amount: true },
  });
  const totalExpenses = round2(Number(expensesAgg._sum.amount || 0));

  const grossProfit = round2(netSales - cogs);
  const netProfit = round2(grossProfit - totalExpenses);

  return {
    period: { from, to, timezone },
    salesCount: salesAgg._count,
    netSales,
    discounts: round2(Number(salesAgg._sum.discountTotal || 0)),
    taxCollected: round2(Number(salesAgg._sum.taxTotal || 0)),
    refunds: refundTotal,
    refundCount: refunds._count,
    cogs,
    grossProfit,
    operatingExpenses: totalExpenses,
    netProfit,
    note: 'Net profit is an estimate; system does not implement full accounting.',
  };
}

/**
 * Stock valuation report:
 * Total purchase value of inventory on hand (serialized StockUnits + non-serialized quantities).
 */
export async function stockValuation(shopId) {
  // Serialized stock valuation (sum of purchaseCost of IN_STOCK units)
  const serializedAgg = await prisma.$queryRaw`
    SELECT COALESCE(SUM(u."purchaseCost"), 0) as total, COUNT(*)::int as count
    FROM "StockUnit" u
    WHERE u."shopId" = ${shopId} AND u.status = 'IN_STOCK'
  `;
  const serializedValuation = round2(Number(serializedAgg[0]?.total || 0));
  const serializedUnitsCount = serializedAgg[0]?.count || 0;

  // Non-serialized stock valuation (product.purchaseCost * inventory.quantity where trackSerial is false)
  const nonSerializedAgg = await prisma.$queryRaw`
    SELECT COALESCE(SUM(p."purchaseCost" * i.quantity), 0) as total, COALESCE(SUM(i.quantity), 0)::int as count
    FROM "Inventory" i
    JOIN "Product" p ON i."productId" = p.id
    WHERE i."shopId" = ${shopId} AND p."trackSerial" = false AND p."isActive" = true
  `;
  const nonSerializedValuation = round2(Number(nonSerializedAgg[0]?.total || 0));
  const nonSerializedQuantity = nonSerializedAgg[0]?.count || 0;

  const totalValuation = round2(serializedValuation + nonSerializedValuation);

  return {
    serializedValuation,
    serializedUnitsCount,
    nonSerializedValuation,
    nonSerializedQuantity,
    totalValuation,
    totalItemsOnHand: serializedUnitsCount + nonSerializedQuantity,
  };
}

/**
 * Sales by model group report.
 */
export async function salesByModel(shopId, from, to) {
  let fromDate = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
  let toDate = to ? new Date(to) : new Date();

  const results = await prisma.$queryRaw`
    SELECT p.id as "productId",
           COALESCE(p."modelKey", p.name) as "modelKey",
           p.name, p.brand, p.model, p.variant, p.color,
           COUNT(si.id)::int as "unitsSold",
           COALESCE(SUM(si.quantity), 0)::int as "totalQuantity",
           COALESCE(SUM(si."lineTotal"), 0) as "revenue",
           COALESCE(SUM(si."unitCostSnapshot" * si.quantity), 0) as "cogs"
    FROM "SaleItem" si
    JOIN "Sale" s ON si."saleId" = s.id
    JOIN "Product" p ON si."productId" = p.id
    WHERE s."shopId" = ${shopId}
      AND s.status = 'COMPLETED'
      AND s."createdAt" >= ${fromDate}
      AND s."createdAt" <= ${toDate}
    GROUP BY p.id, p."modelKey", p.name, p.brand, p.model, p.variant, p.color
    ORDER BY "revenue" DESC
  `;

  return results.map((r) => {
    const revenue = round2(Number(r.revenue));
    const cogs = round2(Number(r.cogs));
    return {
      productId: r.productId,
      modelKey: r.modelKey,
      name: r.name,
      brand: r.brand,
      model: r.model,
      variant: r.variant,
      color: r.color,
      unitsSold: r.unitsSold,
      totalQuantity: r.totalQuantity,
      revenue,
      cogs,
      grossProfit: round2(revenue - cogs),
    };
  });
}

/**
 * Complete lifecycle history of an IMEI unit.
 */
export async function imeiHistory(shopId, imei) {
  const cleaned = imei.replace(/\D/g, '').trim();

  const unit = await prisma.stockUnit.findFirst({
    where: {
      shopId,
      OR: [{ imei1: cleaned }, { imei2: cleaned }],
    },
    include: {
      product: {
        select: { id: true, name: true, brand: true, model: true, variant: true, color: true },
      },
      saleItem: {
        include: {
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              customerName: true,
              customerPhone: true,
              createdAt: true,
              status: true,
            },
          },
        },
      },
      stockMovements: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return unit;
}
