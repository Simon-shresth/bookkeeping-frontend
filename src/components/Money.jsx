import { Box } from '@mui/material';
import { moneyFontFamily } from '../theme';

// Nepali (lakh/crore) digit grouping: the last 3 digits as one group, then
// groups of 2 thereafter — e.g. 1234567.89 -> 12,34,567.89. Intl.NumberFormat
// has no built-in locale for this grouping, so it's done by hand.
export function formatNepaliNumber(value, decimals = 2) {
  const num = Number(value || 0);
  const neg = num < 0;
  const fixed = Math.abs(num).toFixed(decimals);
  const [intPartRaw, decPart] = fixed.split('.');
  let result = intPartRaw;
  if (intPartRaw.length > 3) {
    const last3 = intPartRaw.slice(-3);
    let rest = intPartRaw.slice(0, -3);
    const groups = [];
    while (rest.length > 2) { groups.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
    if (rest.length) groups.unshift(rest);
    result = groups.join(',') + ',' + last3;
  }
  return (neg ? '-' : '') + result + (decimals > 0 ? '.' + decPart : '');
}

export function formatMoney(value) {
  return `Rs. ${formatNepaliNumber(value)}`;
}

export default function Money({ value, color, bold }) {
  return (
    <Box component="span" sx={{ fontFamily: moneyFontFamily, color, fontWeight: bold ? 600 : 400 }}>
      {formatMoney(value)}
    </Box>
  );
}
