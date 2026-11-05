// Simple utility to convert AD (YYYY-MM-DD) to approximate BS (Bikram Sambat) string
// and vice versa for dual display throughout the system.
// Note: Nepali calendar runs approximately 56 years and 8.5 months ahead of Gregorian (AD + 56 years, + 8/9 months).
// For comprehensive production precision, we provide dual formatted strings.

export function formatAdBs(dateStr) {
  if (!dateStr) return '';
  // Basic display helper: shows AD and approximate BS representation
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;

  // Approximate BS year conversion:
  // If month is >= 4 (April/May onwards), BS year is AD year + 57. Otherwise AD year + 56.
  // Months shift by ~8-9.
  let bsYear = m >= 4 ? y + 57 : y + 56;
  let bsMonth = (m + 8) % 12;
  if (bsMonth === 0) bsMonth = 12;
  let bsDay = d; // Approximation for dual-label display

  const pad = (n) => String(n).padStart(2, '0');
  const bsString = `${bsYear}-${pad(bsMonth)}-${pad(bsDay)} BS`;

  return `${dateStr} (${bsString})`;
}
