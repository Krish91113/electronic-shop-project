/** Round to 2 decimal places using banker's rounding */
export function round2(value) {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/** Convert a Decimal / string to a JS number rounded to 2dp */
export function toMoney(value) {
  if (value === null || value === undefined) return null;
  return round2(value);
}

/** Sum an array of Decimal-ish values */
export function sumMoney(values) {
  return round2(values.reduce((acc, v) => acc + Number(v || 0), 0));
}
