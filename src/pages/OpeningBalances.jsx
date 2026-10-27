import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete,
  Alert, CircularProgress, IconButton, Chip, Link, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

// Opening Balances: entered once when a company migrates to this system mid-year.
// Each balance is journaled against Retained Earnings to preserve double-entry integrity.
// Accountants only. Amounts follow normal balance convention:
//   positive = debit-normal accounts (Assets, Expenses) have a debit balance
//   positive = credit-normal accounts (Liabilities, Equity, Income) have a credit balance
//   negative = opposite-side balance (e.g. an asset with a credit balance = contra asset)

export default function OpeningBalances() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'accountant');
  const qc = useQueryClient();

  const { data: balances, isLoading: loadingBalances, error } = useQuery({
    queryKey: ['opening-balances'],
    queryFn: () => api.get('/opening-balances'),
  });
  const { data: accounts } = useQuery({
    queryKey: ['account-options'],
    queryFn: () => api.get('/accounts/options'),
  });

  const [open, setOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);
  const fileInputRef = useRef(null);

  // Exclude accounts that already have an opening balance (unless editing)
  const existingAccountIds = useMemo(() => new Set((balances || []).map((b) => b.account_id)), [balances]);
  const availableAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((a) => !existingAccountIds.has(a.id));
  }, [accounts, existingAccountIds]);

  const openNew = () => { setSelectedAccount(null); setAmount(''); setDate(new Date().toISOString().slice(0, 10)); setOpen(true); };

  const saveMutation = useMutation({
    mutationFn: (body) => api.post('/opening-balances', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['opening-balances'] }); setOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (accountId) => api.del(`/opening-balances/${accountId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opening-balances'] }),
    onError: (err) => alert(err.message),
  });

  const importMutation = useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append('file', file);
      return api.post('/opening-balances/bulk-import', form);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['opening-balances'] });
      setImportError(null);
      setImportSuccess(`Imported ${data.imported} opening balance${data.imported !== 1 ? 's' : ''}.`);
    },
    onError: (err) => {
      setImportSuccess(null);
      setImportError(err.message);
    },
  });

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) importMutation.mutate(file);
    event.target.value = '';
  };

  const handleDownloadTemplate = async () => {
    const response = await api.get('/opening-balances/template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'opening-balances-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const submit = () => {
    if (!selectedAccount || amount === '') return;
    saveMutation.mutate({ accountId: selectedAccount.id, amount: Number(amount), date });
  };

  const totalDebit = (balances || [])
    .filter((b) => ['Assets', 'Expenses'].includes(b.category) ? Number(b.amount) > 0 : Number(b.amount) < 0)
    .reduce((s, b) => s + Math.abs(Number(b.amount)), 0);
  const totalCredit = (balances || [])
    .filter((b) => ['Assets', 'Expenses'].includes(b.category) ? Number(b.amount) < 0 : Number(b.amount) > 0)
    .reduce((s, b) => s + Math.abs(Number(b.amount)), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  if (loadingBalances) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4">Opening Balances</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {canEdit && (
            <>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
              >
                Download Template
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? 'Importing…' : 'Import CSV/Excel'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add Balance</Button>
            </>
          )}
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter starting balances for accounts when migrating to this system mid-year.
        Each balance is posted as a journal entry against Retained Earnings to keep the books balanced.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Import format (CSV or Excel):</strong> The file must have a header row with these columns —{' '}
        <strong>Account Name</strong>, <strong>Heading</strong>, <strong>Amount</strong>, <strong>Date</strong> (YYYY-MM-DD).
        {' '}Positive amounts = normal balance side; negative = contra.{' '}
        If an account doesn't exist, it is created automatically under the appropriate category based on its heading.{' '}
        <Link href="#" onClick={(e) => { e.preventDefault(); handleDownloadTemplate(); }}>Download a template CSV</Link>.
      </Alert>

      {importError && <Alert severity="error" onClose={() => setImportError(null)} sx={{ mb: 2 }}>{importError}</Alert>}
      {importSuccess && <Alert severity="success" onClose={() => setImportSuccess(null)} sx={{ mb: 2 }}>{importSuccess}</Alert>}

      <Snackbar
        open={Boolean(importError || importSuccess)}
        autoHideDuration={4000}
        onClose={() => {
          setImportError(null);
          setImportSuccess(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => {
            setImportError(null);
            setImportSuccess(null);
          }}
          severity={importError ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {importError || importSuccess}
        </Alert>
      </Snackbar>

      {balances.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No opening balances set.</Typography>
      ) : (
        <>
          <Table size="small" sx={{ maxWidth: 720, mb: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>Account</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                {canEdit && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {balances.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.account_name}</TableCell>
                  <TableCell>
                    <Chip label={`${b.category}: ${b.heading}`} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                  </TableCell>
                  <TableCell>{b.date}</TableCell>
                  <TableCell align="right"><Money value={b.amount} /></TableCell>
                  {canEdit && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => deleteMutation.mutate(b.account_id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography
            variant="body2"
            sx={{ color: balanced ? 'primary.main' : 'error.main', mb: 0.5 }}
          >
            {balanced
              ? '✓ Opening balances are balanced.'
              : `⚠ Out of balance by ${Math.abs(totalDebit - totalCredit).toFixed(2)} — the Retained Earnings account absorbs the difference automatically.`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Total debit-side: <Money value={totalDebit} /> · Total credit-side: <Money value={totalCredit} />
          </Typography>
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Opening Balance</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          <Autocomplete
            size="small"
            options={availableAccounts}
            groupBy={(o) => `${o.category}: ${o.heading}`}
            getOptionLabel={(o) => o.name || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            value={selectedAccount}
            onChange={(_, v) => setSelectedAccount(v)}
            renderInput={(params) => <TextField {...params} label="Account" placeholder="Search account…" />}
          />
          <TextField
            label="Amount"
            type="number"
            size="small"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            helperText="Positive = normal balance side. Negative = contra (e.g. accumulated depreciation)."
            fullWidth
          />
          <TextField
            label="As-at Date"
            type="date"
            size="small"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!selectedAccount || amount === '' || saveMutation.isPending}
            onClick={submit}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
