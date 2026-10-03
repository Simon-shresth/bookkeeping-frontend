import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, IconButton, Chip, Alert, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const COMMON_UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'dozen', 'pack', 'meter', 'bag'];
const emptyForm = { name: '', purchasePrice: '', sellPrice: '', stock: '', minStock: '', unit: 'pcs' };

export default function Products() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['products'], queryFn: () => api.get('/products') });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [customUnit, setCustomUnit] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setEditing(null); setForm(emptyForm); setCustomUnit(false); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, purchasePrice: p.purchase_price, sellPrice: p.sell_price, stock: p.stock, minStock: p.min_stock, unit: p.unit || 'pcs' });
    setCustomUnit(!COMMON_UNITS.includes(p.unit));
    setOpen(true);
  };

  const body = () => ({
    name: form.name,
    purchasePrice: +form.purchasePrice || 0,
    sellPrice: +form.sellPrice || 0,
    stock: +form.stock || 0,
    minStock: +form.minStock || 0,
    unit: form.unit || 'pcs',
  });

  const saveMutation = useMutation({
    mutationFn: () => (editing ? api.put(`/products/${editing.id}`, body()) : api.post('/products', body())),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (err) => alert(err.message),
  });

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Products</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add</Button>}
      </Box>

      {data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No products yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell><TableCell>Unit</TableCell><TableCell align="right">Purchase Price</TableCell><TableCell align="right">Selling Price</TableCell>
              <TableCell align="right">Stock</TableCell><TableCell align="right">Min. Stock</TableCell>{canEdit && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((p) => {
              const low = Number(p.stock) <= Number(p.min_stock);
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.unit}</TableCell>
                  <TableCell align="right"><Money value={p.purchase_price} /></TableCell>
                  <TableCell align="right"><Money value={p.sell_price} /></TableCell>
                  <TableCell align="right">
                    {low ? <Chip label={`${p.stock} ${p.unit}`} size="small" color="error" variant="outlined" /> : `${p.stock} ${p.unit}`}
                  </TableCell>
                  <TableCell align="right">{p.min_stock} {p.unit}</TableCell>
                  {canEdit && (
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(p)}>Edit</Button>
                      <IconButton size="small" onClick={() => deleteMutation.mutate(p.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? 'Edit Product' : 'New Product'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          <TextField label="Product Name" value={form.name} onChange={set('name')} autoFocus fullWidth />
          {customUnit ? (
            <TextField
              label="Unit of Measurement" value={form.unit} onChange={set('unit')} fullWidth
              helperText="e.g. pcs, kg, ltr, box — or pick from the list"
              InputProps={{ endAdornment: <Button size="small" onClick={() => setCustomUnit(false)}>List</Button> }}
            />
          ) : (
            <Select
              value={COMMON_UNITS.includes(form.unit) ? form.unit : 'pcs'}
              onChange={(e) => (e.target.value === '__custom__' ? setCustomUnit(true) : setForm((f) => ({ ...f, unit: e.target.value })))}
              fullWidth
            >
              {COMMON_UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
              <MenuItem value="__custom__">Other…</MenuItem>
            </Select>
          )}
          <TextField label="Purchase Price" type="number" value={form.purchasePrice} onChange={set('purchasePrice')} fullWidth />
          <TextField label="Selling Price" type="number" value={form.sellPrice} onChange={set('sellPrice')} fullWidth />
          <TextField label={editing ? 'Stock' : 'Opening Stock'} type="number" value={form.stock} onChange={set('stock')} fullWidth />
          <TextField label="Minimum Stock" type="number" value={form.minStock} onChange={set('minStock')} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.name || saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
