import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, Table, TableHead, TableRow, TableCell, TableBody,
  Paper, IconButton, Alert, CircularProgress, Chip, Tabs, Tab, Tooltip,
  ListSubheader,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

function EmployeesTab({ canManage }) {
  const qc = useQueryClient();
  const { data: employees, isLoading, error } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees'),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');

  const openNew = () => { setEditing(null); setName(''); setPosition(''); setSalary(''); setOpen(true); };
  const openEdit = (emp) => { setEditing(emp); setName(emp.name); setPosition(emp.position || ''); setSalary(String(emp.salary)); setOpen(true); };

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/employees', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/employees/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setOpen(false); },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/employees/${id}/deactivate`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });

  const submit = () => {
    const body = { name, position: position || undefined, salary: +salary || 0 };
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
        <Typography variant="h6">Employees</Typography>
        {canManage && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add Employee</Button>}
      </Box>

      {employees.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No employees added yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Position</TableCell>
              <TableCell align="right">Monthly Salary</TableCell>
              <TableCell>Status</TableCell>
              {canManage && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id} sx={{ opacity: emp.is_active ? 1 : 0.5 }}>
                <TableCell>{emp.name}</TableCell>
                <TableCell>{emp.position || '—'}</TableCell>
                <TableCell align="right"><Money value={emp.salary} /></TableCell>
                <TableCell>
                  <Chip
                    label={emp.is_active ? 'Active' : 'Inactive'}
                    size="small"
                    color={emp.is_active ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                {canManage && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(emp)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title={emp.is_active ? 'Deactivate' : 'Reactivate'}>
                      <IconButton size="small" onClick={() => toggleMutation.mutate({ id: emp.id, is_active: !emp.is_active })}>
                        {emp.is_active ? <DeleteIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {submitError && <Alert severity="error">{submitError.message}</Alert>}
          <TextField label="Full Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth autoFocus />
          <TextField label="Position / Designation" value={position} onChange={(e) => setPosition(e.target.value)} fullWidth />
          <TextField label="Monthly Salary" type="number" value={salary} onChange={(e) => setSalary(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!name || !salary || submitting} onClick={submit}>
            {editing ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function DisburseTab({ canDisburse }) {
  const qc = useQueryClient();

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: () => api.get('/employees') });
  const { data: disbursements, isLoading, error } = useQuery({
    queryKey: ['salary-disbursements'],
    queryFn: () => api.get('/salary'),
  });
  const { data: accounts } = useQuery({ queryKey: ['account-options'], queryFn: () => api.get('/accounts/options') });

  const paymentAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((a) => ['Cash', 'Bank'].includes(a.heading));
  }, [accounts]);

  const activeEmployees = useMemo(() => (employees || []).filter((e) => e.is_active), [employees]);

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const [date, setDate] = useState(today);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [remark, setRemark] = useState('');
  const [amounts, setAmounts] = useState({});

  const openDisburse = () => {
    setMonth(currentMonth);
    setDate(today);
    setPaymentAccountId('');
    setRemark('');
    const initial = {};
    for (const emp of activeEmployees) initial[emp.id] = String(emp.salary);
    setAmounts(initial);
    setOpen(true);
  };

  const total = Object.values(amounts).reduce((s, v) => s + (+v || 0), 0);

  const disburseMutation = useMutation({
    mutationFn: (body) => api.post('/salary', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-disbursements'] });
      setOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/salary/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-disbursements'] }),
  });

  const submit = () => {
    const lines = activeEmployees
      .filter((emp) => +amounts[emp.id] > 0)
      .map((emp) => ({ employeeId: emp.id, amount: +amounts[emp.id] }));
    disburseMutation.mutate({ month, date, paymentAccountId, remark: remark || undefined, lines });
  };

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Salary Disbursements</Typography>
        {canDisburse && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openDisburse}
            disabled={activeEmployees.length === 0}
          >
            Disburse Salaries
          </Button>
        )}
      </Box>

      {activeEmployees.length === 0 && canDisburse && (
        <Alert severity="info" sx={{ mb: 2 }}>Add active employees in the Employees tab before disbursing salaries.</Alert>
      )}

      {disbursements?.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No salary disbursements yet.</Typography>
      ) : (
        disbursements?.map((d) => (
          <Paper key={d.id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box>
                <Typography variant="subtitle2">
                  {d.month} — <Money value={d.total_amount} />
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {d.date} via {d.payment_account_name}
                </Typography>
                {d.remark && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{d.remark}</Typography>
                )}
              </Box>
              {canDisburse && (
                <IconButton
                  size="small"
                  onClick={() => { if (window.confirm('Reverse this salary disbursement?')) deleteMutation.mutate(d.id); }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {d.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.employee_name}</TableCell>
                    <TableCell align="right"><Money value={l.amount} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ))
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Disburse Salaries</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {disburseMutation.error && <Alert severity="error">{disburseMutation.error.message}</Alert>}

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Payment Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>

          <Select
            value={paymentAccountId}
            onChange={(e) => setPaymentAccountId(e.target.value)}
            displayEmpty
            size="small"
            fullWidth
          >
            <MenuItem value="" disabled>Payment account (Cash / Bank)…</MenuItem>
            {paymentAccounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
            ))}
          </Select>

          <TextField
            label="Narration / Remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="Optional"
          />

          <Typography variant="body2" color="text.secondary">Employee Amounts</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Position</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeEmployees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>{emp.name}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{emp.position || '—'}</TableCell>
                  <TableCell align="right" sx={{ width: 140 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={amounts[emp.id] ?? ''}
                      onChange={(e) => setAmounts((a) => ({ ...a, [emp.id]: e.target.value }))}
                      sx={{ width: 120 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={2}><strong>Total</strong></TableCell>
                <TableCell align="right"><strong><Money value={total} /></strong></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!month || !date || !paymentAccountId || total <= 0 || disburseMutation.isPending}
            onClick={submit}
          >
            Post Salaries
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function Salary() {
  const { profile } = useAuth();
  const canManage = hasRole(profile, 'manager');
  const canDisburse = hasRole(profile, 'accountant');
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Salary</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Employees" />
        <Tab label="Disbursements" />
      </Tabs>
      {tab === 0 && <EmployeesTab canManage={canManage} />}
      {tab === 1 && <DisburseTab canDisburse={canDisburse} />}
    </Box>
  );
}
