/**
 * Indian currency number-to-words converter:
 * Handles:
 * - Crores, Lakhs, Thousands, Hundreds, Tens, Ones
 * - Paise decimal handling (e.g. 50 paise)
 * - Indian formatting: "INR Twelve Lakh Twenty Thousand One Hundred Ten and Fifty paise Only"
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertLessThanThousand(n) {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred';
    n %= 100;
    if (n > 0) str += ' ';
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)];
    n %= 10;
    if (n > 0) str += ' ' + ONES[n];
  } else if (n > 0) {
    str += ONES[n];
  }
  return str.trim();
}

/**
 * Convert a positive integer to Indian words.
 */
function integerToIndianWords(num) {
  if (num === 0) return 'Zero';

  const parts = [];

  // Crores (10,000,000)
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  if (crore > 0) {
    parts.push(convertLessThanThousand(crore) + ' Crore');
  }

  // Lakhs (100,000)
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  if (lakh > 0) {
    parts.push(convertLessThanThousand(lakh) + ' Lakh');
  }

  // Thousands (1,000)
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  if (thousand > 0) {
    parts.push(convertLessThanThousand(thousand) + ' Thousand');
  }

  // Hundreds, Tens, Ones
  if (num > 0) {
    parts.push(convertLessThanThousand(num));
  }

  return parts.join(' ').trim();
}

/**
 * Convert an amount in Rupees (and optional paise) to words.
 * Examples:
 * - 0 => "INR Zero Only"
 * - 1 => "INR One Only"
 * - 99 => "INR Ninety Nine Only"
 * - 100 => "INR One Hundred Only"
 * - 1000 => "INR One Thousand Only"
 * - 100000 => "INR One Lakh Only"
 * - 1220110.50 => "INR Twelve Lakh Twenty Thousand One Hundred Ten and Fifty paise Only"
 *
 * @param {number|string} amount
 * @returns {string}
 */
export function amountInWords(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount || 0);
  if (isNaN(num)) return 'INR Zero Only';

  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
  const isNegative = rounded < 0;
  const abs = Math.abs(rounded);

  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  const rupeeWords = integerToIndianWords(rupees);
  let result = `INR ${isNegative ? 'Minus ' : ''}${rupeeWords}`;

  if (paise > 0) {
    const paiseWords = convertLessThanThousand(paise);
    result += ` and ${paiseWords} paise`;
  }

  result += ' Only';
  return result;
}

