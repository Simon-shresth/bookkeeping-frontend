import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Alert, CircularProgress } from '@mui/material';
import { api } from '../lib/api';
import Money from '../components/Money';

const BUCKETS = ['Current', '1-30', '31-60', '61+'];

// Payments received/made are applied to the oldest credit invoices first, so
// what's shown here is what is genuinely still outstanding. Age is measured
// from the invoice date (there are no due dates yet).
function AgingSection({ title, emptyText, partyLabel, partyKey, data, extraCol }) {
  const { rows, buckets } = data;
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>{title}</Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 3, mb: 1.5, flexWrap: 'wrap' }}>
            {BUCKETS.map((b) => (
              <Box key={b}>
                <Typography variant="caption" color="text.secondary">{b === 'Current' ? 'Current' : `${b} days`}</Typography>
                <Typography variant="body2"><Money value={buckets[b]} /></Typography>
              </Box>
            ))}
          </Box>
          <Table size="small" sx={{ maxWidth: 820 }}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell><TableCell>{partyLabel}</TableCell><TableCell>Invoice #</TableCell>
                {extraCol && <TableCell>{extraCol.label}</TableCell>}
                <TableCell align="right">Original</TableCell><TableCell align="right">Outstanding</TableCell>
                <TableCell align="right">Age (days)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.date}</TableCell><TableCell>{row[partyKey]}</TableCell><TableCell>{row.invoice_number}</TableCell>
                  {extraCol && <TableCell>{row[extraCol.key]}</TableCell>}
                  <TableCell align="right"><Money value={row.original} /></TableCell>
                  <TableCell align="right"><Money value={row.outstanding} /></TableCell>
                  <TableCell align="right">{row.age_days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}

export default function Reports() {
  const pl = useQuery({ queryKey: ['report-pl'], queryFn: () => api.get('/reports/profit-and-loss') });
  const bs = useQuery({ queryKey: ['report-bs'], queryFn: () => api.get('/reports/balance-sheet') });
  const ar = useQuery({ queryKey: ['report-ar'], queryFn: () => api.get('/reports/ar-aging') });
  const ap = useQuery({ queryKey: ['report-ap'], queryFn: () => api.get('/reports/ap-aging') });

  if (pl.isLoading || bs.isLoading || ar.isLoading || ap.isLoading) return <CircularProgress size={24} />;
  const err = pl.error || bs.error || ar.error || ap.error;
  if (err) return <Alert severity="error">{err.message}</Alert>;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Reports</Typography>

      <Typography variant="h6" sx={{ mb: 1 }}>Profit &amp; Loss</Typography>
      <Table size="small" sx={{ mb: 4, maxWidth: 480 }}>
        <TableBody>
          <TableRow><TableCell>Sales Revenue</TableCell><TableCell align="right"><Money value={pl.data.revenue} /></TableCell></TableRow>
          <TableRow><TableCell>Cost of Goods Sold</TableCell><TableCell align="right"><Money value={-pl.data.costOfGoodsSold} color="error.main" /></TableCell></TableRow>
          <TableRow><TableCell>Operating Expenses</TableCell><TableCell align="right"><Money value={-pl.data.operatingExpenses} color="error.main" /></TableCell></TableRow>
          <TableRow>
            <TableCell><strong>Net Profit</strong></TableCell>
            <TableCell align="right"><Money value={pl.data.netProfit} bold color={pl.data.netProfit >= 0 ? 'primary.main' : 'error.main'} /></TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Typography variant="h6" sx={{ mb: 1 }}>Balance Sheet</Typography>
      <Table size="small" sx={{ mb: 1, maxWidth: 480 }}>
        <TableBody>
          <TableRow><TableCell colSpan={2}><strong>Assets</strong></TableCell></TableRow>
          {bs.data.assets.map((a) => (
            <TableRow key={a.name}><TableCell sx={{ pl: 3 }}>{a.name}</TableCell><TableCell align="right"><Money value={a.balance} /></TableCell></TableRow>
          ))}
          <TableRow><TableCell><strong>Total Assets</strong></TableCell><TableCell align="right"><Money value={bs.data.totalAssets} bold /></TableCell></TableRow>

          <TableRow><TableCell colSpan={2} sx={{ pt: 2 }}><strong>Liabilities</strong></TableCell></TableRow>
          {bs.data.liabilities.map((a) => (
            <TableRow key={a.name}><TableCell sx={{ pl: 3 }}>{a.name}</TableCell><TableCell align="right"><Money value={a.balance} /></TableCell></TableRow>
          ))}
          <TableRow><TableCell><strong>Total Liabilities</strong></TableCell><TableCell align="right"><Money value={bs.data.totalLiabilities} bold /></TableCell></TableRow>

          <TableRow><TableCell colSpan={2} sx={{ pt: 2 }}><strong>Equity</strong></TableCell></TableRow>
          {bs.data.equityAccounts.map((a) => (
            <TableRow key={a.name}><TableCell sx={{ pl: 3 }}>{a.name}</TableCell><TableCell align="right"><Money value={a.balance} /></TableCell></TableRow>
          ))}
          <TableRow><TableCell sx={{ pl: 3 }}>Current Period Earnings</TableCell><TableCell align="right"><Money value={bs.data.currentEarnings} /></TableCell></TableRow>
          <TableRow><TableCell><strong>Total Equity</strong></TableCell><TableCell align="right"><Money value={bs.data.totalEquity} bold /></TableCell></TableRow>

          <TableRow><TableCell sx={{ pt: 2 }}><strong>Total Liabilities + Equity</strong></TableCell><TableCell align="right" sx={{ pt: 2 }}><Money value={bs.data.totalLiabilities + bs.data.totalEquity} bold /></TableCell></TableRow>
        </TableBody>
      </Table>
      <Typography variant="body2" sx={{ mb: 4, color: bs.data.balanced ? 'primary.main' : 'error.main' }}>
        {bs.data.balanced ? '✓ Balance sheet is balanced.' : '⚠ Out of balance — check journal entries.'}
      </Typography>

      <AgingSection
        title="Accounts Receivable Aging"
        emptyText="No outstanding receivables."
        partyLabel="Customer"
        partyKey="customer"
        data={ar.data}
        extraCol={null}
      />

      <AgingSection
        title="Accounts Payable Aging"
        emptyText="No outstanding payables."
        partyLabel="Supplier"
        partyKey="supplier"
        data={ap.data}
        extraCol={{ label: 'Pragyapan Patra #', key: 'pragyapan_number' }}
      />
    </Box>
  );
}
