import { Box } from '@mui/material';
import { moneyFontFamily } from '../theme';

const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'NPR', currencyDisplay: 'narrowSymbol' });

export function formatMoney(value) {
  const n = Number(value || 0);
  try {
    return formatter.format(n);
  } catch {
    return `Rs. ${n.toFixed(2)}`;
  }
}

export default function Money({ value, color, bold }) {
  return (
    <Box component="span" sx={{ fontFamily: moneyFontFamily, color, fontWeight: bold ? 600 : 400 }}>
      {formatMoney(value)}
    </Box>
  );
}
