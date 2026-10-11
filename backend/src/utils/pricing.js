import { round2 } from './money.js';

/**
 * Apply default pricing rule if product has no explicit price.
 * Default rule: cost < 1000 → cost + 100, else cost * 1.10
 * Rules can be overridden per shop via Shop.pricingRule JSON.
 */
export function applyPricingRule(purchaseCost, shopPricingRule = null) {
  const cost = Number(purchaseCost);
  if (shopPricingRule) {
    const { threshold, addend, multiplier } = shopPricingRule;
    if (threshold !== undefined && addend !== undefined && cost < Number(threshold)) {
      return round2(cost + Number(addend));
    }
    if (multiplier !== undefined) {
      return round2(cost * Number(multiplier));
    }
  }
  // Default rule
  if (cost < 1000) {
    return round2(cost + 100);
  }
  return round2(cost * 1.10);
}
