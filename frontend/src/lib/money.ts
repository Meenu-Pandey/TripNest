import type { MoneyDTO, SupportedCurrency } from '@/types/trips';

const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const CURRENCY_EXPONENT: Record<SupportedCurrency, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
};

/**
 * Returns the symbol for a given currency code.
 */
export function getCurrencySymbol(currency: SupportedCurrency): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/**
 * Converts minor units (string of digits, e.g. "12500" paise) to a human floating number (125.00).
 */
export function minorToMajor(
  amountMinor: string | bigint | number,
  currency: SupportedCurrency = 'INR',
): number {
  const exp = CURRENCY_EXPONENT[currency] ?? 2;
  const factor = Math.pow(10, exp);
  const minor = typeof amountMinor === 'bigint' ? Number(amountMinor) : Number(amountMinor);
  if (isNaN(minor)) return 0;
  return minor / factor;
}

/**
 * Converts human major units (e.g. 125.50) into exact integer minor string ("12550").
 */
export function majorToMinor(
  amountMajor: number | string,
  currency: SupportedCurrency = 'INR',
): string {
  const exp = CURRENCY_EXPONENT[currency] ?? 2;
  const num = typeof amountMajor === 'string' ? parseFloat(amountMajor) : amountMajor;
  if (isNaN(num) || num < 0) return '0';
  const factor = Math.pow(10, exp);
  return Math.round(num * factor).toString();
}

/**
 * Formats a MoneyDTO into localized display text (e.g. "₹1,250.00" or "$45.00").
 */
export function formatMoney(
  money: MoneyDTO | { amountMinor: string; currency: SupportedCurrency } | null | undefined,
  options: { showCode?: boolean; showSymbol?: boolean } = { showSymbol: true },
): string {
  if (!money) return '—';

  const major = minorToMajor(money.amountMinor, money.currency);
  const symbol = getCurrencySymbol(money.currency);

  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);

  if (options.showCode) {
    return `${symbol}${formattedNumber} ${money.currency}`;
  }

  if (options.showSymbol !== false) {
    return `${symbol}${formattedNumber}`;
  }

  return formattedNumber;
}
