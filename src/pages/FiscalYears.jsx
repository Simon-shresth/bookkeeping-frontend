import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  CircularProgress,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

export default function FiscalYears() {
  const { profile } = useAuth();
  const isAdmin = hasRole(profile, 'admin');
  const qc = useQueryClient();

  const { data: years, isLoading, error } = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: () => api.get('/fiscal-years'),
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [balancesOpen, setBalancesOpen] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState(null);

  const { data: openingData, isLoading: loadingBalances } = useQuery({
    queryKey: ['fiscal-year-opening-balances', selectedYearId],
    queryFn: () => api.get(`/fiscal-years/${selectedYearId}/opening-balances`),
    enabled: !!selectedYearId && balancesOpen,
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post('/fiscal-years/close', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-years'] });
      qc.invalidateQueries({ queryKey: ['report-pl'] });
      qc.invalidateQueries({ queryKey: ['report-bs'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setConfirmOpen(false);
    },
  });

  const openYear = (years || []).find((y) => y.status === 'open');

  const openBalancesModal = (yearId) => {
    setSelectedYearId(yearId);
    setBalancesOpen(true);
  };

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Fiscal Years</Typography>
        {isAdmin && openYear && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<LockOutlinedIcon />}
            onClick={() => setConfirmOpen(true)}
          >
            Close Fiscal Year
          </Button>
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Fiscal years define accounting periods. Closing a year rolls its profit into Retained Earnings
        and starts the next year automatically. (Edits to closed years are still allowed — opening balances recompute lazily.)
      </Typography>

      {years.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No fiscal years found.</Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Closed At</TableCell>
                <TableCell>Closed By</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {years.map((y) => (
                <TableRow key={y.id} hover>
                  <TableCell>{y.start_date}</TableCell>
                  <TableCell>{y.end_date}</TableCell>
                  <TableCell>
                    <Chip
                      label={y.status.toUpperCase()}
                      size="small"
                      color={y.status === 'open' ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: 11 }}
                    />
                  </TableCell>
                  <TableCell>{y.closed_at ? String(y.closed_at).slice(0, 10) : '—'}</TableCell>
                  <TableCell>{y.closed_by_email || '—'}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={<AccountBalanceWalletOutlinedIcon fontSize="small" />}
                      onClick={() => openBalancesModal(y.id)}
                    >
                      Opening Balances
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ── Close Year Confirmation Dialog ─────────────────────────── */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Close Current Fiscal Year?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {closeMutation.error && <Alert severity="error" sx={{ mb: 2 }}>{closeMutation.error.message}</Alert>}
          {openYear && (
            <Typography variant="body2">
              Closing <strong>{openYear.start_date} to {openYear.end_date}</strong> will:
              <br /><br />
              1. Mark this fiscal year as <strong>closed</strong>.
              <br />
              2. Automatically start the next fiscal year.
              <br />
              3. Roll the net profit from this year into <strong>Retained Earnings</strong>.
              <br />
              4. Reset the Profit &amp; Loss report for the new year.
              <br /><br />
              <em>Note: You can still edit or add entries in the closed year if needed.</em>
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            disabled={closeMutation.isPending}
            onClick={() => closeMutation.mutate()}
          >
            {closeMutation.isPending ? 'Closing…' : 'Confirm & Close Year'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── View Opening Balances Dialog ───────────────────────────── */}
      <Dialog open={balancesOpen} onClose={() => setBalancesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Opening Balances as of {openingData?.fiscal_year?.start_date}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {loadingBalances && <CircularProgress size={24} />}
          {openingData && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {openingData.balances.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                      {b.category}: {b.heading}
                    </TableCell>
                    <TableCell align="right">
                      <Money value={b.balance} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBalancesOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
