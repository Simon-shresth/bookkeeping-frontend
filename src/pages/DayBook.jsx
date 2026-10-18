import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Grid, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Chip, CircularProgress, Alert, Button, IconButton, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButtonGroup, ToggleButton,
  Autocomplete, Divider,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import TodayIcon from '@mui/icons-material/Today';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../lib/api';
import Money, { formatNepaliNumber } from '../components/Money';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TYPE_COLORS = {
  SALE: 'success', PURCHASE: 'warning', EXPENSE: 'error',
  RECEIPT: 'info', PAYMENT: 'secondary', JOURNAL: 'default',
};

const emptyLine = () => ({ accountId: '', type: 'INFLOW', amount: '', narration: '' });

function StatCard({ label, value, tone, subtitle }) {
  const color = tone === 'good' ? 'primary.main' : tone === 'bad' ? 'error.main' : undefined;
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 170 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ mt: 0.5 }}>
        <Money value={value} color={color} bold />
      </Typography>
      {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
    </Paper>
  );
}

// ── GL entry row (existing journal-based view, collapsible detail) ─────────────
function GlEntryRow({ entry }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell sx={{ width: 40 }}>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Chip label={entry.transaction_type} size="small"
            color={TYPE_COLORS[entry.transaction_type] || 'default'} variant="outlined"
            sx={{ fontWeight: 600, fontSize: 11 }} />
        </TableCell>
        <TableCell>{entry.ref_no || '—'}</TableCell>
        <TableCell>{entry.party || '—'}</TableCell>
        <TableCell>{entry.narration}</TableCell>
        <TableCell align="right">{entry.debit > 0 ? formatNepaliNumber(entry.debit) : '—'}</TableCell>
        <TableCell align="right">{entry.credit > 0 ? formatNepaliNumber(entry.credit) : '—'}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ m: 1, py: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                DOUBLE-ENTRY DETAIL
              </Typography>
              <Table size="small" sx={{ mt: 0.5 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>Account</TableCell>
                    <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>Category</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, color: 'text.secondary' }}>Debit</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, color: 'text.secondary' }}>Credit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entry.lines.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{l.account_name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{l.category}: {l.heading}</TableCell>
                      <TableCell align="right">{Number(l.debit) > 0 ? <Money value={l.debit} /> : ''}</TableCell>
                      <TableCell align="right">{Number(l.credit) > 0 ? <Money value={l.credit} /> : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DayBook() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lines, setLines] = useState([emptyLine()]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, error } = useQuery({
    queryKey: ['daybook', date],
    queryFn: () => api.get(`/daybook?date=${date}`),
    refetchOnWindowFocus: false,
  });

  const { data: accounts } = useQuery({
    queryKey: ['account-options'],
    queryFn: () => api.get('/accounts/options'),
  });

  const postMutation = useMutation({
    mutationFn: (body) => api.post('/daybook', body),
    onSuccess: () => {
      ['daybook', 'journal', 'dashboard', 'report-pl', 'report-bs', 'chart-of-accounts', 'ledger'].forEach((key) => {
        qc.invalidateQueries({ queryKey: [key] });
      });
      setDialogOpen(false);
      setLines([emptyLine()]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/daybook/${id}`),
    onSuccess: () => {
      ['daybook', 'journal', 'dashboard', 'report-pl', 'report-bs', 'chart-of-accounts', 'ledger'].forEach((key) => {
        qc.invalidateQueries({ queryKey: [key] });
      });
    },
    onError: (err) => alert(err.message),
  });

  const setLine = (i, k, v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const addLine = () => setLines((ls) => [...ls, emptyLine()]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, j) => j !== i));

  const canSubmit = lines.every((l) => l.accountId && l.type && +l.amount > 0);

  const submit = () => {
    postMutation.mutate({
      date: entryDate,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        type: l.type,
        amount: +l.amount,
        narration: l.narration || undefined,
      })),
    });
  };

  const goToToday = () => setDate(new Date().toISOString().slice(0, 10));

  return (
    <Box>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">Day Book</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" type="date" label="Date" value={date}
            onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button size="small" variant="outlined" startIcon={<TodayIcon />} onClick={goToToday}>Today</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEntryDate(date); setDialogOpen(true); }}>
            Add Entry
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}
      {isLoading && <CircularProgress size={24} sx={{ mb: 2 }} />}

      {data && (
        <>
          {/* ── Petty Cash Summary Cards ──────────────────────────────── */}
          <Typography variant="h6" sx={{ mb: 1 }}>Petty Cash Book</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item>
              <StatCard label="Opening Balance" value={data.summary.opening_balance} />
            </Grid>
            <Grid item>
              <StatCard label="Total Inflows" value={data.summary.total_inflows}
                tone="good" subtitle={`${data.entries.filter(e => e.type === 'INFLOW').length} entries`} />
            </Grid>
            <Grid item>
              <StatCard label="Total Outflows" value={data.summary.total_outflows}
                tone="bad" subtitle={`${data.entries.filter(e => e.type === 'OUTFLOW').length} entries`} />
            </Grid>
            <Grid item>
              <StatCard label="Closing Balance" value={data.summary.closing_balance}
                tone={data.summary.closing_balance >= 0 ? 'good' : 'bad'} />
            </Grid>
          </Grid>

          {/* ── Petty Cash Entries Table ──────────────────────────────── */}
          {data.entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              No petty cash entries for this date.{' '}
              <Button size="small" onClick={() => { setEntryDate(date); setDialogOpen(true); }}>Add one</Button>
            </Typography>
          ) : (
            <Paper variant="outlined" sx={{ mb: 4 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell>Narration</TableCell>
                    <TableCell align="right">Amount (Rs.)</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.entries.map((e) => (
                    <TableRow key={e.id} hover>
                      <TableCell>
                        <Chip
                          label={e.type}
                          size="small"
                          color={e.type === 'INFLOW' ? 'success' : 'error'}
                          variant="outlined"
                          sx={{ fontWeight: 600, fontSize: 11 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{e.account_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{e.category}: {e.heading}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontStyle: e.narration ? 'normal' : 'italic' }}>
                        {e.narration || '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500, color: e.type === 'INFLOW' ? 'success.main' : 'error.main' }}>
                        {e.type === 'OUTFLOW' ? '−' : '+'}{formatNepaliNumber(e.amount)}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => { if (window.confirm('Delete this entry?')) deleteMutation.mutate(e.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Balance footer */}
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell colSpan={3} sx={{ fontWeight: 600 }}>Closing Balance</TableCell>
                    <TableCell align="right" sx={{
                      fontWeight: 700,
                      color: data.summary.closing_balance >= 0 ? 'primary.main' : 'error.main',
                    }}>
                      {formatNepaliNumber(data.summary.closing_balance)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          )}

          <Divider sx={{ mb: 3 }} />

          {/* ── GL Journal View ───────────────────────────────────────── */}
          <Typography variant="h6" sx={{ mb: 1 }}>
            General Ledger Transactions ({data.gl.entry_count})
          </Typography>
          {data.gl.entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No GL transactions for this date.</Typography>
          ) : (
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell>Type</TableCell>
                    <TableCell>Ref No</TableCell>
                    <TableCell>Party</TableCell>
                    <TableCell>Narration</TableCell>
                    <TableCell align="right">Debit (Rs.)</TableCell>
                    <TableCell align="right">Credit (Rs.)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.gl.entries.map((entry) => (
                    <GlEntryRow key={entry.id} entry={entry} />
                  ))}
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell colSpan={5} sx={{ fontWeight: 600 }}>Daily Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatNepaliNumber(data.gl.total_debit)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatNepaliNumber(data.gl.total_credit)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}

      {/* ── Add Entries Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Add Petty Cash Entries</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {postMutation.error && <Alert severity="error">{postMutation.error.message}</Alert>}

          <TextField size="small" type="date" label="Entry Date" value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ maxWidth: 200 }} />

          {lines.map((line, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* INFLOW / OUTFLOW toggle */}
                <ToggleButtonGroup
                  size="small" exclusive value={line.type}
                  onChange={(_, v) => v && setLine(i, 'type', v)}
                >
                  <ToggleButton value="INFLOW" sx={{ color: 'success.main', '&.Mui-selected': { bgcolor: 'success.light', color: 'success.dark' } }}>
                    ▲ Inflow
                  </ToggleButton>
                  <ToggleButton value="OUTFLOW" sx={{ color: 'error.main', '&.Mui-selected': { bgcolor: 'error.light', color: 'error.dark' } }}>
                    ▼ Outflow
                  </ToggleButton>
                </ToggleButtonGroup>

                {/* Account selector */}
                <Autocomplete
                  size="small"
                  options={accounts || []}
                  groupBy={(a) => `${a.category}: ${a.heading}`}
                  getOptionLabel={(a) => a.name || ''}
                  isOptionEqualToValue={(a, v) => a.id === v.id}
                  value={(accounts || []).find((a) => a.id === line.accountId) || null}
                  onChange={(_, v) => setLine(i, 'accountId', v ? v.id : '')}
                  renderInput={(params) => <TextField {...params} label="Account" placeholder="Search account…" />}
                  sx={{ flex: 2, minWidth: 200 }}
                />

                {/* Amount */}
                <TextField
                  size="small" type="number" label="Amount" value={line.amount}
                  onChange={(e) => setLine(i, 'amount', e.target.value)}
                  sx={{ flex: 1, minWidth: 120 }}
                />

                {/* Remove row */}
                <IconButton size="small" disabled={lines.length <= 1} onClick={() => removeLine(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* Per-line narration */}
              <TextField
                size="small" label="Narration" placeholder="e.g. Petrol for office vehicle"
                value={line.narration} onChange={(e) => setLine(i, 'narration', e.target.value)}
                fullWidth
              />
            </Paper>
          ))}

          <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: 'flex-start' }} onClick={addLine}>
            Add Line
          </Button>

          {/* Running total preview */}
          <Box sx={{ display: 'flex', gap: 3, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Inflows</Typography>
              <Typography variant="body2" color="success.main" fontWeight={600}>
                Rs. {formatNepaliNumber(lines.filter((l) => l.type === 'INFLOW').reduce((s, l) => s + (+l.amount || 0), 0))}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Outflows</Typography>
              <Typography variant="body2" color="error.main" fontWeight={600}>
                Rs. {formatNepaliNumber(lines.filter((l) => l.type === 'OUTFLOW').reduce((s, l) => s + (+l.amount || 0), 0))}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!canSubmit || postMutation.isPending} onClick={submit}>
            Post {lines.length} {lines.length === 1 ? 'Entry' : 'Entries'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
