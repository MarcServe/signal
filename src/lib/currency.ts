/** All customer-facing prices use GBP. DB amounts stay as integer minor units (pence). */

const LOCALE = 'en-GB'

export function formatGbp(pence: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pence / 100)
}

/** For tip presets etc. where whole pounds look cleaner. */
export function formatGbpWhole(pence: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pence / 100)
}
