/**
 * IMEI utility functions:
 * - Sanitization (strip non-digits)
 * - 15-digit length check
 * - Luhn algorithm checksum validation
 * - Batch validation with duplicate/status tracking
 */

/**
 * Clean an IMEI string by stripping spaces, hyphens, and non-digit characters.
 */
export function cleanImei(imei) {
  if (!imei || typeof imei !== 'string') return '';
  return imei.replace(/\D/g, '').trim();
}

/**
 * Validate an IMEI using the Luhn algorithm.
 * IMEI is 15 digits; the 15th digit is the Luhn check digit.
 * Alternating digits from right-to-left (or odd indices 0-based from left) are doubled.
 */
export function isValidLuhn(imei) {
  const cleaned = cleanImei(imei);
  if (cleaned.length !== 15) return false;

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(cleaned[i], 10);
    // 0-indexed from left: indices 1, 3, 5, 7, 9, 11, 13 are doubled
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Validate a single IMEI.
 * @param {string} imei
 * @param {object} options
 * @param {boolean} options.strict - Whether to enforce Luhn checksum (defaults to env or true)
 * @param {boolean} options.allowLuhnOverride - Explicit override for old/clone devices
 */
export function validateImei(imei, { strict = true, allowLuhnOverride = false } = {}) {
  const isStrict = process.env.IMEI_STRICT_LUHN !== 'false' && strict;
  const cleaned = cleanImei(imei);

  if (!cleaned) {
    return { valid: false, cleaned: '', error: 'IMEI cannot be empty' };
  }

  if (cleaned.length !== 15) {
    if (allowLuhnOverride && cleaned.length >= 6 && cleaned.length <= 20) {
      return { valid: true, cleaned, warning: `Non-standard length (${cleaned.length} digits)` };
    }
    return {
      valid: false,
      cleaned,
      error: `IMEI must be exactly 15 digits (got ${cleaned.length})`,
    };
  }

  if (isStrict && !allowLuhnOverride && !isValidLuhn(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: 'Invalid IMEI checksum (Luhn algorithm check failed)',
    };
  }

  return { valid: true, cleaned };
}

/**
 * Preview / validate a list of IMEI entries for receiving stock.
 * Checks:
 * 1. Format & Luhn validity
 * 2. Duplicates within the provided batch
 * 3. Already existing in the shop database (via passed existingMap/set)
 *
 * @param {Array<{ imei1: string, imei2?: string, serialNumber?: string, chargerNo?: string, purchaseCost?: number, sellingPrice?: number, allowLuhnOverride?: boolean }>} units
 * @param {Map<string, { status: string, invoiceNumber?: string }>} existingImeiMap
 * @param {object} options
 */
export function previewImeiBatch(units, existingImeiMap = new Map(), options = {}) {
  const valid = [];
  const duplicatesInBatch = [];
  const alreadyInShop = [];
  const invalid = [];

  const seenInBatch = new Set();

  for (const [index, unit] of units.entries()) {
    const rawImei = unit.imei1;
    const res = validateImei(rawImei, {
      allowLuhnOverride: Boolean(unit.allowLuhnOverride),
      ...options,
    });

    if (!res.valid) {
      invalid.push({ index, imei1: rawImei, reason: res.error });
      continue;
    }

    const imei1 = res.cleaned;

    // Check imei2 format if present
    let imei2 = null;
    if (unit.imei2) {
      const res2 = validateImei(unit.imei2, {
        allowLuhnOverride: Boolean(unit.allowLuhnOverride),
        ...options,
      });
      if (!res2.valid) {
        invalid.push({ index, imei1, imei2: unit.imei2, reason: `IMEI 2: ${res2.error}` });
        continue;
      }
      imei2 = res2.cleaned;
    }

    // Check duplicate in current batch
    if (seenInBatch.has(imei1) || (imei2 && seenInBatch.has(imei2))) {
      duplicatesInBatch.push({
        index,
        imei1,
        imei2,
        reason: 'Duplicate IMEI in current batch',
      });
      continue;
    }

    seenInBatch.add(imei1);
    if (imei2) seenInBatch.add(imei2);

    // Check already existing in shop
    const existing1 = existingImeiMap.get(imei1);
    const existing2 = imei2 ? existingImeiMap.get(imei2) : null;
    const existing = existing1 || existing2;

    if (existing) {
      alreadyInShop.push({
        index,
        imei1,
        imei2,
        status: existing.status,
        invoiceNumber: existing.invoiceNumber || null,
        reason: `IMEI already exists in shop with status: ${existing.status}${
          existing.invoiceNumber ? ` on invoice ${existing.invoiceNumber}` : ''
        }`,
      });
      continue;
    }

    valid.push({
      index,
      ...unit,
      imei1,
      imei2,
    });
  }

  return {
    valid,
    duplicatesInBatch,
    alreadyInShop,
    invalid,
    summary: {
      total: units.length,
      validCount: valid.length,
      duplicateCount: duplicatesInBatch.length,
      alreadyInShopCount: alreadyInShop.length,
      invalidCount: invalid.length,
    },
  };
}

