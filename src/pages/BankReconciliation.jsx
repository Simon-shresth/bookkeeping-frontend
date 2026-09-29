import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, TextField, Select, MenuItem,
  Checkbox, Paper, Alert, CircularProgress, Chip,
} from '@mui/material';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const today = () => new Date().toISOString().slice(0, 10);

export default function BankReconciliation() {
  const { profile } = useAuth();
  const canReconcile = hasRole(profile, 'accountant');
  const qc = useQueryClient();

  const { data: accounts, isLoading } = useQuery({ queryKey: ['recon-accounts'], queryFn: () => api.get('/reconciliation/accounts') });
  const { data: history } = useQuery({ queryKey: ['recon-history'], queryFn: () => api.get('/reconciliation/history') });

  const [accountId, setAccountId] = useState('');
  const [statementDate, setStatementDate] = useState(today());
  const [statementBalance, setStatementBalance] = useState('');
  const [loaded, setLoaded] = useState(null); // { accountId, asOf } once "Load" is pressed
  const [selected, setSelected] = useState(new Set());

  const { data: lines, isFetching, error: linesError } = useQuery({
    queryKey: ['recon-lines', loaded?.accountId, loaded?.asOf],
    queryFn: () => api.get(`/reconciliation/${loaded.accountId}/lines?asOf=${loaded.asOf}`),
    enabled: !!loaded,
  });

  const selectedNet = useMemo(() => {
    if (!lines) return 0;
    return lines.lines.filter((l) => selected.has(l.id)).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
  }, [lines, selected]);

  const cleared = lines ? Number(lines.clearedBalance) : 0;
  const calculated = cleared + selectedNet;
  const stmt = parseFloat(statementBalance);
  const difference = Number.isFinite(stmt) ? Math.round((stmt - calculated) * 100) / 100 : null;
  const balanced = difference !== null && Math.abs(difference) < 0.005 && selected.size > 0;

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = lines && lines.lines.length > 0 && selected.size === lines.lines.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(lines.lines.map((l) => l.id)));

  const load = () => { setSelected(new Set()); setLoaded({ accountId, asOf: statementDate }); };

  const finishMutation = useMutation({
    mutationFn: () => api.post('/reconciliation', {
      accountId: loaded.accountId, statementDate: loaded.asOf, statementBalance: stmt, lineIds: [...selected],
    }),
    onSuccess: () => {
      ['recon-lines', 'recon-history', 'recon-accounts', 'audit'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setSelected(new Set());
    },
  });
  const undoMutation = useMutation({
    mutationFn: (id) => api.del(`/reconciliation/${id}`),
    onSuccess: () => ['recon-lines', 'recon-history', 'recon-accounts', 'audit'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
    onError: (err) => alert(err.message),
  });

  if (isLoading) return <CircularProgress size={24} />;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Bank Reconciliation</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Tick the transactions that appear on your bank statement. When the difference reaches zero, finish to lock them in —
        reconciled transactions can't be edited or deleted unless you undo the reconciliation.
      </Typography>

      {accounts.length === 0 ? (
        <Alert severity="info">
          No bank accounts yet. Add one under Journal Entries → "+ New Account" (heading: Bank), then post transactions through it.
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 3 }}>
          <Select size="small" value={accountId} onChange={(e) => { setAccountId(e.target.value); setLoaded(null); }} displayEmpty sx={{ minWidth: 220 }}>
            <MenuItem value="" disabled>Bank account…</MenuItem>
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}{a.last_statement_date ? ` (last: ${String(a.last_statement_date).slice(0, 10)})` : ''}
              </MenuItem>
            ))}
          </Select>
          <TextField size="small" type="date" label="Statement date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="number" label="Statement ending balance" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} />
          <Button variant="outlined" disabled={!accountId || !statementDate} onClick={load}>Load transactions</Button>
        </Box>
      )}

      {linesError && <Alert severity="error" sx={{ mb: 2 }}>{linesError.message}</Alert>}
      {isFetching && <CircularProgress size={20} />}

      {lines && !isFetching && (
        <Box sx={{ mb: 5 }}>
          {lines.lines.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>No uncleared transactions on or before {lines.asOf} for {lines.account.name}.</Alert>
          ) : (
            <Table size="small" sx={{ mb: 3 }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"><Checkbox size="small" checked={!!allSelected} onChange={toggleAll} disabled={!canReconcile} /></TableCell>
                  <TableCell>Date</TableCell><TableCell>Description</TableCell><TableCell>Reference</TableCell>
                  <TableCell align="right">Deposits</TableCell><TableCell align="right">Withdrawals</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.lines.map((l) => (
                  <TableRow key={l.id} hover selected={selected.has(l.id)}>
                    <TableCell padding="checkbox"><Checkbox size="small" checked={selected.has(l.id)} onChange={() => toggle(l.id)} disabled={!canReconcile} /></TableCell>
                    <TableCell>{String(l.date).slice(0, 10)}</TableCell>
                    <TableCell>{l.memo}</TableCell>
                    <TableCell>{l.reference}</TableCell>
                    <TableCell align="right">{Number(l.debit) > 0 && <Money value={l.debit} />}</TableCell>
                    <TableCell align="right">{Number(l.credit) > 0 && <Money value={l.credit} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Paper variant="outlined" sx={{ p: 2, maxWidth: 420 }}>
            <Table size="small">
              <TableBody>
                <TableRow><TableCell sx={{ border: 0 }}>Previously cleared balance</TableCell><TableCell sx={{ border: 0 }} align="right"><Money value={cleared} /></TableCell></TableRow>
                <TableRow><TableCell sx={{ border: 0 }}>Selected transactions ({selected.size})</TableCell><TableCell sx={{ border: 0 }} align="right"><Money value={selectedNet} /></TableCell></TableRow>
                <TableRow><TableCell><strong>Calculated balance</strong></TableCell><TableCell align="right"><Money value={calculated} bold /></TableCell></TableRow>
                <TableRow><TableCell sx={{ border: 0 }}>Statement balance</TableCell><TableCell sx={{ border: 0 }} align="right">{difference === null ? '—' : <Money value={stmt} />}</TableCell></TableRow>
                <TableRow>
                  <TableCell sx={{ border: 0 }}><strong>Difference</strong></TableCell>
                  <TableCell sx={{ border: 0 }} align="right">
                    {difference === null ? '—' : <Money value={difference} bold color={Math.abs(difference) < 0.005 ? 'primary.main' : 'error.main'} />}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            {finishMutation.error && <Alert severity="error" sx={{ mt: 2 }}>{finishMutation.error.message}</Alert>}
            {finishMutation.isSuccess && <Alert severity="success" sx={{ mt: 2 }}>Reconciliation saved.</Alert>}
            {canReconcile ? (
              <Button variant="contained" fullWidth sx={{ mt: 2 }} disabled={!balanced || finishMutation.isPending} onClick={() => finishMutation.mutate()}>
                Finish reconciliation
              </Button>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Accountants and admins can finish reconciliations.</Typography>
            )}
          </Paper>
        </Box>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>History</Typography>
      {!history || history.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No reconciliations completed yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Statement date</TableCell><TableCell>Account</TableCell><TableCell align="right">Statement balance</TableCell>
              <TableCell align="right">Transactions</TableCell>{canReconcile && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {history.map((h) => (
              <TableRow key={h.id}>
                <TableCell>{String(h.statement_date).slice(0, 10)}</TableCell>
                <TableCell>{h.account_name}</TableCell>
                <TableCell align="right"><Money value={h.statement_balance} /></TableCell>
                <TableCell align="right">{h.line_count}</TableCell>
                {canReconcile && (
                  <TableCell align="right">
                    {h.is_latest
                      ? <Button size="small" color="error" onClick={() => { if (confirm('Undo this reconciliation? Its transactions become editable again.')) undoMutation.mutate(h.id); }}>Undo</Button>
                      : <Chip size="small" label="locked by later" variant="outlined" />}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
