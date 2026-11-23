/**
 * Normalizes modelKey for product uniqueness and grouping:
 * "lower(brand|model|variant|color), trimmed, single spaces"
 */

/**
 * Normalizes a single string component:
 * lowercase, trim, collapse consecutive whitespaces into a single space.
 */
export function normalizeComponent(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Compute modelKey from brand, model, variant, color, or extract from name.
 */
export function computeModelKey({ brand, model, variant, color, name }) {
  let b = normalizeComponent(brand);
  let m = normalizeComponent(model);
  let v = normalizeComponent(variant);
  let c = normalizeComponent(color);

  // If variant or color are missing, try parsing them from name
  if ((!v || !c || !m) && name) {
    const parsed = parseProductModel(name);
    if (!m && parsed.model) m = normalizeComponent(parsed.model);
    if (!v && parsed.variant) v = normalizeComponent(parsed.variant);
    if (!c && parsed.color) c = normalizeComponent(parsed.color);
    if (!b && parsed.brand) b = normalizeComponent(parsed.brand);
  }

  // If still missing essential keys, fallback to normalized name
  if (!b && !m && !v && !c) {
    return normalizeComponent(name);
  }

  return [b, m, v, c].join('|');
}

/**
 * Parse variant, color, model, brand from common mobile phone names.
 * Example:
 * "Oppo A6x 4/64 Ice Blue" => brand: "Oppo", model: "A6x", variant: "4/64", color: "Ice Blue"
 * "A6x 4/64 Ice Blue" => model: "A6x", variant: "4/64", color: "Ice Blue"
 */
export function parseProductModel(name) {
  if (!name || typeof name !== 'string') {
    return { brand: null, model: null, variant: null, color: null };
  }

  const raw = name.trim();

  // Common brands list
  const KNOWN_BRANDS = [
    'oppo', 'vivo', 'samsung', 'realme', 'mi', 'redmi', 'xiaomi',
    'oneplus', 'apple', 'motorola', 'moto', 'nokia', 'tecno', 'infinix',
    'iqoo', 'poco', 'lava', 'itel', 'google', 'honor', 'boat', 'jbl', 'anker', 'logitech'
  ];

  let remaining = raw;
  let brand = null;

  for (const b of KNOWN_BRANDS) {
    const regex = new RegExp(`^${b}\\b`, 'i');
    if (regex.test(remaining)) {
      brand = remaining.match(regex)[0];
      remaining = remaining.replace(regex, '').trim();
      break;
    }
  }

  // Match memory variants like 4/64, 4/64GB, 6/128, 8/256, 12/256, 4GB/64GB
  let variant = null;
  const variantRegex = /\b(\d{1,2}\s*(?:GB)?\s*\/\s*\d{2,4}\s*(?:GB|TB)?)\b/i;
  const vMatch = remaining.match(variantRegex);
  if (vMatch) {
    variant = vMatch[1].replace(/\s+/g, '').replace(/GB/gi, '');
    remaining = remaining.replace(vMatch[0], '').trim();
  }

  // Remaining words could be [model] and [color]
  // Colors commonly appear at the end: Ice Blue, Green, Midnight Black, etc.
  const KNOWN_COLORS = [
    'ice blue', 'green', 'black', 'blue', 'white', 'red', 'gold',
    'silver', 'purple', 'violet', 'orange', 'yellow', 'grey', 'gray',
    'midnight black', 'starlight', 'space grey', 'rose gold', 'deep purple',
    'emerald green', 'forest green', 'ocean blue', 'sky blue'
  ];

  let color = null;
  const lowerRemaining = remaining.toLowerCase();
  for (const c of KNOWN_COLORS) {
    if (lowerRemaining.endsWith(c)) {
      color = remaining.slice(remaining.length - c.length).trim();
      remaining = remaining.slice(0, remaining.length - c.length).trim();
      break;
    }
  }

  const model = remaining.trim() || null;

  return {
    brand: brand || null,
    model: model || null,
    variant: variant || null,
    color: color || null,
  };
}

