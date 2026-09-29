import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem,
  ListSubheader, IconButton, Table, TableHead, TableRow, TableCell, TableBody, Paper, Chip, Alert, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const EXCLUDED_HEADINGS = ['Accounts Receivable', 'Accounts Payable'];
const emptyLine = () => ({ accountId: '', debit: '', credit: '' });

export default function JournalEntries() {
  const { profile } = useAuth();
  const canPost = hasRole(profile, 'accountant');
  const qc = useQueryClient();

  const { data: entries, isLoading, error } = useQuery({ queryKey: ['journal'], queryFn: () => api.get('/journal') });
  const { data: accounts } = useQuery({ queryKey: ['account-options'], queryFn: () => api.get('/accounts/options') });

  const grouped = useMemo(() => {
    if (!accounts) return {};
    const g = {};
    for (const a of accounts) (g[`${a.category}: ${a.heading}`] ||= []).push(a);
    return g;
  }, [accounts]);

  const creatableHeadings = useMemo(() => {
    if (!accounts) return [];
    const seen = new Map();
    for (const a of accounts) if (!EXCLUDED_HEADINGS.includes(a.heading)) seen.set(a.heading, a.category);
    return [...seen.entries()].map(([heading, category]) => ({ heading, category }));
  }, [accounts]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [newAcctOpen, setNewAcctOpen] = useState(false);
  const [newAcctName, setNewAcctName] = useState('');
  const [newAcctHeading, setNewAcctHeading] = useState('');

  const openNew = () => {
    setEditing(null); setDate(new Date().toISOString().slice(0, 10)); setMemo(''); setLines([emptyLine(), emptyLine()]);
    setOpen(true);
  };
  const openEdit = (entry) => {
    setEditing(entry); setDate(entry.date); setMemo(entry.memo);
    setLines(entry.lines.map((l) => ({ accountId: l.account_id, debit: l.debit > 0 ? l.debit : '', credit: l.credit > 0 ? l.credit : '' })));
    setOpen(true);
  };

  const totals = lines.reduce((acc, l) => ({ debit: acc.debit + (+l.debit || 0), credit: acc.credit + (+l.credit || 0) }), { debit: 0, credit: 0 });
  const balanced = Math.abs(totals.debit - totals.credit) < 0.005 && totals.debit > 0;

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/journal', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journal'] }); setOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => api.put(`/journal/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journal'] }); setOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/journal/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
  });
  const newAccountMutation = useMutation({
    mutationFn: (body) => api.post('/accounts', body),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['account-options'] });
      setNewAcctOpen(false); setNewAcctName('');
    },
  });

  const submit = () => {
    const body = { date, memo, lines: lines.filter((l) => l.accountId).map((l) => ({ accountId: l.accountId, debit: +l.debit || 0, credit: +l.credit || 0 })) };
    if (editing) updateMutation.mutate({ id: editing.id, body });
    else createMutation.mutate(body);
  };

  const submitting = createMutation.isPending || updateMutation.isPending;
  const submitError = createMutation.error || updateMutation.error;

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Journal Entries</Typography>
        {canPost && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>New Entry</Button>}
      </Box>

      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No journal entries yet.</Typography>
      ) : (
        entries.map((entry) => (
          <Paper key={entry.id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">{entry.date} — {entry.memo}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label={entry.source} size="small" variant="outlined" />
                {entry.source === 'Manual' && canPost ? (
                  <>
                    <Button size="small" onClick={() => openEdit(entry)}>Edit</Button>
                    <IconButton size="small" onClick={() => deleteMutation.mutate(entry.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </>
                ) : (
                  <Typography variant="caption" color="text.secondary">edit via {entry.source} module</Typography>
                )}
              </Box>
            </Box>
            <Table size="small">
              <TableBody>
                {entry.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell sx={{ border: 0 }}>{l.account_name}</TableCell>
                    <TableCell sx={{ border: 0 }} align="right">{l.debit > 0 && <Money value={l.debit} />}</TableCell>
                    <TableCell sx={{ border: 0 }} align="right">{l.credit > 0 && <Money value={l.credit} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ))
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Update Entry' : 'New Journal Entry'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {submitError && <Alert severity="error">{submitError.message}</Alert>}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} fullWidth />
          </Box>

          <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-end' }} onClick={() => setNewAcctOpen((v) => !v)}>+ New Account</Button>
          {newAcctOpen && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Select size="small" value={newAcctHeading} onChange={(e) => setNewAcctHeading(e.target.value)} displayEmpty sx={{ minWidth: 200 }}>
                <MenuItem value="" disabled>Heading…</MenuItem>
                {creatableHeadings.map((h) => <MenuItem key={h.heading} value={h.heading}>{h.category}: {h.heading}</MenuItem>)}
              </Select>
              <TextField size="small" placeholder="e.g. Bank - HBL" value={newAcctName} onChange={(e) => setNewAcctName(e.target.value)} fullWidth />
              <Button
                size="small"
                disabled={!newAcctName || !newAcctHeading || newAccountMutation.isPending}
                onClick={() => newAccountMutation.mutate({ name: newAcctName, heading: newAcctHeading })}
              >
                Create
              </Button>
            </Box>
          )}
          {newAccountMutation.error && <Alert severity="error">{newAccountMutation.error.message}</Alert>}

          <Typography variant="body2" color="text.secondary">Lines</Typography>
          {lines.map((line, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1 }}>
              <Select
                size="small" value={line.accountId} displayEmpty sx={{ flex: 2 }}
                onChange={(e) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, accountId: e.target.value } : l)))}
              >
                <MenuItem value="" disabled>Account…</MenuItem>
                {Object.entries(grouped).map(([heading, accs]) => [
                  <ListSubheader key={heading}>{heading}</ListSubheader>,
                  ...accs.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>),
                ])}
              </Select>
              <TextField
                size="small" type="number" placeholder="Debit" sx={{ flex: 1 }} value={line.debit}
                onChange={(e) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, debit: e.target.value } : l)))}
              />
              <TextField
                size="small" type="number" placeholder="Credit" sx={{ flex: 1 }} value={line.credit}
                onChange={(e) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, credit: e.target.value } : l)))}
              />
            </Box>
          ))}
          <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => setLines((ls) => [...ls, emptyLine()])}>+ Add Line</Button>

          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            Debits: <Money value={totals.debit} />  Credits: <Money value={totals.credit} />{'  '}
            {balanced ? '✓ Balanced' : `⚠ Out of balance by ${Math.abs(totals.debit - totals.credit).toFixed(2)}`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!balanced || submitting} onClick={submit}>
            {editing ? 'Update Entry' : 'Post Entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
