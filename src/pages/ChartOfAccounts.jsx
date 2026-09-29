import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Alert } from '@mui/material';
import { api } from '../lib/api';
import Money from '../components/Money';

export default function ChartOfAccounts() {
  const { data, isLoading, error } = useQuery({ queryKey: ['chart-of-accounts'], queryFn: () => api.get('/accounts') });

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Chart of Accounts</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Read-only. To add a new account, use Journal Entries. Customer and supplier accounts are managed
        automatically from Sales and Purchases.
      </Typography>

      {data.map((group) => (
        <Box key={group.category} sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>{group.category}</Typography>
          {group.headings.map((h) => (
            <Box key={h.heading} sx={{ mb: 2 }}>
              {h.collapsed ? (
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        {h.heading}{' '}
                        <Typography component="span" variant="caption" color="text.secondary">
                          ({h.subAccountCount} {h.heading === 'Accounts Receivable' ? 'customer' : 'supplier'} account{h.subAccountCount === 1 ? '' : 's'} — see General Ledger)
                        </Typography>
                      </TableCell>
                      <TableCell align="right"><Money value={h.balance} /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{h.heading}</Typography>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Account</TableCell><TableCell align="right">Balance</TableCell></TableRow></TableHead>
                    <TableBody>
                      {h.accounts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.name}</TableCell>
                          <TableCell align="right"><Money value={a.balance} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
