import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Chip, CircularProgress, Alert, Button, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, Autocomplete, FormControlLabel,
  Checkbox, Grid, Tooltip, RadioGroup, Radio, FormControl, FormLabel,
  InputAdornment, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import ClearIcon from '@mui/icons-material/Clear';
import { api } from '../lib/api';
import Money, { formatNepaliNumber } from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const today = () => new Date().toISOString().slice(0, 10);

const emptyChequeForm = () => ({
  chequeDate: today(),
  customerId: '',
  bankName: '',
  chequeNumber: '',
  amount: '',
  draweeName: '',
  chequeOwner: '',
  isCashed: false,
  cashingType: 'uncashed', // 'uncashed' | 'full' | 'partial'
  cashedAmount: '',
  cashedDate: today(),
});

function StatCard({ label, count, amount, tone, subtitle }) {
  const color = tone === 'good' ? 'success.main' : tone === 'warn' ? 'warning.main' : tone === 'info' ? 'primary.main' : undefined;
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 200 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
        <Typography variant="h6">
          <Money value={amount} color={color} bold />
        </Typography>
        {count !== undefined && (
          <Typography variant="caption" color="text.secondary">
            ({count} {count === 1 ? 'cheque' : 'cheques'})
          </Typography>
        )}
      </Box>
      {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
    </Paper>
  );
}

