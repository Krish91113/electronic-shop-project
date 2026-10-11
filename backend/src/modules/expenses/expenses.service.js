import prisma from '../../config/db.js';
import { NotFoundError } from '../../utils/errors.js';
import { parsePagination, paginationMeta } from '../../utils/helpers.js';

export async function createExpense(shopId, data, userId) {
  return prisma.expense.create({
    data: {
      shopId,
      category: data.category,
      amount: data.amount,
      date: data.date ? new Date(data.date) : new Date(),
      description: data.description || null,
      createdBy: userId,
    },
  });
}

export async function updateExpense(shopId, expenseId, data) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, shopId },
  });
  if (!expense) throw new NotFoundError('Expense not found');

  const updateData = {};
  if (data.category !== undefined) updateData.category = data.category;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.date !== undefined) updateData.date = new Date(data.date);
  if (data.description !== undefined) updateData.description = data.description;

  return prisma.expense.update({
    where: { id: expenseId },
    data: updateData,
  });
}

export async function deleteExpense(shopId, expenseId) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, shopId },
  });
  if (!expense) throw new NotFoundError('Expense not found');
  await prisma.expense.delete({ where: { id: expenseId } });
  return { deleted: true };
}

export async function getExpense(shopId, expenseId) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, shopId },
  });
  if (!expense) throw new NotFoundError('Expense not found');
  return expense;
}

export async function listExpenses(shopId, query) {
  const { page, limit, skip } = parsePagination(query);
  const where = { shopId };
  if (query.category) where.category = { contains: query.category, mode: 'insensitive' };
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = new Date(query.from);
    if (query.to) where.date.lte = new Date(query.to);
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
    }),
    prisma.expense.count({ where }),
  ]);

  return { expenses, pagination: paginationMeta(total, page, limit) };
}
