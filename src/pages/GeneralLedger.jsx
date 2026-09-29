import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Select, MenuItem, ListSubheader, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Alert, Chip } from '@mui/material';
import { api } from '../lib/api';
import Money from '../components/Money';

export default function GeneralLedger() {
  const { data: accounts, isLoading: loadingAccounts } = useQuery({ queryKey: ['account-options'], queryFn: () => api.get('/accounts/options') });
  const [accountId, setAccountId] = useState('');

  const grouped = useMemo(() => {
    if (!accounts) return {};
    const byHeading = {};
    for (const a of accounts) (byHeading[`${a.category}: ${a.heading}`] ||= []).push(a);
    return byHeading;
  }, [accounts]);

  const { data: ledger, isLoading: loadingLedger, error } = useQuery({
    queryKey: ['ledger', accountId],
    queryFn: () => api.get(`/ledger/${accountId}`),
    enabled: !!accountId,
  });

  if (loadingAccounts) return <CircularProgress size={24} />;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>General Ledger</Typography>

      <Select
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        displayEmpty
        size="small"
        sx={{ minWidth: 320, mb: 3 }}
      >
        <MenuItem value="" disabled>Select an account…</MenuItem>
        {Object.entries(grouped).map(([heading, accs]) => [
          <ListSubheader key={heading}>{heading}</ListSubheader>,
          ...accs.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>),
        ])}
      </Select>

      {!accountId && <Typography variant="body2" color="text.secondary">Choose an account to view its ledger.</Typography>}
      {error && <Alert severity="error">{error.message}</Alert>}
      {loadingLedger && <CircularProgress size={24} />}

      {ledger && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {ledger.account.name}{' '}
            <Typography component="span" variant="body2" color="text.secondary">
              — Balance: <Money value={ledger.closingBalance} />
            </Typography>
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Memo / Reference</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Debit</TableCell>
                <TableCell align="right">Credit</TableCell>
                <TableCell align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} sx={{ opacity: 0.6 }}>Opening Balance</TableCell>
                <TableCell align="right" sx={{ opacity: 0.6 }}><Money value={ledger.openingBalance} /></TableCell>
              </TableRow>
              {ledger.entries.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ fontStyle: 'italic', opacity: 0.6 }}>No entries posted to this account yet.</TableCell></TableRow>
              ) : (
                ledger.entries.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>
                      {e.memo}{' '}
                      {e.reference && <Chip label={e.reference} size="small" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: 11 }} />}
                    </TableCell>
                    <TableCell>{e.source}</TableCell>
                    <TableCell align="right">{e.debit > 0 && <Money value={e.debit} />}</TableCell>
                    <TableCell align="right">{e.credit > 0 && <Money value={e.credit} />}</TableCell>
                    <TableCell align="right"><Money value={e.runningBalance} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