export default function Cheques() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();

  const [filterCustomer, setFilterCustomer] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('remaining');

  const { data: cheques = [], isLoading, error } = useQuery({
    queryKey: ['cheques', filterCustomer?.id],
    queryFn: () => {
      const path = filterCustomer ? `/cheques?customerId=${filterCustomer.id}` : '/cheques';
      return api.get(path);
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers'),
  });

  // Dialog States
  const [recordOpen, setRecordOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState(null);
  const [recordForm, setRecordForm] = useState(emptyChequeForm());

  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [selectedChequeForCash, setSelectedChequeForCash] = useState(null);
  const [cashMode, setCashMode] = useState('full'); // 'full' or 'partial'
  const [additionalPayment, setAdditionalPayment] = useState('');
  const [cashDate, setCashDate] = useState(today());
  const [previousCashings, setPreviousCashings] = useState([]);

  const filteredCheques = useMemo(() => {
    return cheques.filter((c) => {
      const amount = Number(c.amount) || 0;
      const cashed = Number(c.cashed_amount) || 0;
      const isFull = c.is_cashed || cashed >= amount;
      const isPartial = !isFull && cashed > 0;
      const isUncashed = !isFull && cashed === 0;

      if (statusFilter === 'uncashed' && !isUncashed) return false;
      if (statusFilter === 'partial' && !isPartial) return false;
      if (statusFilter === 'full' && !isFull) return false;

      // Fully cashed cheques should be excluded from 'remaining' tab
      if (statusFilter === 'remaining' && isFull) return false;

      if (filterDate) {
        const chequeDate = String(c.cheque_date).slice(0, 10);
        if (chequeDate !== filterDate) return false;
      }

      return true;
    });
  }, [cheques, statusFilter, filterDate]);

  const stats = useMemo(() => {
    let totalAmount = 0;
    let totalCashed = 0;
    let fullCount = 0;
    let partialCount = 0;
    let uncashedCount = 0;

    cheques.forEach((c) => {
      const amt = Number(c.amount) || 0;
      const cashed = Number(c.cashed_amount) || 0;
      totalAmount += amt;
      totalCashed += cashed;

      if (c.is_cashed || cashed >= amt) {
        fullCount++;
      } else if (cashed > 0) {
        partialCount++;
      } else {
        uncashedCount++;
      }
    });

    const remainingBalance = Math.max(0, totalAmount - totalCashed);

    return {
      totalCheques: cheques.length,
      totalAmount,
      totalCashed,
      remainingBalance,
      fullCount,
      partialCount,
      uncashedCount,
    };
  }, [cheques]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['cheques'] });
  };

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (payload) => {
      if (editingCheque) {
        return api.put(`/cheques/${editingCheque.id}`, payload);
      }
      return api.post('/cheques', payload);
    },
    onSuccess: () => {
      refresh();
      setRecordOpen(false);
    },
    onError: (err) => alert(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/cheques/${id}`),
    onSuccess: refresh,
    onError: (err) => alert(err.message),
  });

  const cashMutation = useMutation({
    mutationFn: ({ id, payload }) => api.post(`/cheques/${id}/cash`, payload),
    onSuccess: () => {
      refresh();
      setCashModalOpen(false);
    },
    onError: (err) => alert(err.message),
  });

  // Handlers for Record / Edit
  const handleOpenRecord = () => {
    setEditingCheque(null);
    setRecordForm(emptyChequeForm());
    setRecordOpen(true);
  };

  const handleOpenEdit = (ch) => {
    setEditingCheque(ch);
    const amount = Number(ch.amount) || 0;
    const cashed = Number(ch.cashed_amount) || 0;
    const isFull = ch.is_cashed || cashed >= amount;
    const isPartial = !isFull && cashed > 0;

    let cType = 'uncashed';
    if (isFull) cType = 'full';
    else if (isPartial) cType = 'partial';

    setRecordForm({
      chequeDate: String(ch.cheque_date).slice(0, 10),
      customerId: ch.customer_id,
      bankName: ch.bank_name,
      chequeNumber: ch.cheque_number,
      amount: String(ch.amount),
      draweeName: ch.drawee_name,
      chequeOwner: ch.cheque_owner,
      isCashed: isFull,
      cashingType: cType,
      cashedAmount: cashed ? String(cashed) : '',
      cashedDate: ch.cashed_date ? String(ch.cashed_date).slice(0, 10) : today(),
    });
    setRecordOpen(true);
  };

  const handleDelete = (id, chNum) => {
    if (window.confirm(`Are you sure you want to delete cheque #${chNum}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleRecordSubmit = (e) => {
    e.preventDefault();
    const amt = Number(recordForm.amount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid cheque amount.');
      return;
    }
    if (!recordForm.customerId) {
      alert('Please select a customer.');
      return;
    }

    let isCashed = false;
    let cashedAmount = 0;
    let cashedDate = null;

    if (recordForm.cashingType === 'full') {
      isCashed = true;
      cashedAmount = amt;
      cashedDate = recordForm.cashedDate || today();
    } else if (recordForm.cashingType === 'partial') {
      cashedAmount = Number(recordForm.cashedAmount) || 0;
      if (cashedAmount >= amt) {
        isCashed = true;
        cashedAmount = amt;
      } else {
        isCashed = false;
      }
      cashedDate = recordForm.cashedDate || today();
    }

    const payload = {
      chequeDate: recordForm.chequeDate,
      customerId: recordForm.customerId,
      bankName: recordForm.bankName.trim(),
      chequeNumber: recordForm.chequeNumber.trim(),
      amount: amt,
      draweeName: recordForm.draweeName.trim(),
      chequeOwner: recordForm.chequeOwner.trim(),
      isCashed,
      cashedAmount,
      cashedDate,
    };

    saveMutation.mutate(payload);
  };

  // Handlers for Cashing / Payment Recording
  const handleOpenCashModal = async (ch) => {
    setSelectedChequeForCash(ch);
    const amount = Number(ch.amount) || 0;
    const alreadyCashed = Number(ch.cashed_amount) || 0;
    const remaining = Math.max(0, amount - alreadyCashed);

    setCashDate(today());
    setCashMode(alreadyCashed === 0 ? 'full' : 'partial');
    setAdditionalPayment(String(remaining > 0 ? remaining : ''));

    // Fetch previous cashings history
    try {
      const cashings = await api.get(`/cheques/${ch.id}/cashings`);
      setPreviousCashings(cashings);
    } catch (err) {
      console.error('Failed to fetch cashings:', err);
      setPreviousCashings([]);
    }

    setCashModalOpen(true);
  };

  const handleCashSubmit = () => {
    if (!selectedChequeForCash) return;
    const totalAmount = Number(selectedChequeForCash.amount) || 0;
    const alreadyCashed = Number(selectedChequeForCash.cashed_amount) || 0;

    let newCashedAmount = 0;
    let isCashed = false;

    if (cashMode === 'full') {
      newCashedAmount = totalAmount;
      isCashed = true;
    } else {
      const paymentNow = Number(additionalPayment) || 0;
      if (paymentNow <= 0) {
        alert('Please enter a valid payment amount.');
        return;
      }
      newCashedAmount = alreadyCashed + paymentNow;
      if (newCashedAmount >= totalAmount) {
        newCashedAmount = totalAmount;
        isCashed = true;
      }
    }

    cashMutation.mutate({
      id: selectedChequeForCash.id,
      payload: {
        isCashed,
        cashedAmount: newCashedAmount,
        cashedDate: cashDate || today(),
      },
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  return (
    <Box>
      {/* Top Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>Cheques</Typography>
          <Typography variant="body2" color="text.secondary">
            Track and manage incoming customer cheques, partial cashing, and remaining balances
          </Typography>
        </Box>
        {canEdit && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenRecord}>
            Record Cheque
          </Button>
        )}
      </Box>

      {/* Summary Stat Cards */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <StatCard
          label="Total Cheques"
          amount={stats.totalAmount}
          count={stats.totalCheques}
          tone="info"
        />
        <StatCard
          label="Cashed in Full"
          amount={stats.totalCashed}
          count={stats.fullCount}
          tone="good"
        />
        <StatCard
          label="Remaining Outstanding"
          amount={stats.remainingBalance}
          count={stats.partialCount + stats.uncashedCount}
          tone="warn"
          subtitle={`${stats.partialCount} partial, ${stats.uncashedCount} uncashed`}
        />
      </Box>

      {/* Filter Toolbar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Autocomplete
          sx={{ width: 320 }}
          options={customers}
          value={filterCustomer}
          getOptionLabel={(option) => option.name || ''}
          isOptionEqualToValue={(option, value) => option.id === value?.id}
          onChange={(_, newValue) => setFilterCustomer(newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Search & Filter by Customer"
              placeholder="All Customers"
            />
          )}
        />

        {filterCustomer && (
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<ClearIcon />}
            onClick={() => setFilterCustomer(null)}
          >
            Clear Customer
          </Button>
        )}

        <TextField
          type="date"
          size="small"
          label="Filter by Date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />

        {filterDate && (
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<ClearIcon />}
            onClick={() => setFilterDate('')}
          >
            Clear Date
          </Button>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <ToggleButtonGroup
          size="small"
          value={statusFilter}
          exclusive
          onChange={(_, val) => val && setStatusFilter(val)}
        >
          <ToggleButton value="remaining">Remaining ({stats.partialCount + stats.uncashedCount})</ToggleButton>
          <ToggleButton value="uncashed">Uncashed ({stats.uncashedCount})</ToggleButton>
          <ToggleButton value="partial">Partial ({stats.partialCount})</ToggleButton>
          <ToggleButton value="full">Cashed ({stats.fullCount})</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

     {/* Cheques Table (Sorted serially in ascending order by cheque date) */}
      <Paper variant="outlined" sx={{ width: '100%'}}>
        <Table size="small" sx={{ width: '100%' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600, width: 45, px: 1 }}>S.N.</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 95, px: 1 }}>Cheque Date</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100, px: 1 }}>Cheque No.</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 135, px: 1 }}>Customer</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100, px: 1 }}>Bank Name</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100, px: 1 }}>Drawee</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 110, px: 1 }}>Owner</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, width: 120, px: 1, whiteSpace: 'nowrap' }}>
                Amount
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, width: 115, px: 1, whiteSpace: 'nowrap' }}>
                Cashed
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, width: 120, px: 1, whiteSpace: 'nowrap' }}>
                Remaining
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, width: 145, px: 1 }}>Status</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, width: 105, px: 1 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCheques.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  No cheques found {filterCustomer ? `for ${filterCustomer.name}` : ''}.
                </TableCell>
              </TableRow>
            ) : (
              filteredCheques.map((c, index) => {
                const totalAmt = Number(c.amount) || 0;
                const cashedAmt = Number(c.cashed_amount) || 0;
                const remaining = Math.max(0, totalAmt - cashedAmt);
                const isFull = c.is_cashed || cashedAmt >= totalAmt;
                const isPartial = !isFull && cashedAmt > 0;

                return (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 500, px: 1 }}>
                      {index + 1}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', px: 1 }}>
                      {String(c.cheque_date).slice(0, 10)}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        maxWidth: 110,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        px: 1,
                      }}
                    >
                      <Tooltip title={c.cheque_number} placement="top">
                        <span>{c.cheque_number}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: 500,
                        maxWidth: 145,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        px: 1,
                      }}
                    >
                      <Tooltip title={c.customer_name} placement="top">
                        <span>{c.customer_name}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 110,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        px: 1,
                      }}
                    >
                      <Tooltip title={c.bank_name} placement="top">
                        <span>{c.bank_name}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 110,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        px: 1,
                      }}
                    >
                      <Tooltip title={c.drawee_name} placement="top">
                        <span>{c.drawee_name}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        px: 1,
                      }}
                    >
                      <Tooltip title={c.cheque_owner} placement="top">
                        <span>{c.cheque_owner}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                      <Money value={totalAmt} bold />
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                      {cashedAmt > 0 ? (
                        <Money value={cashedAmt} color={isFull ? 'success.main' : 'warning.main'} />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                      {remaining > 0 ? (
                        <Money value={remaining} color="error.main" bold />
                      ) : (
                        <Typography variant="body2" color="success.main" fontWeight={600}>
                          Nil
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                      {isFull ? (
                        <Chip
                          label="Cashed in Full"
                          size="small"
                          color="success"
                          variant="filled"
                          icon={<CheckCircleIcon />}
                          title={c.cashed_date ? `Cashed on ${String(c.cashed_date).slice(0, 10)}` : undefined}
                        />
                      ) : isPartial ? (
                        <Chip
                          label={`Partial (${formatNepaliNumber(cashedAmt)})`}
                          size="small"
                          color="warning"
                          variant="outlined"
                          title={c.cashed_date ? `Last cashed on ${String(c.cashed_date).slice(0, 10)}` : undefined}
                        />
                      ) : (
                        <Chip
                          label="Uncashed"
                          size="small"
                          variant="outlined"
                          color="default"
                        />
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.25 }}>
                        {canEdit && (
                          <Tooltip title={isFull ? 'Update Cash Record' : 'Cash / Record Payment'}>
                            <IconButton
                              size="small"
                              color={isFull ? 'default' : 'primary'}
                              onClick={() => handleOpenCashModal(c)}
                            >
                              <PaymentsIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canEdit && (
                          <Tooltip title="Edit Cheque">
                            <IconButton size="small" onClick={() => handleOpenEdit(c)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canEdit && (
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDelete(c.id, c.cheque_number)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* RECORD / EDIT CHEQUE DIALOG */}
      <Dialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <form onSubmit={handleRecordSubmit}>
          <DialogTitle>
            {editingCheque ? `Edit Cheque #${recordForm.chequeNumber}` : 'Record New Cheque'}
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {/* Row 1: Date & Customer */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="date"
                  label="Cheque Date"
                  value={recordForm.chequeDate}
                  onChange={(e) => setRecordForm({ ...recordForm, chequeDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={customers}
                  value={customers.find((c) => c.id === recordForm.customerId) || null}
                  getOptionLabel={(option) => option.name || ''}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  onChange={(_, val) => setRecordForm({ ...recordForm, customerId: val ? val.id : '' })}
                  renderInput={(params) => (
                    <TextField {...params} required label="Customer" placeholder="Select customer" />
                  )}
                />
              </Grid>

              {/* Row 2: Bank Name & Cheque Number */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Bank Name"
                  placeholder="e.g. Nabil Bank, NIC Asia"
                  value={recordForm.bankName}
                  onChange={(e) => setRecordForm({ ...recordForm, bankName: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Cheque Number"
                  placeholder="e.g. 00458291"
                  value={recordForm.chequeNumber}
                  onChange={(e) => setRecordForm({ ...recordForm, chequeNumber: e.target.value })}
                />
              </Grid>

              {/* Row 3: Amount & Drawee Name */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Cheque Amount"
                  value={recordForm.amount}
                  onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Drawee's Name"
                  placeholder="Person/Entity paying"
                  value={recordForm.draweeName}
                  onChange={(e) => setRecordForm({ ...recordForm, draweeName: e.target.value })}
                />
              </Grid>

              {/* Row 4: Cheque Owner */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Owner of the Cheque"
                  placeholder="Name of the account holder / cheque owner"
                  value={recordForm.chequeOwner}
                  onChange={(e) => setRecordForm({ ...recordForm, chequeOwner: e.target.value })}
                />
              </Grid>

              {/* Cashing Status Section */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'action.hover' }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Cheque Cashing Status
                  </Typography>
                  <FormControl component="fieldset">
                    <RadioGroup
                      row
                      value={recordForm.cashingType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRecordForm({
                          ...recordForm,
                          cashingType: val,
                          isCashed: val === 'full',
                          cashedAmount: val === 'full' ? recordForm.amount : val === 'uncashed' ? '' : recordForm.cashedAmount,
                        });
                      }}
                    >
                      <FormControlLabel value="uncashed" control={<Radio />} label="Not Cashed" />
                      <FormControlLabel value="partial" control={<Radio />} label="Cashed in Partial" />
                      <FormControlLabel value="full" control={<Radio />} label="Cashed in Full" />
                    </RadioGroup>
                  </FormControl>

                  {recordForm.cashingType === 'partial' && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <TextField
                        required
                        type="number"
                        label="Amount Cashed"
                        size="small"
                        value={recordForm.cashedAmount}
                        onChange={(e) => setRecordForm({ ...recordForm, cashedAmount: e.target.value })}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                        }}
                        sx={{ width: 220 }}
                      />
                      <TextField
                        required
                        type="date"
                        label="Cashed Date"
                        size="small"
                        value={recordForm.cashedDate}
                        onChange={(e) => setRecordForm({ ...recordForm, cashedDate: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 180 }}
                      />
                      {recordForm.amount && recordForm.cashedAmount && (
                        <Typography variant="body2" color="text.secondary">
                          Remaining Balance:{' '}
                          <Typography component="span" fontWeight={600} color="error.main">
                            Rs. {formatNepaliNumber(Math.max(0, Number(recordForm.amount) - Number(recordForm.cashedAmount)))}
                          </Typography>
                        </Typography>
                      )}
                    </Box>
                  )}

                  {recordForm.cashingType === 'full' && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                      <TextField
                        required
                        type="date"
                        label="Date Cashed"
                        size="small"
                        value={recordForm.cashedDate}
                        onChange={(e) => setRecordForm({ ...recordForm, cashedDate: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 200 }}
                      />
                      <Typography variant="body2" color="success.main" fontWeight={500}>
                        Full amount (Rs. {formatNepaliNumber(recordForm.amount || 0)}) will be marked as cashed.
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setRecordOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editingCheque ? 'Update Cheque' : 'Save Cheque'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* CASH / RECORD PAYMENT DIALOG */}
      {selectedChequeForCash && (
        <Dialog
          open={cashModalOpen}
          onClose={() => setCashModalOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Record Cheque Cashing / Payment
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Cheque #{selectedChequeForCash.cheque_number} ({selectedChequeForCash.bank_name})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Customer: <strong>{selectedChequeForCash.customer_name}</strong> | Drawee: {selectedChequeForCash.drawee_name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 3, mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total Cheque Amount</Typography>
                  <Typography variant="body1" fontWeight={600}>
                    <Money value={selectedChequeForCash.amount} />
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Already Cashed</Typography>
                  <Typography variant="body1" fontWeight={600} color="warning.main">
                    <Money value={selectedChequeForCash.cashed_amount} />
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Current Balance</Typography>
                  <Typography variant="body1" fontWeight={600} color="error.main">
                    <Money value={Math.max(0, Number(selectedChequeForCash.amount) - Number(selectedChequeForCash.cashed_amount))} />
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Previous Partial Payments History */}
            {previousCashings.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Previous Partial Payments
                </Typography>
                <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="center">Type</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previousCashings.map((cashing) => (
                        <TableRow key={cashing.id}>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(cashing.cash_date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={500}>
                              <Money value={cashing.amount} />
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={cashing.is_full ? 'Full' : 'Partial'}
                              size="small"
                              color={cashing.is_full ? 'success' : 'warning'}
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Box>
            )}

            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <FormLabel component="legend">Cashing Mode</FormLabel>
              <RadioGroup
                row
                value={cashMode}
                onChange={(e) => setCashMode(e.target.value)}
              >
                <FormControlLabel value="full" control={<Radio />} label="Cash in Full" />
                <FormControlLabel value="partial" control={<Radio />} label="Cash in Partial / Record Balance Payment" />
              </RadioGroup>
            </FormControl>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Payment / Cashing Date"
                  value={cashDate}
                  onChange={(e) => setCashDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {cashMode === 'partial' ? (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    label="Amount Paying / Cashing Now"
                    value={additionalPayment}
                    onChange={(e) => setAdditionalPayment(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">Rs.</InputAdornment>,
                    }}
                  />
                </Grid>
              ) : (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    disabled
                    label="Amount to Cash"
                    value={`Rs. ${formatNepaliNumber(selectedChequeForCash.amount)}`}
                  />
                </Grid>
              )}

              {cashMode === 'partial' && additionalPayment && (
                <Grid item xs={12}>
                  {(() => {
                    const totalAmt = Number(selectedChequeForCash.amount) || 0;
                    const prevCashed = Number(selectedChequeForCash.cashed_amount) || 0;
                    const payingNow = Number(additionalPayment) || 0;
                    const newTotalCashed = prevCashed + payingNow;
                    const newRemaining = Math.max(0, totalAmt - newTotalCashed);
                    const willBeFull = newTotalCashed >= totalAmt;

                    return (
                      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: willBeFull ? 'success.50' : 'background.paper' }}>
                        <Typography variant="body2" color="text.secondary">
                          New Total Cashed: <strong>Rs. {formatNepaliNumber(newTotalCashed)}</strong>
                        </Typography>
                        <Typography variant="body2" color={willBeFull ? 'success.main' : 'error.main'} fontWeight={600}>
                          {willBeFull
                            ? '✓ Cheque will be marked as Cashed in Full!'
                            : `Remaining Balance: Rs. ${formatNepaliNumber(newRemaining)}`}
                        </Typography>
                      </Paper>
                    );
                  })()}
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setCashModalOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleCashSubmit}
              disabled={cashMutation.isPending}
            >
              {cashMutation.isPending ? 'Updating...' : 'Save Payment'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
