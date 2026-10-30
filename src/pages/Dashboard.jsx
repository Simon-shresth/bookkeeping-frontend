import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Chip, CircularProgress, Alert, Tabs, Tab, Card, CardContent, Divider, Button } from '@mui/material';
import { api } from '../lib/api';
import Money from '../components/Money';

function formatMonthKey(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function KeyFiguresTable({ figures, isMonthly, fyLabel }) {
  const [visibleMonths, setVisibleMonths] = useState(() => {
    // Will be updated in effect once we know allMonths length
    return 3;
  });
  useEffect(() => {
    if (isMonthly) {
      const allMonths = Object.keys(figures).sort().reverse();
      setVisibleMonths(Math.min(3, allMonths.length));
    }
  }, [isMonthly, figures]);
  const metrics = [
    { key: 'cashSales', label: 'Only Cash Sales', tone: 'good' },
    { key: 'partialCashSales', label: 'Partial Cash Sales', tone: 'good' },
    { key: 'creditSales', label: 'Credit Sales + Partial Credit Sales', tone: 'good' },
    { key: 'paymentReceived', label: 'Payment Received', tone: 'good' },
    { key: 'expenses', label: 'Expenses', tone: 'bad' },
    { key: 'accountsPayable', label: 'Accounts Payable', tone: 'neutral' },
    { key: 'accountsReceivable', label: 'Accounts Receivable', tone: 'neutral' },
    { key: 'grossProfit', label: 'Gross Profit', tone: 'good' },
    { key: 'netProfit', label: 'Net Profit', tone: 'good' },
    { key: 'costOfGoodsSold', label: 'Cost of Goods Sold', tone: 'bad' },
  ];

  if (isMonthly) {
    const allMonths = Object.keys(figures).sort().reverse(); // Latest first
    console.log('DEBUG KeyFiguresTable figures:', figures);
    console.log('DEBUG KeyFiguresTable allMonths:', allMonths);
    const shownMonths = allMonths.slice(0, visibleMonths);
    console.log('DEBUG KeyFiguresTable shownMonths:', shownMonths);
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Typography variant="h6">Monthly Key Figures (by B.S. Month)</Typography>
          {allMonths.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setVisibleMonths(v => Math.min(v + 3, allMonths.length))}
              disabled={visibleMonths >= allMonths.length}
            >
              Show Previous Months ({Math.min(visibleMonths, allMonths.length)} of {allMonths.length})
            </Button>
          )}
        </Box>
        <Box sx={{ width: '100%', overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small" sx={{ minWidth: Math.max(400, 200 + (shownMonths.length * 150)) }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.selected' }}>
                <TableCell sx={{ fontWeight: 'bold', width: 200 }}>Metric</TableCell>
                {shownMonths.map(m => (
                  <TableCell key={m} align="right" sx={{ fontWeight: 'bold', borderLeft: '1px solid', borderColor: 'divider' }}>
                    {formatMonthKey(m)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {metrics.map((metric) => {
                const values = shownMonths.map(m => figures[m]?.[metric.key] || 0);
                const tone = metric.tone === 'good' ? 'primary.main' : metric.tone === 'bad' ? 'error.main' : undefined;
                return (
                  <TableRow key={metric.key} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ fontWeight: 500, borderRight: '1px solid', borderColor: 'divider' }}>
                      {metric.label}
                    </TableCell>
                    {values.map((v, i) => (
                      <TableCell key={i} align="right" sx={{ borderLeft: '1px solid', borderColor: 'divider' }}>
                        <Money value={v} color={tone} />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Box>
    );
  }

  // Yearly view
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Yearly Key Figures {fyLabel ? `(${fyLabel})` : '(Fiscal Year to Date)'}
      </Typography>
      <Table size="small" sx={{ mb: 4 }}>
        <TableHead>
          <TableRow>
            <TableCell>Metric</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {metrics.map((metric) => {
            const val = figures[metric.key] || 0;
            const tone = metric.tone === 'good' ? 'primary.main' : metric.tone === 'bad' ? 'error.main' : undefined;
            return (
              <TableRow key={metric.key} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                <TableCell sx={{ fontWeight: 500 }}>{metric.label}</TableCell>
                <TableCell align="right"><Money value={val} color={tone} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState('monthly'); // 'monthly' | 'yearly'
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/dashboard') });

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  const { totals, lowStock, recentTransactions, loanAgeing = [], keyFigures = {} } = data;
  const { monthly = {}, yearly = {} } = keyFigures;

  // Get fiscal year label
  const fyLabel = totals.fiscalYear ? `${totals.fiscalYear.start_date} to ${totals.fiscalYear.end_date}` : null;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Dashboard</Typography>

      {/* Tab Switcher for Key Figures */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Key figures period" sx={{ mb: 2 }}>
            <Tab label="Monthly" value="monthly" />
            <Tab label="Yearly" value="yearly" />
          </Tabs>
          <Divider sx={{ mb: 2 }} />
          {tab === 'monthly' ? (
            <KeyFiguresTable key="monthly" figures={monthly} isMonthly />
          ) : (
            <KeyFiguresTable key="yearly" figures={yearly} isMonthly={false} fyLabel={fyLabel} />
          )}
        </CardContent>
      </Card>

      {/* Loan Ageing */}
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
                <TableCell>{l.taken_date || '—'}</TableCell>
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

      {/* Inventory Alerts */}
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

      {/* Recent Transactions */}
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