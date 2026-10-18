import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Autocomplete, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Alert, Chip, TextField, Button, FormControlLabel, Switch } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { api, saveBlob } from '../lib/api';
import Money from '../components/Money';

export default function GeneralLedger() {
  const { data: accounts, isLoading: loadingAccounts } = useQuery({ queryKey: ['account-options'], queryFn: () => api.get('/accounts/options') });
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [from, setFrom] = useState('');
  const [till, setTill] = useState('');
  const [showAllYears, setShowAllYears] = useState(false);

  const accountId = selectedAccount?.id || '';

  // Build query string. When the user hasn't set a custom from/till, we send
  // allYears=true/false so the backend can default to the current fiscal year.
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (till) query.set('till', till);
  if (showAllYears && !from) query.set('allYears', 'true');
  const qs = query.toString();

  const { data: ledger, isLoading: loadingLedger, error } = useQuery({
    queryKey: ['ledger', accountId, from, till, showAllYears],
    queryFn: () => api.get(`/ledger/${accountId}${qs ? `?${qs}` : ''}`),
    enabled: !!accountId,
  });

  const downloadPdf = async () => {
    try {
      const blob = await api.blob(`/ledger/${accountId}/pdf${qs ? `?${qs}` : ''}`);
      saveBlob(blob, `ledger-${ledger.account.name.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`);
    } catch (err) { alert(err.message); }
  };

  if (loadingAccounts) return <CircularProgress size={24} />;

  const periodLabel = from || till
    ? `${from || 'start'} to ${till || 'present'}`
    : (showAllYears ? 'All years' : 'Current fiscal year');

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>General Ledger</Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
        <Autocomplete
          size="small"
          options={accounts || []}
          groupBy={(option) => `${option.category}: ${option.heading}`}
          getOptionLabel={(option) => option.name || ''}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          value={selectedAccount}
          onChange={(_, newValue) => setSelectedAccount(newValue)}
          renderInput={(params) => (
            <TextField {...params} placeholder="Search or select account…" label="Account" />
          )}
          sx={{ minWidth: 320 }}
        />
        <TextField size="small" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="date" label="Till" value={till} onChange={(e) => setTill(e.target.value)} InputLabelProps={{ shrink: true }} />
        <FormControlLabel
          control={<Switch size="small" checked={showAllYears} onChange={(e) => setShowAllYears(e.target.checked)} disabled={!!from} />}
          label="Show all years"
        />
        {accountId && (
          <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={downloadPdf} disabled={!ledger}>
            Download PDF
          </Button>
        )}
      </Box>

      {!accountId && <Typography variant="body2" color="text.secondary">Choose an account to view its ledger. By default only the current fiscal year is shown — toggle “Show all years” to see prior-year history.</Typography>}
      {error && <Alert severity="error">{error.message}</Alert>}
      {loadingLedger && <CircularProgress size={24} />}

      {ledger && (
        <Box>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            {ledger.account.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Period: {periodLabel} · Closing Balance: <Money value={ledger.closingBalance} bold />
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
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell colSpan={5} sx={{ fontWeight: 600 }}>Opening Balance (as of {ledger.from || 'start'})</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}><Money value={ledger.openingBalance} /></TableCell>
              </TableRow>
              {ledger.entries.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ fontStyle: 'italic', opacity: 0.6 }}>No entries posted to this account in this period.</TableCell></TableRow>
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
              <TableRow sx={{ '& td': { fontWeight: 600, borderTop: '2px solid', borderColor: 'divider' } }}>
                <TableCell colSpan={5}>Closing Balance</TableCell>
                <TableCell align="right"><Money value={ledger.closingBalance} bold /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
