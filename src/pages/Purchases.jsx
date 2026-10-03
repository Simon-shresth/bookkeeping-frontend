import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, IconButton, Chip, Alert, CircularProgress,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const NEW_PRODUCT = '__new__';
const emptyLine = () => ({ productId: '', qty: 1, unitPrice: '', newName: '', newSellPrice: '', newMinStock: 0, newUnit: 'pcs' });
const emptyForm = () => ({ invoiceNumber: '', pragyapanNumber: '', supplierId: '', lines: [emptyLine()], paidAmount: 0, accountId: '' });

export default function Purchases() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);
  const { data: purchases, isLoading, error } = useQuery({ queryKey: ['purchases', search], queryFn: () => api.get(`/purchases${search ? `?q=${encodeURIComponent(search)}` : ''}`) });
  const runSearch = () => setSearch(searchInputRef.current.value);

  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers') });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.get('/products') });
  const { data: accounts } = useQuery({ queryKey: ['liquid-accounts'], queryFn: () => api.get('/accounts/options') });
  const liquidAccounts = useMemo(() => (accounts || []).filter((a) => a.heading === 'Cash' || a.heading === 'Bank'), [accounts]);
  const productById = useMemo(() => Object.fromEntries((products || []).map((p) => [p.id, p])), [products]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setLine = (i, k, v) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));

  const openNew = () => { setEditing(null); setForm({ ...emptyForm(), accountId: liquidAccounts[0]?.id || '' }); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      invoiceNumber: p.invoice_number || '', pragyapanNumber: p.pragyapan_number || '', supplierId: p.supplier_id,
      lines: p.lines.map((l) => ({ productId: l.product_id, qty: l.qty, unitPrice: l.unit_price, newName: '', newSellPrice: '', newMinStock: 0, newUnit: 'pcs' })),
      paidAmount: p.paid_amount, accountId: p.payment_account_id || liquidAccounts[0]?.id || '',
    });
    setOpen(true);
  };

  const onProductChange = (i, productId) => {
    const p = productById[productId];
    setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, productId, unitPrice: productId !== NEW_PRODUCT && p ? p.purchase_price : l.unitPrice } : l)) }));
  };

  const total = form.lines.reduce((s, l) => s + (+l.qty || 0) * (+l.unitPrice || 0), 0);
  const paid = Math.min(+form.paidAmount || 0, total);
  const credit = Math.max(total - paid, 0);

  const body = () => ({
    invoiceNumber: form.invoiceNumber || undefined,
    pragyapanNumber: form.pragyapanNumber || undefined,
    supplierId: form.supplierId,
    lines: form.lines.filter((l) => l.productId).map((l) => {
      if (l.productId === NEW_PRODUCT) {
        return { newProduct: { name: l.newName, sellPrice: l.newSellPrice ? +l.newSellPrice : undefined, minStock: +l.newMinStock || 0, unit: l.newUnit || 'pcs' }, qty: +l.qty, unitPrice: +l.unitPrice };
      }
      return { productId: l.productId, qty: +l.qty, unitPrice: +l.unitPrice };
    }),
    paidAmount: +form.paidAmount || 0,
    accountId: form.accountId,
  });

  const saveMutation = useMutation({
    mutationFn: () => (editing ? api.put(`/purchases/${editing.id}`, body()) : api.post('/purchases', body())),
    onSuccess: () => {
      ['purchases', 'products', 'suppliers', 'journal', 'dashboard', 'chart-of-accounts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setOpen(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/purchases/${id}`),
    onSuccess: () => ['purchases', 'products', 'suppliers', 'journal', 'dashboard', 'chart-of-accounts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
    onError: (err) => alert(err.message),
  });

  const canSubmit = form.supplierId && form.lines.some((l) => l.productId && (l.productId !== NEW_PRODUCT || l.newName) && +l.qty > 0) && form.accountId;

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Purchase Invoices</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} disabled={!suppliers?.length}>New Purchase</Button>}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small" fullWidth inputRef={searchInputRef} defaultValue={search}
          placeholder="Search by invoice number, pragyapan patra number, supplier, or product — press Enter"
          onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
        />
        <Button variant="outlined" startIcon={<SearchIcon />} onClick={runSearch}>Search</Button>
      </Box>

      {purchases.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{search ? 'No purchases match that search.' : 'No purchases recorded yet.'}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell><TableCell>Invoice #</TableCell><TableCell>Pragyapan Patra #</TableCell><TableCell>Supplier</TableCell>
              <TableCell>Items</TableCell><TableCell align="right">Total</TableCell><TableCell>Status</TableCell>{canEdit && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {purchases.map((p) => {
              const status = p.credit_amount <= 0 ? 'Paid' : p.paid_amount > 0 ? `Partial · ${p.account_name}` : 'Credit';
              const itemsLabel = p.lines.length ? `${p.lines[0].product_name}${p.lines.length > 1 ? ` +${p.lines.length - 1} more` : ''}` : '';
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.date}</TableCell>
                  <TableCell>{p.invoice_number}</TableCell>
                  <TableCell>{p.pragyapan_number}</TableCell>
                  <TableCell>{p.supplier_name}</TableCell>
                  <TableCell>{itemsLabel}</TableCell>
                  <TableCell align="right"><Money value={p.total} /></TableCell>
                  <TableCell><Chip label={status} size="small" color={p.credit_amount <= 0 ? 'success' : 'default'} variant="outlined" /></TableCell>
                  {canEdit && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Button size="small" onClick={() => openEdit(p)}>Edit</Button>
                      <IconButton size="small" onClick={() => { if (confirm('Delete this purchase? Stock and ledger entries will be reversed.')) deleteMutation.mutate(p.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Update Purchase' : 'New Purchase'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Invoice Number" placeholder="e.g. PINV-1001" value={form.invoiceNumber} onChange={set('invoiceNumber')} fullWidth />
            <TextField label="Pragyapan Patra Number" placeholder="e.g. PP-2082-001" value={form.pragyapanNumber} onChange={set('pragyapanNumber')} fullWidth />
          </Box>
          <Select value={form.supplierId} onChange={set('supplierId')} displayEmpty fullWidth>
            <MenuItem value="" disabled>Supplier…</MenuItem>
            {(suppliers || []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </Select>

          <Typography variant="body2" color="text.secondary">Products</Typography>
          {form.lines.map((line, i) => {
            const isNew = line.productId === NEW_PRODUCT;
            const p = productById[line.productId];
            const lineTotal = (+line.qty || 0) * (+line.unitPrice || 0);
            return (
              <Box key={i} sx={{ border: isNew ? '1px solid' : 'none', borderColor: 'divider', p: isNew ? 1.5 : 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Select value={line.productId} onChange={(e) => onProductChange(i, e.target.value)} displayEmpty sx={{ flex: 3 }}>
                    <MenuItem value="" disabled>Product…</MenuItem>
                    {(products || []).map((prod) => <MenuItem key={prod.id} value={prod.id}>{prod.name}</MenuItem>)}
                    <MenuItem value={NEW_PRODUCT}>+ Add New Product</MenuItem>
                  </Select>
                  <TextField type="number" label="Qty" value={line.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} sx={{ flex: 1 }}
                    InputProps={{ endAdornment: !isNew && p ? <InputAdornment position="end">{p.unit}</InputAdornment> : null }} />
                  <TextField type="number" label="Unit Price" value={line.unitPrice} onChange={(e) => setLine(i, 'unitPrice', e.target.value)} sx={{ flex: 1 }} />
                  <Typography variant="body2" sx={{ flex: 1, textAlign: 'right' }}><Money value={lineTotal} /></Typography>
                  <IconButton size="small" disabled={form.lines.length <= 1} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                {isNew && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" label="New Product Name" value={line.newName} onChange={(e) => setLine(i, 'newName', e.target.value)} sx={{ flex: 2 }} />
                    <TextField size="small" label="Selling Price" type="number" value={line.newSellPrice} onChange={(e) => setLine(i, 'newSellPrice', e.target.value)} sx={{ flex: 1 }} />
                    <TextField size="small" label="Unit" value={line.newUnit} onChange={(e) => setLine(i, 'newUnit', e.target.value)} sx={{ flex: 1 }} />
                    <TextField size="small" label="Min. Stock" type="number" value={line.newMinStock} onChange={(e) => setLine(i, 'newMinStock', e.target.value)} sx={{ flex: 1 }} />
                  </Box>
                )}
              </Box>
            );
          })}
          <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}>+ Add Product</Button>

          <TextField label="Total" value={total.toFixed(2)} InputProps={{ readOnly: true }} fullWidth />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Amount Paid Now" type="number" value={form.paidAmount} onChange={set('paidAmount')} fullWidth />
            <Select value={form.accountId} onChange={set('accountId')} displayEmpty fullWidth>
              <MenuItem value="" disabled>Paid from…</MenuItem>
              {liquidAccounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
            </Select>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            {credit > 0 ? <>On credit: <Money value={credit} /></> : 'Fully paid'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {editing ? 'Update Purchase' : 'Record Purchase'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
