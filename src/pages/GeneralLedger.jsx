import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Autocomplete, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Alert, Chip, TextField, Button, FormControlLabel, Switch, IconButton, Tooltip, Checkbox } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartIcon from '@mui/icons-material/TableChartOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import PrintIcon from '@mui/icons-material/PrintOutlined';
import { api, saveBlob } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

export default function GeneralLedger() {
  const { profile } = useAuth();
  const canDelete = hasRole(profile, 'admin');
  const qc = useQueryClient();
  const { data: accounts, isLoading: loadingAccounts } = useQuery({ queryKey: ['account-options'], queryFn: () => api.get('/accounts/options') });
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [from, setFrom] = useState('');
  const [till, setTill] = useState('');
  const [showAllYears, setShowAllYears] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [bulkActionError, setBulkActionError] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef(null);

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-options'] });
      setSelectedAccount(null);
      setDeleteError('');
    },
    onError: (err) => setDeleteError(err.message),
  });

  const accountId = selectedAccount?.id || '';

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

  const downloadPdf = async (targetAccountId) => {
    try {
      const id = targetAccountId || accountId;
      if (!id) return;
      const blob = await api.blob(`/ledger/${id}/pdf${qs ? `?${qs}` : ''}`);
      const acc = accounts?.find(a => a.id === id);
      const accName = (acc?.name || (ledger && ledger.account.id === id ? ledger.account.name : 'account')).replace(/[^A-Za-z0-9._-]/g, '_');

      let invoicePrefix = '';
      if (ledger && ledger.account.id === id) {
        const invoiceRef = ledger.entries.find(e => e.reference)?.reference || '';
        if (invoiceRef) {
          invoicePrefix = invoiceRef.replace(/[^A-Za-z0-9._-]/g, '_') + '-';
        }
      }
      saveBlob(blob, `${invoicePrefix}${accName}.pdf`);
    } catch (err) { alert(err.message); }
  };

  const downloadXlsx = async (targetAccountId) => {
    try {
      const exportQs = new URLSearchParams();
      if (targetAccountId) exportQs.set('accountId', targetAccountId);
      if (from) exportQs.set('from', from);
      if (till) exportQs.set('till', till);
      if (showAllYears && !from) exportQs.set('allYears', 'true');
      const eqs = exportQs.toString();

      const blob = await api.blob(`/ledger/export${eqs ? `?${eqs}` : ''}`);
      const acc = accounts?.find(a => a.id === targetAccountId);
      const filename = targetAccountId && targetAccountId !== 'all' && acc
        ? `ledger-${acc.name.replace(/[^A-Za-z0-9._-]/g, '_')}.xlsx`
        : 'general-ledger-all-accounts.xlsx';
      saveBlob(blob, filename);
    } catch (err) { alert(err.message); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      setImportStatus('Importing entries...');
      const res = await api.post('/ledger/import', formData);
      setImportStatus(`Successfully imported ${res.importedCount} entries from Excel! Accounts created automatically if missing.`);
      qc.invalidateQueries({ queryKey: ['account-options'] });
      qc.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      if (accountId) {
        qc.invalidateQueries({ queryKey: ['ledger', accountId] });
      }
    } catch (err) {
      setImportStatus(`Import failed: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedAccountIds((accounts || []).map(a => a.id));
    } else {
      setSelectedAccountIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedAccountIds.length} selected accounts? Only accounts with no transactions will be deleted.`)) return;
    setBulkActionError('');
    let failedCount = 0;
    for (const id of selectedAccountIds) {
      try {
        await api.del(`/accounts/${id}`);
      } catch (err) {
        failedCount++;
      }
    }
    qc.invalidateQueries({ queryKey: ['account-options'] });
    qc.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    setSelectedAccountIds([]);
    if (failedCount > 0) {
      setBulkActionError(`Some accounts could not be deleted because they have transactions or are system accounts.`);
    }
  };

  const handleBulkExportXlsx = async () => {
    try {
      const exportQs = new URLSearchParams();
      if (from) exportQs.set('from', from);
      if (till) exportQs.set('till', till);
      if (showAllYears && !from) exportQs.set('allYears', 'true');
      const eqs = exportQs.toString();

      const blob = await api.blob(`/ledger/export${eqs ? `?${eqs}` : ''}`);
      saveBlob(blob, 'general-ledger-bulk-export.xlsx');
    } catch (err) { alert(err.message); }
  };

  const handleBulkPrintPdf = async () => {
    for (const id of selectedAccountIds) {
      await downloadPdf(id);
    }
  };

  if (loadingAccounts) return <CircularProgress size={24} />;

  const periodLabel = from || till
    ? `${from || 'start'} to ${till || 'present'}`
    : (showAllYears ? 'All years' : 'Current fiscal year');

  const allSelected = accounts && accounts.length > 0 && selectedAccountIds.length === accounts.length;
  const someSelected = selectedAccountIds.length > 0 && !allSelected;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">General Ledger</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <input
            type="file"
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            Import XLSX
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TableChartIcon />}
            onClick={() => downloadXlsx('all')}
          >
            Export All (XLSX)
          </Button>
          {accountId && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<TableChartIcon />}
              onClick={() => downloadXlsx(accountId)}
            >
              Export Account (XLSX)
            </Button>
          )}
        </Box>
      </Box>

      {importStatus && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setImportStatus('')}>{importStatus}</Alert>}

      {/* Bulk Action Toolbar when accounts are selected */}
      {selectedAccountIds.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1.5, mb: 2, bgcolor: 'action.selected', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selectedAccountIds.length} account{selectedAccountIds.length === 1 ? '' : 's'} selected
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleBulkPrintPdf}
          >
            Download PDFs
          </Button>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            startIcon={<TableChartIcon />}
            onClick={handleBulkExportXlsx}
          >
            Export Selected (XLSX)
          </Button>
          {canDelete && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
            >
              Delete Selected
            </Button>
          )}
          <Button size="small" onClick={() => setSelectedAccountIds([])}>
            Deselect All
          </Button>
        </Box>
      )}

      {bulkActionError && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setBulkActionError('')}>{bulkActionError}</Alert>}

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
            <TextField {...params} placeholder="Search or select account..." label="Account" />
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
          <>
            <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={() => downloadPdf(accountId)} disabled={!ledger}>
              Download PDF
            </Button>
            {canDelete && ledger && !ledger.account.is_system && (
              <Tooltip title="Delete account (only if no transactions)">
                <IconButton
                  size="small"
                  color="error"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete account "${ledger.account.name}"? This cannot be undone.`)) {
                      deleteMutation.mutate(ledger.account.id);
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
      </Box>

      {/* Account selection list table with circular checkboxes */}
      <Typography variant="h6" sx={{ mb: 1 }}>Account Selection & Quick List</Typography>
      <Box sx={{ maxHeight: 240, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 3 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={handleSelectAll}
                  inputProps={{ 'aria-label': 'select all accounts' }}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Account Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Heading</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(accounts || []).map((acc) => {
              const isSelected = selectedAccountIds.includes(acc.id);
              return (
                <TableRow key={acc.id} hover selected={isSelected}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(acc.id)}
                      inputProps={{ 'aria-labelledby': `account-checkbox-${acc.id}` }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ cursor: 'pointer', color: selectedAccount?.id === acc.id ? 'primary.main' : 'text.primary', fontWeight: selectedAccount?.id === acc.id ? 600 : 400 }}
                      onClick={() => setSelectedAccount(acc)}
                    >
                      {acc.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{acc.category}</TableCell>
                  <TableCell>{acc.heading}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant={selectedAccount?.id === acc.id ? 'contained' : 'text'}
                      onClick={() => setSelectedAccount(acc)}
                    >
                      View Ledger
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {!accountId && <Typography variant="body2" color="text.secondary">Choose an account above or select multiple accounts using checkboxes for bulk actions.</Typography>}
      {deleteError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeleteError('')}>{deleteError}</Alert>}
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
