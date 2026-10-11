import * as service from './expenses.service.js';

export async function create(req, res, next) {
  try {
    const expense = await service.createExpense(req.shopId, req.body, req.user.id);
    res.status(201).json({ data: expense });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const expense = await service.updateExpense(req.shopId, req.params.id, req.body);
    res.json({ data: expense });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await service.deleteExpense(req.shopId, req.params.id);
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const expense = await service.getExpense(req.shopId, req.params.id);
    res.json({ data: expense });
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await service.listExpenses(req.shopId, req.query);
    res.json({ data: result.expenses, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
}
