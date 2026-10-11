import prisma from '../../config/db.js';
import { NotFoundError } from '../../utils/errors.js';
import { parsePagination, paginationMeta } from '../../utils/helpers.js';

export async function createPayment(shopId, data) {
  // Verify sale belongs to shop
  const sale = await prisma.sale.findFirst({
    where: { id: data.saleId, shopId },
  });
  if (!sale) throw new NotFoundError('Sale not found');

  return prisma.payment.create({
    data: {
      shopId,
      saleId: data.saleId,
      method: data.method,
      amount: data.amount,
      status: 'SUCCESS',
      reference: data.reference || null,
    },
  });
}

export async function listPayments(shopId, query) {
  const { page, limit, skip } = parsePagination(query);
  const where = { shopId };
  if (query.saleId) where.saleId = query.saleId;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, pagination: paginationMeta(total, page, limit) };
}

export async function getPayment(shopId, paymentId) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, shopId },
  });
  if (!payment) throw new NotFoundError('Payment not found');
  return payment;
}
