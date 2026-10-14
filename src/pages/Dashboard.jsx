import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Paper, Grid, Table, TableHead, TableRow, TableCell, TableBody, Chip, CircularProgress, Alert } from '@mui/material';
import { api } from '../lib/api';
import Money from '../components/Money';

function pct(numerator, denominator) {
  if (!denominator || denominator === 0) return null;
  return ((numerator / denominator) * 100).toFixed(1);
}

function StatCard({ label, value, tone, subtitle }) {
  const color = tone === 'good' ? 'primary.main' : tone === 'bad' ? 'error.main' : undefined;
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ mt: 0.5 }}><Money value={value} color={color} /></Typography>
      {subtitle && (
        <Typography variant="caption" color={tone === 'bad' ? 'error.main' : 'text.secondary'}>
          {subtitle}
        </Typography>
      )}
    </Paper>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard') });

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  const { totals, lowStock, recentTransactions, loanAgeing = [] } = data;

  const grossProfit = totals.revenue - totals.cogs;
  const grossMarginPct = pct(grossProfit, totals.revenue);
  const expensePct = pct(totals.expenseTotal, totals.revenue);
  const netProfitPct = pct(totals.profit, totals.revenue);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Dashboard</Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item><StatCard label="Revenue" value={totals.revenue} tone="good" /></Grid>
        <Grid item><StatCard label="Cost of Goods Sold" value={totals.cogs} tone="bad" subtitle={pct(totals.cogs, totals.revenue) != null ? `${pct(totals.cogs, totals.revenue)}% of revenue` : null} /></Grid>
        <Grid item><StatCard label="Gross Profit" value={grossProfit} tone={grossProfit >= 0 ? 'good' : 'bad'} subtitle={grossMarginPct != null ? `${grossMarginPct}% margin` : null} /></Grid>
        <Grid item><StatCard label="Expenses" value={totals.expenseTotal} tone="bad" subtitle={expensePct != null ? `${expensePct}% of revenue` : null} /></Grid>
        <Grid item><StatCard label="Net Profit" value={totals.profit} tone={totals.profit >= 0 ? 'good' : 'bad'} subtitle={netProfitPct != null ? `${netProfitPct}% margin` : null} /></Grid>
        <Grid item><StatCard label="Accounts Receivable" value={totals.ar} /></Grid>
        <Grid item><StatCard label="Accounts Payable" value={totals.ap} /></Grid>
      </Grid>

      {/* ── Loan Ageing ─────────────────────────────────────────────────── */}
      <Typography variant="h6" sx={{ mb: 1 }}>Loan Ageing</Typography>
      {loanAgeing.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          No loans on record.
        </Typography>
      ) : (
        <Table size="small" sx={{ mb: 4 }}>
          <TableHead>
            <TableRow>
              <TableCell>Account / Lender</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell align="right">Interest Rate</TableCell>
              <TableCell align="right">Principal</TableCell>
              <TableCell align="right">Outstanding Balance</TableCell>
              <TableCell align="right">Days Active</TableCell>
              <TableCell align="center">Age Bracket</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loanAgeing.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>{l.account_name}</Typography>
                  {l.lender_name && l.lender_name !== l.account_name && (
                    <Typography variant="caption" color="text.secondary">{l.lender_name}</Typography>
                  )}
                </TableCell>
                <TableCell>{l.start_date || '—'}</TableCell>
                <TableCell align="right">{l.interest_rate != null ? `${l.interest_rate}%` : '—'}</TableCell>
                <TableCell align="right">{l.principal != null ? <Money value={l.principal} /> : '—'}</TableCell>
                <TableCell align="right">
                  <Money value={l.balance} bold color={l.balance > 0 ? 'error.main' : undefined} />
                </TableCell>
                <TableCell align="right">{l.days_outstanding != null ? l.days_outstanding : '—'}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={l.bucket}
                    size="small"
                    variant="outlined"
                    color={
                      l.bucket === '0-90 days' ? 'success' :
                      l.bucket === '91-180 days' ? 'warning' :
                      'error'
                    }
                    sx={{ fontSize: 11 }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>Inventory Alerts</Typography>
      {lowStock.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>No products below minimum stock.</Typography>
      ) : (
        <Table size="small" sx={{ mb: 4 }}>
          <TableHead><TableRow><TableCell>Product</TableCell><TableCell align="right">Stock</TableCell><TableCell align="right">Min. Stock</TableCell></TableRow></TableHead>
          <TableBody>
            {lowStock.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell align="right"><Chip label={p.stock} size="small" color="error" variant="outlined" /></TableCell>
                <TableCell align="right">{p.min_stock}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>Recent Transactions</Typography>
      {recentTransactions.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No transactions recorded yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Party</TableCell><TableCell>Invoice #</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
          <TableBody>
            {recentTransactions.map((t, i) => (
              <TableRow key={i}>
                <TableCell>{t.date}</TableCell>
                <TableCell>{t.kind}</TableCell>
                <TableCell>{t.party}</TableCell>
                <TableCell>{t.invoice_number || ''}</TableCell>
                <TableCell align="right"><Money value={t.amount} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
