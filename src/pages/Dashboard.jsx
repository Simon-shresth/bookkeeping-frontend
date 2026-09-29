import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Paper, Grid, Table, TableHead, TableRow, TableCell, TableBody, Chip, CircularProgress, Alert } from '@mui/material';
import { api } from '../lib/api';
import Money from '../components/Money';

function StatCard({ label, value, tone }) {
  const color = tone === 'good' ? 'primary.main' : tone === 'bad' ? 'error.main' : undefined;
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ mt: 0.5 }}><Money value={value} color={color} /></Typography>
    </Paper>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard') });

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  const { totals, lowStock, recentTransactions } = data;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Dashboard</Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item><StatCard label="Revenue" value={totals.revenue} tone="good" /></Grid>
        <Grid item><StatCard label="Cost of Goods Sold" value={totals.cogs} tone="bad" /></Grid>
        <Grid item><StatCard label="Expenses" value={totals.expenseTotal} tone="bad" /></Grid>
        <Grid item><StatCard label="Net Profit" value={totals.profit} tone={totals.profit >= 0 ? 'good' : 'bad'} /></Grid>
        <Grid item><StatCard label="Accounts Receivable" value={totals.ar} /></Grid>
        <Grid item><StatCard label="Accounts Payable" value={totals.ap} /></Grid>
      </Grid>

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
