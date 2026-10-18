import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Grid, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Chip, CircularProgress, Alert, Button, IconButton, Collapse,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import TodayIcon from '@mui/icons-material/Today';
import { api } from '../lib/api';
import Money, { formatNepaliNumber } from '../components/Money';

const TYPE_COLORS = {
  SALE: 'success',
  PURCHASE: 'warning',
  EXPENSE: 'error',
  RECEIPT: 'info',
  PAYMENT: 'secondary',
  JOURNAL: 'default',
};

function StatCard({ label, value, tone }) {
  const color = tone === 'good' ? 'primary.main' : tone === 'bad' ? 'error.main' : undefined;
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 160 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ mt: 0.5 }}>
        <Money value={value} color={color} bold />
      </Typography>
    </Paper>
  );
}

function EntryRow({ entry }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell sx={{ width: 48 }}>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Chip
            label={entry.transaction_type}
            size="small"
            color={TYPE_COLORS[entry.transaction_type] || 'default'}
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
        </TableCell>
        <TableCell>{entry.ref_no || '—'}</TableCell>
        <TableCell>{entry.party || '—'}</TableCell>
        <TableCell>{entry.narration}</TableCell>
        <TableCell align="right">
          {entry.debit > 0 ? formatNepaliNumber(entry.debit) : '—'}
        </TableCell>
        <TableCell align="right">
          {entry.credit > 0 ? formatNepaliNumber(entry.credit) : '—'}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1, py: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                JOURNAL LINES (DOUBLE-ENTRY DETAIL)
              </Typography>
              <Table size="small" sx={{ mt: 0.5 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>Account</TableCell>
                    <TableCell sx={{ fontSize: 11, color: 'text.secondary' }}>Heading / Category</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, color: 'text.secondary' }}>Debit</TableCell>
                    <TableCell align="right" sx={{ fontSize: 11, color: 'text.secondary' }}>Credit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entry.lines.map((l, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{l.account_name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                        {l.category}: {l.heading}
                      </TableCell>
                      <TableCell align="right">
                        {Number(l.debit) > 0 ? <Money value={l.debit} /> : ''}
                      </TableCell>
                      <TableCell align="right">
                        {Number(l.credit) > 0 ? <Money value={l.credit} /> : ''}
                      </TableCell>
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

export default function DayBook() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, error } = useQuery({
    queryKey: ['daybook', date],
    queryFn: () => api.get(`/daybook?date=${date}`),
    refetchOnWindowFocus: false,
  });

  const goToToday = () => setDate(new Date().toISOString().slice(0, 10));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">Day Book</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button size="small" variant="outlined" startIcon={<TodayIcon />} onClick={goToToday}>
            Today
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}
      {isLoading && <CircularProgress size={24} sx={{ mb: 2 }} />}

      {data && (
        <>
          {/* ── Summary Metric Cards ───────────────────────────────────── */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item>
              <StatCard label="Opening Cash" value={data.summary.opening_cash} />
            </Grid>
            <Grid item>
              <StatCard label="Cash Received Today" value={data.summary.cash_received} tone="good" />
            </Grid>
            <Grid item>
              <StatCard label="Cash Paid Today" value={data.summary.cash_paid} tone="bad" />
            </Grid>
            <Grid item>
              <StatCard label="Closing Cash" value={data.summary.closing_cash} tone="good" />
            </Grid>
            <Grid item>
              <StatCard label="Daily Total Debits" value={data.summary.total_debit} />
            </Grid>
            <Grid item>
              <StatCard label="Daily Total Credits" value={data.summary.total_credit} />
            </Grid>
          </Grid>

          {/* ── Transactions Table ─────────────────────────────────────── */}
          <Typography variant="h6" sx={{ mb: 1 }}>
            Transactions ({data.summary.transaction_count})
          </Typography>

          {data.entries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No transactions recorded on this date.
            </Typography>
          ) : (
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 48 }} />
                    <TableCell>Type</TableCell>
                    <TableCell>Ref No</TableCell>
                    <TableCell>Party</TableCell>
                    <TableCell>Narration</TableCell>
                    <TableCell align="right">Debit (Rs.)</TableCell>
                    <TableCell align="right">Credit (Rs.)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                  {/* Totals row */}
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell colSpan={5} sx={{ fontWeight: 600 }}>
                      Daily Total
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatNepaliNumber(data.summary.total_debit)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatNepaliNumber(data.summary.total_credit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
