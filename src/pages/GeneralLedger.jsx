import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Select, MenuItem, ListSubheader, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Alert, Chip, TextField, Button } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { api, saveBlob } from '../lib/api';
import Money from '../components/Money';

export default function GeneralLedger() {
  const { data: accounts, isLoading: loadingAccounts } = useQuery({ queryKey: ['account-options'], queryFn: () => api.get('/accounts/options') });
  const [accountId, setAccountId] = useState('');
  const [from, setFrom] = useState('');
  const [till, setTill] = useState('');

  const grouped = useMemo(() => {
    if (!accounts) return {};
    const byHeading = {};
    for (const a of accounts) (byHeading[`${a.category}: ${a.heading}`] ||= []).push(a);
    return byHeading;
  }, [accounts]);

  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (till) query.set('till', till);
  const qs = query.toString();

  const { data: ledger, isLoading: loadingLedger, error } = useQuery({
    queryKey: ['ledger', accountId, from, till],
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

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>General Ledger</Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
        <Select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          displayEmpty
          size="small"
          sx={{ minWidth: 280 }}
        >
          <MenuItem value="" disabled>Select an account…</MenuItem>
          {Object.entries(grouped).map(([heading, accs]) => [
            <ListSubheader key={heading}>{heading}</ListSubheader>,
            ...accs.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>),
          ])}
        </Select>
        <TextField size="small" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="date" label="Till" value={till} onChange={(e) => setTill(e.target.value)} InputLabelProps={{ shrink: true }} />
        {accountId && (
          <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={downloadPdf} disabled={!ledger}>
            Download PDF
          </Button>
        )}
      </Box>

      {!accountId && <Typography variant="body2" color="text.secondary">Choose an account to view its ledger. Leave From/Till blank to see everything.</Typography>}
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
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
